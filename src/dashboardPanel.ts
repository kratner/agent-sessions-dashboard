import * as vscode from 'vscode';
import type { HistoryService } from './history/historyService';
import { log } from './log';
import { summarize } from './shared/summary';
import type { AgentSession, Appearance, HistoryRef, HostMessage, ListColumnPref, WebviewMessage } from './shared/types';
import type { SessionStore } from './sessionStore';
import type { SessionSource } from './sources/SessionSource';

export const VIEW_TYPE = 'agentSessions.dashboard';
const ACTIVE_VIEW_KEY = 'agentSessions.activeView';
const DEFAULT_VIEW = 'kanban';
const LIST_COLUMNS_KEY = 'agentSessions.listColumns';
const HISTORY_SOURCE = 'claude-code';
/**
 * The host resends the whole state this often, even when nothing changed. The store only posts on
 * changes, so a webview that missed one (VS Code dropped the message while the board sat untouched
 * in the background) would otherwise show stale cards until it was reopened.
 */
const HEARTBEAT_MS = 15_000;

/** The single dashboard tab. The webview owns the list of views; the host only stores which one is active. */
export class DashboardPanel implements vscode.Disposable {
  private static current?: DashboardPanel;
  private readonly disposables: vscode.Disposable[] = [];
  /** Consecutive state messages VS Code reported as not delivered. */
  private undelivered = 0;

  static show(context: vscode.ExtensionContext, store: SessionStore, history: HistoryService): void {
    if (DashboardPanel.current) {
      DashboardPanel.current.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(VIEW_TYPE, 'Agent Sessions', vscode.ViewColumn.Active, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
    });
    DashboardPanel.current = new DashboardPanel(panel, context, store, history);
  }

