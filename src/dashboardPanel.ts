import * as vscode from 'vscode';
import type { HistoryService } from './history/historyService';
import { log } from './log';
import type { AgentSession, Appearance, HistoryRef, HostMessage, WebviewMessage } from './shared/types';
import type { SessionStore } from './sessionStore';

export const VIEW_TYPE = 'agentWorkspace.dashboard';
const ACTIVE_VIEW_KEY = 'agentWorkspace.activeView';
const DEFAULT_VIEW = 'kanban';
const HISTORY_SOURCE = 'claude-code';

/** The single dashboard tab. The webview owns the list of views; the host only stores which one is active. */
export class DashboardPanel implements vscode.Disposable {
  private static current?: DashboardPanel;
  private readonly disposables: vscode.Disposable[] = [];

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
      store.onDidChange(() => this.post()),
      history.onStatus((status) => this.send({ type: 'historyStatus', status })),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('agentWorkspace.appearance') || e.affectsConfiguration('agentWorkspace.historyResultThreshold')) this.post();
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
        break;
      case 'setView':
        await this.context.workspaceState.update(ACTIVE_VIEW_KEY, message.viewId);
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

  private async copyResume(command: string | undefined): Promise<void> {
    if (!command) return;
    await vscode.env.clipboard.writeText(command);
    vscode.window.setStatusBarMessage('$(check) Resume command copied', 3000);
  }

  private post(): void {
    const config = vscode.workspace.getConfiguration('agentWorkspace');
    this.send({
      type: 'state',
      sessions: this.store.current,
      viewId: this.context.workspaceState.get<string>(ACTIVE_VIEW_KEY, DEFAULT_VIEW),
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
    this.panel.webview.postMessage(message).then(undefined, (err) => log.error(`posting ${message.type} to the webview failed`, err));
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
