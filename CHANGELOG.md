# Changelog

Each version starts with a short summary, then the details. The same text becomes that version's notes on the [Releases page](https://github.com/kratner/agent-workspace-dashboard/releases).

## 0.7.2 (2026-11-05)

Updates are stricter and better explained. Marketplace installs no longer run the daily GitHub check, and a download from GitHub is installed only when it matches its published checksum.

- **Marketplace installs skip the daily check.** VS Code already updates them; the check still runs for copies installed from a `.vsix`, and **Check for Updates** works for everyone.
- **The checksum is required.** If GitHub publishes no SHA-256 checksum for a release's `.vsix`, the fallback download is refused rather than installed unverified.
- **The README explains the process lookups:** PowerShell on Windows (and `ps` on macOS) to find a CLI session's terminal and to catch reused process IDs.
- **Tested on Windows and macOS.** The README no longer says Windows only.

## 0.7.1 (2026-11-05)

Agent Workspace Dashboard is on the VS Code Marketplace, published by Four Ounces. Accept this update once; it removes the old hand-installed copy, and from then on VS Code keeps the extension up to date.

- **On the VS Code Marketplace**, as `fourounces.agent-workspace-dashboard`. Versions up to 0.6.2 were
  `kratner.agent-workspace-dashboard`, which VS Code treats as a different extension: the first time this
  version starts, it removes the old copy and asks you to reload the window.
- **Update** now installs from the Marketplace, so a hand-installed copy becomes one VS Code keeps updated. If
  the Marketplace can't be reached, it falls back to the checksum-verified download from GitHub.
- Releases publish to the Marketplace and GitHub together, from the same workflow.
- **The Four Ounces mark at the bottom links to fourounces.live**, opening in your browser, as MingTab's About page does.
- 0.7.0 was tagged but never published: the Marketplace's content scan rejected it over the one-line installer
  commands in the README. Those now live in DEVELOPMENT.md, which isn't packaged.

## 0.6.2 (2026-10-30)

Update notices now reach VS Code windows that stay open for days. Install this one by hand; after it, new versions find you.

- **Update notices reach windows that stay open.** The daily check for a new release only ran when VS Code started, so a window left open for days never heard about one. It now also looks every hour whether a day has passed since the last check.

## 0.6.1 (2026-10-30)

A new icon that stands out on dark backgrounds, shown in the dashboard's header too. Nothing else changes.