  /** Re-attach to a tab VS Code restored after a restart. */
  static revive(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, store: SessionStore, history: HistoryService): void {
    panel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')] };
    DashboardPanel.current?.dispose();
    DashboardPanel.current = new DashboardPanel(panel, context, store, history);
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private readonly store: SessionStore,
    private readonly history: HistoryService,
  ) {
    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');
    // Listen before setting the HTML, so the webview's first message can't arrive unheard.
    this.disposables.push(
      panel.webview.onDidReceiveMessage((m: WebviewMessage) =>
        this.handle(m).catch((err) => log.error(`handling "${m?.type}" from the webview failed`, err)),
      ),
      store.onDidChange((sessions) => {
        log.info(`sessions changed: ${summarize(sessions)}`);
        this.post();
      }),
      history.onStatus((status) => this.send({ type: 'historyStatus', status })),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('agentSessions.appearance') || e.affectsConfiguration('agentSessions.historyResultThreshold')) this.post();
      }),
      // Coming back into view: resend the latest state, whether or not VS Code reloaded the webview.
      panel.onDidChangeViewState(({ webviewPanel }) => {
        log.info(`dashboard ${webviewPanel.visible ? 'shown' : 'hidden'}${webviewPanel.active ? ' (active)' : ''}`);
        if (webviewPanel.visible) {
          this.post();
          void this.store.refresh();
        }
      }),
      panel.onDidDispose(() => this.dispose()),
    );
    const heartbeat = setInterval(() => this.post(), HEARTBEAT_MS);
    this.disposables.push({ dispose: () => clearInterval(heartbeat) });
    panel.webview.html = this.html();
    log.info(`dashboard webview created (extension at ${context.extensionUri.fsPath})`);
  }

  private async handle(message: WebviewMessage): Promise<void> {
    if (message.type !== 'log' && message.type !== 'historySearch') log.info(`webview -> ${message.type}`);
    switch (message.type) {
      case 'log':
        log[message.level](`[webview] ${message.message}`);
        break;
      case 'ready':
        this.post();
        void this.store.refresh();
        break;
      case 'refresh':
        await this.store.refresh();
        this.post();
        break;
      case 'resync':
        // Focus resyncs happen all the time; only the "went quiet" kind is worth a log line.
        if (message.reason !== 'focus') log.info(`webview resync: ${message.reason}`);
        this.post();
        void this.store.refresh();
        break;
      case 'setView':
        await this.context.workspaceState.update(ACTIVE_VIEW_KEY, message.viewId);
        break;
      case 'setListColumns':
        // Global: a column layout is a personal preference, not a per-project one.
        await this.context.globalState.update(LIST_COLUMNS_KEY, message.columns);
        break;
      case 'open': {
        const found = this.store.find(message.key);
        if (found) await found.source.open(found.session);
        break;
      }
      case 'copyResume': {
        const found = this.store.find(message.key);
        await this.copyResume(found?.source.resumeCommand?.(found.session));
        break;
      }
      case 'remove': {
        const found = this.store.find(message.key);
        if (found) await this.remove(found.session, found.source);
        break;
      }
      case 'unhide':
        await this.store.unhide(message.key);
        break;
      case 'historySearch': {
        // Sessions already on the dashboard are shown there; history lists the rest.
        const onDashboard = new Set(this.store.current.filter((s) => s.source === HISTORY_SOURCE).map((s) => s.id));
        const result = this.history.query(message.query, message.includeSubagents, onDashboard, message.offset, message.limit);
        this.send({ type: 'historyResults', requestId: message.requestId, offset: message.offset, ...result });
        break;
      }
      case 'openHistory': {
        const source = this.store.sources.find((s) => s.id === HISTORY_SOURCE);
        if (source) await source.open(historySession(message.ref));
        break;
      }
      case 'copyHistoryResume': {
        const source = this.store.sources.find((s) => s.id === HISTORY_SOURCE);
        await this.copyResume(source?.resumeCommand?.(historySession(message.ref)));
        break;
      }
    }
  }

  /**
   * Hide a session, or end its process. Ending is for orphans: a live process whose app no
   * longer shows the session (e.g. a Claude Desktop chat that was closed), so nothing else can stop it.
   */
  private async remove(session: AgentSession, source: SessionSource): Promise<void> {
    const HIDE = 'Hide from Board';
    const END = 'End Process';
    const canEnd = session.state !== 'ended' && !!session.pid && !!source.endProcess;
    const working = session.state === 'busy' ? ' It is working right now.' : '';
    const detail = canEnd
      ? `Hide: process ${session.pid} keeps running, and the card comes back if the session does anything new.\n\n` +
        `End Process: stops process ${session.pid} (${session.surface ?? session.sourceLabel}) and hides the card.${working} ` +
        `The conversation stays on disk, so you can still resume it.`
      : 'The card comes back if the session does anything new.';
    const choice = await vscode.window.showWarningMessage(
      `Remove "${session.title}" from the board?`,
      { modal: true, detail },
      ...(canEnd ? [HIDE, END] : [HIDE]),
    );
    if (choice === END) {
      try {
        await source.endProcess!(session);
      } catch (err) {
        log.error(`could not end process ${session.pid}`, err);
        void vscode.window.showErrorMessage(`Could not end process ${session.pid}: ${(err as Error).message}`);
        return;
      }
      await this.store.hide(session);
      vscode.window.setStatusBarMessage(`$(check) Ended "${session.title}"`, 3000);
    } else if (choice === HIDE) {
      await this.store.hide(session);
    }
  }

  private async copyResume(command: string | undefined): Promise<void> {
    if (!command) return;
    await vscode.env.clipboard.writeText(command);
    vscode.window.setStatusBarMessage('$(check) Resume command copied', 3000);
  }

  private post(): void {
    const config = vscode.workspace.getConfiguration('agentSessions');
    this.send({
      type: 'state',
      sessions: this.store.current,
      viewId: this.context.workspaceState.get<string>(ACTIVE_VIEW_KEY, DEFAULT_VIEW),
      listColumns: this.context.globalState.get<ListColumnPref[]>(LIST_COLUMNS_KEY),
      sources: this.store.sources.map((s) => s.label),
      appearance: config.get<Appearance>('appearance', 'brand'),
      historyThreshold: config.get<number>('historyResultThreshold', 150),
    });
  }

  private send(message: HostMessage): void {
    // Always send. A truly hidden webview just doesn't receive it (postMessage resolves false)
    // and reloads with 'ready' when shown. But `panel.visible` can be false while the webview is
    // still alive and on screen (e.g. after opening a session moves focus to a Claude tab), and
    // skipping sends then left the board stale until it was reopened.
    this.panel.webview.postMessage(message).then(
      (delivered) => {
        if (message.type !== 'state') return;
        if (!delivered) {
          if (this.undelivered++ === 0) log.info('state not delivered (webview hidden or reloading); will keep resending');
        } else if (this.undelivered > 0) {
          log.info(`state delivered again after ${this.undelivered} missed`);
          this.undelivered = 0;
        }
      },
      (err) => log.error(`posting ${message.type} to the webview failed`, err),
    );
  }

  private html(): string {
    const webview = this.panel.webview;
    const asset = (file: string) => webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', file));
    const nonce = Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${asset('webview.css')}">
  <title>Agent Sessions</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${asset('webview.js')}"></script>
</body>
</html>`;
  }

  dispose(): void {
    if (DashboardPanel.current === this) DashboardPanel.current = undefined;
    for (const d of this.disposables.splice(0)) d.dispose();
    this.panel.dispose();
  }
}

/** A history result as an ended session, so the Claude Code source can open or resume it. */
function historySession(ref: HistoryRef): AgentSession {
  return {
    key: `${HISTORY_SOURCE}:${ref.sessionId}`,
    source: HISTORY_SOURCE,
    sourceLabel: 'Claude Code',
    id: ref.sessionId,
    title: ref.title,
    cwd: ref.cwd,
    state: 'ended',
    updatedAt: ref.lastActivity,
  };
}
