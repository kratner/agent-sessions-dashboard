import * as vscode from 'vscode';
import { log } from '../log';
import { legacyCopies } from './legacyId';

/**
 * Removes the pre-Marketplace copy (kratner.agent-workspace-dashboard) if it's still installed.
 * Both copies register the same commands, so while the old one is loaded this copy registers
 * nothing: it uninstalls the old one and asks for a reload. Returns true when it did that, and
 * activation should stop there.
 */
export async function removeLegacyCopy(context: vscode.ExtensionContext): Promise<boolean> {
  if (context.extensionMode !== vscode.ExtensionMode.Production) return false;
  const old = legacyCopies(context.extension.id, (id) => vscode.extensions.getExtension(id) !== undefined);
  if (!old.length) return false;
  for (const id of old) {
    try {
      await vscode.commands.executeCommand('workbench.extensions.uninstallExtension', id);
      log.info(`removed the old copy ${id}`);
    } catch (err) {
      log.error(`could not remove the old copy ${id}`, err);
      void vscode.window.showWarningMessage(
        `Agent Workspace Dashboard moved to the Marketplace. Please uninstall the old copy (${id}) from the Extensions view, then reload the window.`,
      );
      return true;
    }
  }
  const reload = await vscode.window.showInformationMessage(
    'Agent Workspace Dashboard now comes from the VS Code Marketplace, and the old copy has been removed. Reload the window to finish.',
    'Reload Window',
  );
  if (reload) await vscode.commands.executeCommand('workbench.action.reloadWindow');
  return true;
}
