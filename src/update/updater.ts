import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { log } from '../log';
import { MARKETPLACE_ID } from './legacyId';
import { downloadVerified, isCheckDue, isNewer, latestRelease, vsixAsset } from './releaseClient';

// VS Code keeps Marketplace installs up to date by itself. A copy installed from a .vsix (the
// install scripts, or a hand install) is not, so the extension also checks GitHub Releases: about
// once a day, and on demand from the "Check for Updates" command. "Once a day" holds while VS Code
// stays open for days: besides the check shortly after startup, it looks every hour whether a day
// has passed since the last check. The last-check time is shared by all windows.
//
// "Update" installs from the Marketplace by ID, which also turns a .vsix install into a Marketplace
// one that VS Code updates from then on. If the Marketplace can't be reached (or doesn't have the
// version yet), it falls back to the checksum-verified .vsix from the release.
// The release workflow publishes to the Marketplace before it creates the GitHub release, so a
// release on GitHub means the Marketplace has it too.

const STARTUP_DELAY_MS = 30_000;
const RECHECK_EVERY_MS = 3_600_000;
const LAST_CHECK_KEY = 'agentWorkspace.lastUpdateCheck';
const SKIPPED_KEY = 'agentWorkspace.skippedVersion';

export function registerUpdater(context: vscode.ExtensionContext): vscode.Disposable[] {
  const check = (manual: boolean) => checkForUpdates(context, manual).catch((err) => log.error('update check failed', err));
  const checkIfDue = () => {
    const enabled = vscode.workspace.getConfiguration('agentWorkspace').get<boolean>('checkForUpdates', true);
    const last = context.globalState.get<number>(LAST_CHECK_KEY, 0);
    if (enabled && context.extensionMode === vscode.ExtensionMode.Production && isCheckDue(last, Date.now())) void check(false);
  };
  const timer = setTimeout(checkIfDue, STARTUP_DELAY_MS);
  const hourly = setInterval(checkIfDue, RECHECK_EVERY_MS);
  return [
    { dispose: () => clearTimeout(timer) },
    { dispose: () => clearInterval(hourly) },
    vscode.commands.registerCommand('agentWorkspace.checkForUpdates', () => check(true)),
  ];
}

async function checkForUpdates(context: vscode.ExtensionContext, manual: boolean): Promise<void> {
  const current: string = context.extension.packageJSON.version;
  let release;
  try {
    release = await latestRelease();
  } catch (err) {
    log.error('could not reach GitHub to check for updates', err);
    if (manual) void vscode.window.showErrorMessage(`Couldn't check for updates: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  await context.globalState.update(LAST_CHECK_KEY, Date.now());

  const latest = release.tag_name.replace(/^v/, '');
  log.info(`update check: installed ${current}, latest release ${latest}`);
  if (!isNewer(latest, current)) {
    if (manual) void vscode.window.showInformationMessage(`Agent Workspace Dashboard is up to date (${current}).`);
    return;
  }
  if (!manual && context.globalState.get<string>(SKIPPED_KEY) === latest) return;

  const asset = vsixAsset(release);
  const actions = ['Update', 'Release Notes'];
  if (!manual) actions.push('Skip This Version');
  const choice = await vscode.window.showInformationMessage(`Agent Workspace Dashboard ${latest} is available. You have ${current}.`, ...actions);

  if (choice === 'Release Notes') {
    await vscode.env.openExternal(vscode.Uri.parse(release.html_url));
  } else if (choice === 'Skip This Version') {
    await context.globalState.update(SKIPPED_KEY, latest);
  } else if (choice === 'Update') {
    let from = 'the Marketplace';
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Updating Agent Workspace Dashboard to ${latest}…` },
      async () => {
        try {
          await vscode.commands.executeCommand('workbench.extensions.installExtension', MARKETPLACE_ID);
        } catch (err) {
          if (!asset) throw err;
          log.error('Marketplace install failed; falling back to the release .vsix', err);
          const file = path.join(os.tmpdir(), asset.name);
          await downloadVerified(asset, file);
          await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(file));
          from = asset.browser_download_url;
        }
      },
    );
    log.info(`updated to ${latest} from ${from}`);
    const reload = await vscode.window.showInformationMessage(
      `Agent Workspace Dashboard ${latest} is installed. Reload the window to start using it.`,
      'Reload Window',
    );
    if (reload) await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}