- **Icon on its own ground.** The board icon is now cream on a lapis-blue tile instead of gold on black, so Agent Workspace stands out on dark backgrounds and next to the other Four Ounces tools (MingTab is a red seal).
- **Same icon in the dashboard.** The top-left of the board shows that lapis icon, as on [fourounces.live](https://fourounces.live), instead of a bare gold line drawing.

## 0.6.0 (2026-10-25)

Agent Workspace is now a Four Ounces project, and its look comes from the Four Ounces brand. The dashboard works the same way.

![The Four Ounces look: warm ink, with Old Gold marking the sessions waiting on you](https://raw.githubusercontent.com/kratner/agent-workspace-dashboard/v0.6.0/media/screenshots/kanban-brand.png)

- **New colors.** Warm ink replaces black, and Old Gold replaces the yellow for sessions waiting on you, the History toggle and search highlights.
- **A light version.** When VS Code uses a light theme, the dashboard switches to warm paper, with a darker gold for gold text so it stays readable.
- **New type.** Text is set in Inter; headings stay in Archivo Black. Both are bundled, so nothing loads from the web.
- **New icon.** The board icon, drawn as one gold line on the ink tile.
- **Credit line.** A small "Four Ounces" line under the board.

### Upgrading

- Nothing to change. If you set `agentWorkspace.appearance` to `vscode`, it still follows your color theme.

## 0.5.2 (2026-10-24)

Fixes a board that stopped updating after you clicked a session to open it.

- **The board keeps updating after you open a session.** Clicking a session, typically an Ended one, opens it in a Claude Code tab. The dashboard then stopped receiving updates until you closed and reopened it, so a session that started waiting on you didn't appear. It stopped because updates were skipped whenever VS Code reported the dashboard as hidden, even when it was still on screen.
  - Updates are now always sent.
  - The latest state is also resent whenever the dashboard comes back into view.
- **The Agent Workspace log** notes when the dashboard is shown or hidden, to make reports like this easier to diagnose.

## 0.5.1 (2026-10-23)

Waiting cards now say what the session is waiting for, and clicking a session running in a terminal takes you to that terminal. Sessions can no longer look alive just because Windows gave their old process ID to another program.

- **What a session is waiting for.** Waiting cards and list rows show Claude Code's reason, such as "Waiting for: permission prompt" or "Waiting for: dialog open". The reason is searchable too.
- **"No prompts yet"** on sessions that have been opened but never used. They used to show only a placeholder name like `my-project-3f`.
- **Clicking a terminal session goes to its terminal.** For a Claude Code CLI session running in one of the window's terminals, clicking the card brings that terminal to the front. For a session in a terminal outside VS Code, the message says so and gives its process ID.
- **Reused process IDs are caught.** Windows recycles process IDs, so an old session file could point at an unrelated program and keep a long-finished session on the board. The dashboard now compares each process's start time with the one Claude Code recorded. A mismatch counts as ended. Each process ID is checked once.

## 0.5.0 (2026-10-23)

Install the extension with one line, and get new versions without leaving VS Code. Every version is now published on the Releases page, built by GitHub Actions.

- **Releases.** Each version is published on the repository's [Releases page](https://github.com/kratner/agent-workspace-dashboard/releases), with its `.vsix` and notes. GitHub Actions builds each release from its version tag.
- **One-line install** for Windows (PowerShell) and macOS/Linux (see DEVELOPMENT.md). It downloads the latest release, verifies its SHA-256 checksum and installs it. Running it again updates.
- **Updates from inside VS Code.**
  - About once a day the extension checks for a newer release, and offers **Update**, **Release Notes** or **Skip This Version**.
  - **Update** downloads it, verifies the checksum, installs it and offers to reload.
  - There's also a **Check for Updates** command, and the setting `agentWorkspace.checkForUpdates` turns the daily check off.

### Upgrading

- This is the last version you need to install by hand. From here, the extension tells you when a new version is out and installs it for you.
- The daily check is the extension's only network request: it asks GitHub for the latest release. To opt out, set `agentWorkspace.checkForUpdates` to `false`.

## 0.4.0 (2026-10-23)

Find any past Claude Code session, not just the ones on the board. Switch on **History** and search every session on the machine, including work done by subagents, then resume it with a click.

![History search: past sessions below the current ones, with a match found inside a subagent](https://raw.githubusercontent.com/kratner/agent-workspace-dashboard/v0.4.0/media/screenshots/history-brand.png)

- **History search.** A **History** toggle next to the search box also searches every past Claude Code session on the machine.
  - It matches each session's title, folder and every prompt you typed, but not Claude's replies or tool output.
  - Matching past sessions appear in a **From history** section below the current ones, newest first, with the matching line. Click to resume, or **Copy resume**.
- **Subagents:** matches inside subagent transcripts appear under their parent session.
  - Each shows "↳ Found in subagent: *description*" and the matching line. "+N more subagents" expands the rest, and nested subagents are labelled.
  - **Include subagents** turns them off.
- **Large result sets:** up to 150 matches all show. Above that you get the 25 most recent and **Show all N results**, after which the rest load as you scroll. The new setting `agentWorkspace.historyResultThreshold` (100–200, default 150) moves the cut-off.
- **The index:** built in the background on first use, read incrementally afterwards, and cached in the extension's storage.
  - On a 1.09 GB history of 86 transcripts, the first build took 1.4 s and a cached start 17 ms.
- `npm test` runs the new history tests.

### Upgrading

The first time you search with History on, the extension builds its index. You'll see "Indexing history… n of m" for a second or two, and after that it's instant.

## 0.3.0 (2026-10-23)

Search the dashboard. Type in the header to filter either view by title, prompt, folder, where a session runs or its state, with matches highlighted.

![Searching for "api": matching sessions with the term highlighted](https://raw.githubusercontent.com/kratner/agent-workspace-dashboard/v0.3.0/media/screenshots/search-brand.png)

- **Search.** A search box in the header filters the Kanban and List views as you type.
  - It matches title, last prompt, folder, where the session runs and state.
  - With several words, a session must contain all of them.
  - Matches are highlighted, and the List view shows a matching prompt under the title.
  - Press `/` or Ctrl+F (⌘F) to jump to the box, and Esc to clear it.
  - The search is kept when you switch tabs.
- The "waiting" count in the header is only filled yellow when something is waiting.

## 0.2.2 (2026-10-22)

Fixes for the extension page and the dashboard log, and the repository is now public under the MIT license.

- The images on the extension's Details page now link to the GitHub repository, because VS Code doesn't load relative image paths there.
- The dashboard no longer sends updates while its tab is hidden. It gets fresh state when you return to it, so the log no longer fills with "not delivered" errors.
- Licensed under MIT.

## 0.2.1 (2026-10-22)

The dashboard gets the KR look (black panel, yellow for sessions waiting on you, Archivo type), plus a log for troubleshooting. The editor-theme look is still available as a setting.

![The KR brand appearance: the Kanban board in black and yellow](https://raw.githubusercontent.com/kratner/agent-workspace-dashboard/v0.2.1/media/screenshots/kanban-brand.png)

- **KR brand appearance, now the default:**
  - black panel with the KR mark
  - Archivo Black headings
  - yellow reserved for sessions waiting on you
  - white, steel and iron for working, idle and ended
- **New setting** `agentWorkspace.appearance`: `brand`, or `vscode` to follow your color theme.
- **Icons:** the extension icon and the dashboard tab icon use the KR colors.
- **Extension page:** author, screenshots, features, commands and settings.
- **Agent Workspace log** in the Output panel. It records the dashboard's startup, the messages between the extension and the dashboard, and any error, including errors inside the dashboard itself.
- **Fix:** the dashboard now starts listening for messages before it loads.

0.2.0 was an internal build. Its changes (the brand appearance, the setting and the extension page) are included here.

### Upgrading

If you use a light color theme, set `agentWorkspace.appearance` to `vscode`. The brand yellow is hard to read on light backgrounds.

## 0.1.0 (2026-10-21)

The first version: every Claude Code session you have running, on a Kanban board or in a list, grouped by state so you can spot the one that's waiting on you.

- First version: Kanban and List views of Claude Code sessions, grouped by state (Waiting on you, Working, Idle, Ended).
- Live updates from Claude Code's session files, with a status bar count of working and waiting sessions.
- Click a card to open or resume its session; **Copy resume** for ended sessions.
- The active view is remembered per workspace.
