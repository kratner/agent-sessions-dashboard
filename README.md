<p align="center"><img src="media/icon.png" width="96" alt="Agent Sessions Dashboard icon"></p>

# Agent Sessions Dashboard

**A Four Ounces tool** · [Source on GitHub](https://github.com/kratner/agent-sessions-dashboard)

See every AI coding agent session you have running, as a Kanban board or a list, and spot the one that's waiting on you.

Works with Claude Code today, and built so other agents can be added as sources. Called Agent Workspace Dashboard up to 0.7.2.

![Kanban view: sessions grouped into Waiting on you, Working, Idle and Ended](media/screenshots/kanban-brand.png)

## Features

- **Kanban and List views.** Sessions are grouped by state: Waiting on you, Working, Idle and Ended. Switch views in the header; the dashboard remembers your choice for each workspace.
- **Columns your way.** In the List view, drag a column's edge to resize it, and use **Columns** to show, hide and reorder columns, including optional Last prompt, Path, Agent and Started columns. The layout is saved for all your workspaces.
- **Know what needs you.** A session waiting for your reply or approval gets its own column, a highlighted card and a count in the status bar. The card says what it's waiting for, such as a permission prompt or an open dialog.
- **Search.** Filter either view as you type, by title, prompt, folder, where it runs or state. Matches are highlighted.
- **Search your whole history.** Switch on **History** to search every past agent session on the machine, including what its subagents did, and resume any of them.
- **Live.** Cards move as sessions change state. You never need to refresh.
- **Every session, wherever it runs.** It shows agents in VS Code panels, in a terminal and in the background, across all your project folders.
- **Click to open.** Clicking a card brings a session in this window to the front: its editor tab, or the terminal it's running in. An ended session is resumed. For a session running elsewhere, it tells you where.
- **Resume ended sessions.** **Copy resume** puts the agent's resume command for that session (for Claude Code, `claude --resume`) on your clipboard.
- **Two looks.** The Four Ounces look by default (warm ink, or warm paper when VS Code uses a light theme, with Old Gold marking what needs you), or follow your VS Code color theme.
- **Easy to install and update.** Install it from the VS Code Marketplace, which keeps it up to date.
- **Read-only and local.** It reads files your agents already write on your machine. It never starts, stops or changes a session, and none of your data leaves the machine. The history index is stored locally, in the extension's own storage. Its only network requests are for updates: copies installed from a `.vsix` ask GitHub once a day for the latest release, sending nothing about you (you can turn this off), and download it if you choose to update. On Windows it also asks PowerShell about running processes; see [How it works](#how-it-works).

![List view](media/screenshots/list-brand.png)

## Install

Install it from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=fourounces.agent-sessions-dashboard): in VS Code, open the Extensions view, search for **Agent Sessions Dashboard** and click **Install**. Or run:

```sh
code --install-extension fourounces.agent-sessions-dashboard
```

