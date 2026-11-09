import * as path from 'path';
import * as vscode from 'vscode';
import { DashboardPanel, VIEW_TYPE } from './dashboardPanel';
import { HistoryService } from './history/historyService';
import { initLog, log } from './log';
import { SessionStore } from './sessionStore';
import { ClaudeCodeSource, claudeConfigDir } from './sources/claudeCode';
import { copyRenamedSettings, removeLegacyCopy } from './update/migrate';
import { registerUpdater } from './update/updater';
import type { AgentSession } from './shared/types';

const HOUR_MS = 3_600_000;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  initLog(context);
  log.info(`activated ${context.extension.id} v${context.extension.packageJSON.version}`);
  // An old pre-Marketplace copy still loaded would own the same commands: remove it and stop.
  if (await removeLegacyCopy(context)) return;
  await copyRenamedSettings(context).catch((err) => log.error('copying renamed settings failed', err));
  const config = () => vscode.workspace.getConfiguration('agentSessions');
  const endedWithinMs = () => Math.max(0, config().get<number>('endedWithinHours', 24)) * HOUR_MS;

  // Register new agent systems here.
  const store = new SessionStore([new ClaudeCodeSource(endedWithinMs)], context.globalState);
  // Built on the first history search, then cached per machine in the extension's storage.
  const history = new HistoryService(
    path.join(claudeConfigDir(), 'projects'),
    path.join(context.globalStorageUri.fsPath, 'history-index-v1.json'),
  );

  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusItem.command = 'agentSessions.openDashboard';
  const updateStatus = (sessions: AgentSession[]) => {
    if (!config().get<boolean>('showStatusBar', true)) {
      statusItem.hide();
      return;
    }
    const shown = sessions.filter((s) => !s.hidden);
    const waiting = shown.filter((s) => s.state === 'waiting').length;
    const busy = shown.filter((s) => s.state === 'busy').length;
    const parts = [waiting && `${waiting} waiting`, busy && `${busy} working`].filter(Boolean);
    statusItem.text = `$(hubot) ${parts.length ? parts.join(' · ') : 'Agents'}`;
    statusItem.tooltip = 'Open the Agent Sessions dashboard';
    statusItem.backgroundColor = waiting ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
    statusItem.show();
  };
  updateStatus([]);

  context.subscriptions.push(
    store,
    history,
    statusItem,
    ...registerUpdater(context),
    store.onDidChange(updateStatus),
    vscode.commands.registerCommand('agentSessions.openDashboard', () => DashboardPanel.show(context, store, history)),
    vscode.commands.registerCommand('agentSessions.refresh', () => store.refresh()),
    vscode.window.registerWebviewPanelSerializer(VIEW_TYPE, {
      async deserializeWebviewPanel(panel) {
        DashboardPanel.revive(panel, context, store, history);
      },
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('agentSessions')) {
        updateStatus(store.current);
        void store.refresh();
      }
    }),
  );
}

export function deactivate(): void {}
