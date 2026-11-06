import * as vscode from 'vscode';
import { log } from '../log';
import { legacyCopies } from './legacyId';
import { NEW_SECTION, OLD_SECTION, SETTING_KEYS, settingsToCopy } from './settingsRename';

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
        `Agent Sessions Dashboard moved to the Marketplace. Please uninstall the old copy (${id}) from the Extensions view, then reload the window.`,
      );
      return true;
    }
  }
  const reload = await vscode.window.showInformationMessage(
    'Agent Sessions Dashboard now comes from the VS Code Marketplace, and the old copy has been removed. Reload the window to finish.',
    'Reload Window',
  );
  if (reload) await vscode.commands.executeCommand('workbench.action.reloadWindow');
  return true;
}

const COPIED_KEY = 'agentSessions.settingsCopied';

/**
 * Copies agentWorkspace.* settings to agentSessions.*, once for user settings and once per
 * workspace. A value already set under the new name is never overwritten.
 */
export async function copyRenamedSettings(context: vscode.ExtensionContext): Promise<void> {
  const doGlobal = !context.globalState.get<boolean>(COPIED_KEY, false);
  const doWorkspace = vscode.workspace.workspaceFile !== undefined || (vscode.workspace.workspaceFolders?.length ?? 0) > 0
    ? !context.workspaceState.get<boolean>(COPIED_KEY, false)
    : false;
  if (!doGlobal && !doWorkspace) return;
  const oldConfig = vscode.workspace.getConfiguration(OLD_SECTION);
  const newConfig = vscode.workspace.getConfiguration(NEW_SECTION);
  for (const key of SETTING_KEYS) {
    for (const { scope, value } of settingsToCopy(oldConfig.inspect(key), newConfig.inspect(key))) {
      if (scope === 'global' ? !doGlobal : !doWorkspace) continue;
      try {
        await newConfig.update(key, value, scope === 'global' ? vscode.ConfigurationTarget.Global : vscode.ConfigurationTarget.Workspace);
        log.info(`copied setting ${OLD_SECTION}.${key} to ${NEW_SECTION}.${key} (${scope})`);
      } catch (err) {
        log.error(`could not copy setting ${OLD_SECTION}.${key}`, err);
      }
    }
  }
  if (doGlobal) await context.globalState.update(COPIED_KEY, true);
  if (doWorkspace) await context.workspaceState.update(COPIED_KEY, true);
}