**Without the Marketplace** (Cursor, VSCodium and other editors that use Open VSX, or an offline machine): download the `.vsix` from the [latest release](https://github.com/kratner/agent-sessions-dashboard/releases/latest), then run `code --install-extension <file>.vsix`. Or in VS Code: Extensions view → **…** menu → **Install from VSIX…**

There are also one-line installers for Windows and macOS/Linux, which check the download against the SHA-256 checksum GitHub publishes; see [DEVELOPMENT.md](DEVELOPMENT.md#one-line-installers). To build from source instead, see [DEVELOPMENT.md](DEVELOPMENT.md#install-from-source).

**Upgrading from 0.6.x?** Earlier versions were installed by hand as `kratner.agent-workspace-dashboard`. The first time the new version starts, it removes that old copy and asks you to reload the window.

## Updates

- **From the Marketplace:** VS Code updates the extension by itself.
- **Installed from a `.vsix`:** about once a day the extension asks GitHub whether there's a newer release. If there is, a notification offers:
  - **Update:** installs it from the Marketplace, so VS Code keeps it updated from then on. If the Marketplace can't be reached, it downloads the release's `.vsix` instead and installs it only if it matches the SHA-256 checksum GitHub publishes for it; otherwise it stops and says why.
  - **Release Notes.**
  - **Skip This Version.**
- **Any time:** run **Agent Sessions: Check for Updates**.
- **To turn the daily check off,** set `agentSessions.checkForUpdates` to `false`. Marketplace installs skip it already.

## Getting started

1. Have [Claude Code](https://claude.com/claude-code) installed, as the VS Code extension, the CLI, or both.
2. Open the dashboard:
   - click the robot icon in the status bar, or
   - run **Agent Sessions: Open Dashboard** from the Command Palette.
3. Start or continue a Claude Code session. Its card appears within a few seconds.

## Searching

Type in the search box in the header, or press `/` or Ctrl+F (⌘F on macOS) to jump to it. Both views filter as you type.

- **What it searches:** each session's title, last prompt, folder path, where it runs (VS Code, Terminal, Background) and state (Waiting on you, Working, Idle, Ended). So `waiting` or `terminal` works as a query too.
- **Several words:** a session must contain all of them. `api waiting` finds the waiting session in the `api` folder.
- **Matches are highlighted.** In the List view, which has no prompt column, a prompt that matched appears under the title while you search.
- **Your search stays** when you switch tabs and come back. Press Esc in the box to clear it.
- **Scope:** search covers the sessions on the dashboard, meaning running ones plus those ended within `agentSessions.endedWithinHours`. To go further back, switch on History.

![Searching for "api"](media/screenshots/search-brand.png)

### Searching history

Click **History** next to the search box. While it's on, a **From history** section lists matching past sessions below the current ones, newest first.

- **What it searches:** every Claude Code session on this machine. For each one it reads the title, the folder and **every prompt you typed**, not just the last one. It doesn't search Claude's replies or tool output.
- **Results:** each row shows the session's title, folder, date and the line that matched. Click a row to resume the session, or use **Copy resume** to get the terminal command.
- **Subagents:** work done inside a subagent counts too. A match there appears under its parent session, as **↳ Found in subagent: *task description***, with the matching line. If several subagents match, the first one is shown with **+N more subagents** to expand. Untick **Include subagents** to search only top-level sessions.
- **Lots of matches:** up to 150 results all show. Above that you see the 25 most recent first, with a **Show all** button; the rest then load as you scroll. The `agentSessions.historyResultThreshold` setting moves that cut-off anywhere from 100 to 200.
- **Indexing:**
  - The first time you search history, the extension builds an index of your transcripts in the background, with a progress line. On a 1 GB history it took under 2 seconds.
  - After that it only reads what's new, and the index is cached between restarts.
  - It's stored only on this machine, in the extension's own storage.

![History search: past sessions below the current ones, with a match inside a subagent](media/screenshots/history-brand.png)

## Commands

| Command | What it does |
| --- | --- |
| **Agent Sessions: Open Dashboard** | Opens the dashboard in an editor tab, or brings it to the front |
| **Agent Sessions: Refresh Sessions** | Re-reads session files immediately |
| **Agent Sessions: Check for Updates** | Checks GitHub for a newer release and offers to install it |

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `agentSessions.appearance` | `brand` | `brand` is the Four Ounces look: warm ink, or warm paper with a light VS Code theme. `vscode` follows your color theme. |
| `agentSessions.endedWithinHours` | `24` | How far back to show ended sessions. `0` hides them. |
| `agentSessions.showStatusBar` | `true` | Show the working and waiting counts in the status bar |
| `agentSessions.historyResultThreshold` | `150` | History search: above this many matches (100–200), show the 25 most recent first, with a button to show all |
| `agentSessions.checkForUpdates` | `true` | Check GitHub for a newer release about once a day and offer to install it |

![The Four Ounces look with a light VS Code theme](media/screenshots/kanban-brand-light.png)

![Following the VS Code theme](media/screenshots/kanban-vscode.png)

## How it works

Claude Code keeps a small status file for each running session (`~/.claude/sessions/`) and a transcript for every session (`~/.claude/projects/`). The dashboard watches those files and turns each session into a card:

- **Title:** the session's own title.
- **Last prompt.**
- **Folder.**
- **Where it runs:** VS Code, Terminal or Background.
- **Last activity:** how long ago.

If you've set `CLAUDE_CONFIG_DIR`, the dashboard reads that folder instead of `~/.claude`.

To match sessions to running programs, it also looks up process information, read-only:

- **Which terminal a CLI session runs in:** the session's parent processes, so a click can bring that terminal to the front. On Windows it asks PowerShell (`Get-CimInstance Win32_Process`); on macOS and Linux it runs `ps`.
- **Windows only, whether a session is still running:** Windows reuses process IDs, so the dashboard asks PowerShell when each process started and compares that with the start time Claude Code recorded.

## Requirements

- VS Code 1.94 or newer.
- Claude Code on the same machine.
- Windows or macOS. Tested on both.

## Known limitations

- **The status files aren't an official API.** Claude Code's session status files are internal and undocumented, so a Claude Code update could change them. The dashboard reads them defensively: a status it doesn't recognise shows as Idle.
- **Sessions in other windows or terminals.** The dashboard can't switch to another VS Code window or a terminal. It tells you where the session is running instead.
- **Claude Code only, for now.** Other agents can be added as sources; see [DEVELOPMENT.md](DEVELOPMENT.md).

## Release notes and roadmap

- **Releases:** every version, with its `.vsix` and notes, is on the [Releases page](https://github.com/kratner/agent-sessions-dashboard/releases).
- **What changed:** see [CHANGELOG.md](CHANGELOG.md).
- **What's next:** see [ROADMAP.md](ROADMAP.md).

## Credits

A **Four Ounces** tool: the icon, colors and type come from the Four Ounces brand kit.

## License

[MIT](LICENSE) © 2026 Four Ounces. The bundled fonts, Inter and Archivo Black, are under the SIL Open Font License; see `licenses/`.
