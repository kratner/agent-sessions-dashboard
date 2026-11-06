import * as vscode from 'vscode';

// One "Agent Sessions" channel in the Output panel. VS Code also writes it to disk under the
// window's exthost log folder, which is what to read when debugging a report.
let channel: vscode.LogOutputChannel | undefined;

export function initLog(context: vscode.ExtensionContext): vscode.LogOutputChannel {
  channel = vscode.window.createOutputChannel('Agent Sessions', { log: true });
  context.subscriptions.push(channel);
  return channel;
}

export const log = {
  info: (message: string) => channel?.info(message),
  error: (message: string, err?: unknown) => channel?.error(err ? `${message}: ${err instanceof Error ? err.stack ?? err.message : String(err)}` : message),
};
