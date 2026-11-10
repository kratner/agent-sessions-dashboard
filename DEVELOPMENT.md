# Development

How to build, release and extend the Agent Sessions Dashboard. The steps are the same on Windows and macOS.

To *use* the extension, install it from the VS Code Marketplace (see the [README](README.md#install)). This page is for building it yourself.

## One-line installers

These download the latest release from GitHub, check it against the SHA-256 checksum GitHub publishes, and install it. Running one again updates.

- **Windows** (PowerShell): `irm https://raw.githubusercontent.com/kratner/agent-sessions-dashboard/main/scripts/install.ps1 | iex`
- **macOS / Linux**: `curl -fsSL https://raw.githubusercontent.com/kratner/agent-sessions-dashboard/main/scripts/install.sh | sh`

They live here rather than in the README because the README ships inside the extension package, and the Marketplace's content scan rejects packages whose docs contain download-and-run commands like these.

## Install from source

### Prerequisites

- [VS Code](https://code.visualstudio.com/) 1.94 or newer, with the `code` command on your PATH.
  - **macOS:** in VS Code, open the Command Palette and run **Shell Command: Install 'code' command in PATH**.
  - **Windows:** the installer adds it by default.
- [Node.js](https://nodejs.org/) 20 or newer, which includes npm.
- [Git](https://git-scm.com/).
- [Claude Code](https://claude.com/claude-code), CLI or VS Code extension.

### Install

```sh
git clone https://github.com/kratner/agent-sessions-dashboard.git
cd agent-sessions-dashboard
npm install
npm run package
code --install-extension agent-sessions-dashboard-0.5.2.vsix --force
```

`npm run package` type-checks the code, builds it and writes the `.vsix` file. Use the file name it prints; the version number changes with each release.

Then reload VS Code: Command Palette → **Developer: Reload Window**. Do this in every open window, or quit and reopen VS Code.

### Update

```sh
git pull
npm install
npm run package
code --install-extension agent-sessions-dashboard-<version>.vsix --force
```

Then reload the window.

### Uninstall

```sh
code --uninstall-extension fourounces.agent-sessions-dashboard
```

Versions up to 0.6.2 were published as `kratner.agent-workspace-dashboard`. Uninstall that ID too if
it's still installed.

## Releasing

Releases are built by GitHub Actions (`.github/workflows/release.yml`), not on a local machine:

1. Bump `"version"` in `package.json`.
2. Add a `## <version> (<date>)` section at the top of `CHANGELOG.md`. That section becomes the release notes (see [Writing the changelog entry](#writing-the-changelog-entry) below).
3. Commit and push to `main`.
4. Run `npm run release`.

`npm run release` (`scripts/release.mjs`) makes these checks, and only then tags `v<version>` and pushes the tag:

- the working tree is clean
- you're on `main`, in sync with `origin`
- the tag doesn't exist yet
- the changelog has the section
- the tests pass

The tag starts the Release workflow. It checks that the tag matches `package.json`, runs `npm ci`, `npm test` and `npm run package`, publishes the `.vsix` to the VS Code Marketplace, then creates the GitHub release:

- **Attached:** the `.vsix`. GitHub publishes a SHA-256 for it.
- **Notes:** built from the changelog by `scripts/release-notes.mjs`. `npm run release` prints a preview before it tags.

VS Code updates Marketplace installs itself. Copies installed from a `.vsix` pick the release up through their daily update check (`src/update/`), which installs it from the Marketplace (falling back to the checksum-verified `.vsix`), and `scripts/install.ps1` / `install.sh` install it fresh.

**Marketplace publishing** uses Trusted Publishing (OIDC), so no access token is stored anywhere. The `fourounces` publisher at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage) has a Trusted Publishing policy for owner `kratner`, repository `agent-sessions-dashboard`, workflow `release.yml` (named `agent-sessions-release`). If the repository is ever renamed again, add a policy for the new name before releasing. The workflow needs `permissions: id-token: write`. A published version number can never be reused, so a bad release is fixed by releasing the next version.

**Testing a build before it's public:** install the `.vsix` that `npm run package` makes. Give it a version above the published one, or VS Code may auto-update over it from the Marketplace.

### Writing the changelog entry

Each version's `CHANGELOG.md` section is written in this order:

```markdown
## 0.6.0 (2026-11-02)

One or two sentences: what this release lets you do, for someone deciding whether to update.

![Optional screenshot](https://raw.githubusercontent.com/kratner/agent-sessions-dashboard/v0.6.0/media/screenshots/<file>.png)

- **The details**, one bullet per change.

### Upgrading

Anything a user has to do or know after updating. Leave this section out if there's nothing.
```

`scripts/release-notes.mjs` turns that into the release page:

1. the summary
2. "Released \<date\>"
3. the screenshot
4. **What's changed**
5. any `###` sections, such as Upgrading
6. a **Full changelog** link comparing with the previous released version
7. install and update instructions

Pin screenshot URLs to the version's tag (`/v0.6.0/` rather than `/main/`), so an old release never shows a newer UI.

### Releasing an older commit by hand

Backfilled releases don't run the workflow, because the commits predate it. For each one:

1. Build the `.vsix` from a `git worktree` at that commit.
2. Generate the notes with `node scripts/release-notes.mjs <version>`.
3. Create the release with `gh release create v<version> <vsix> --target <full sha> --latest=false --notes-file <notes>`.

v0.1.0 through v0.4.0 were released this way.

### Troubleshooting

- **`code` is "not recognized" right after installing it.** VS Code's built-in terminal keeps the PATH VS Code started with. Quit every VS Code window and reopen, or use a standalone terminal.
- **The dashboard is empty.**
  - Check that `~/.claude` exists, or `CLAUDE_CONFIG_DIR` if you set it.
  - Check that a Claude Code session is running.
  - Ended sessions only show for `agentSessions.endedWithinHours`, 24 hours by default.

## Build

```sh
npm run build        # dev build with sourcemaps
npm run watch        # rebuild on change
npm run production   # typecheck + clean minified build + dependency-leak check
npm run package      # production build, then a .vsix
npm test             # unit tests (history index, paging), on synthetic transcripts
```

Press **F5** to launch an Extension Development Host.

One esbuild script (`esbuild.mjs`) builds both bundles:

- the extension host: Node, CommonJS
- the webview: browser, React

The production build fails if either bundle leaves an import unbundled. The host may only import `vscode` and Node built-ins; the webview may import nothing.

### Previewing the look

`preview/index.html` loads the built webview in a normal browser with sample sessions, so you can check the design without VS Code. Run `npm run build` first. URL options:

- `?appearance=vscode` shows the theme-following look (with VS Code Dark Modern colors).
- `?theme=light` simulates a light VS Code theme, which switches the brand look to paper.
- `?view=list` shows the List view.
- `?q=api` fills the search box.
- `&history=1` switches History on, with invented past sessions. `q=deploy` returns 340 of them, to show the short list. `q=breaking` matches only inside subagents.
- `&indexing=1` shows the indexing progress line.

The README screenshots in `media/screenshots/` are taken from this page.

### Demo video

`npm run build && npm run demo-video` records the demo from this page, inside a VS Code-like frame (`preview/vscode-frame.html`), so it only ever shows the sample sessions. It writes:

- `release/agent-sessions-demo.mp4`: a silent 1920×1080, 34-second H.264 clip with captions, for YouTube (not committed).
- `media/screenshots/demo.gif`: the same clip at 960 px and 12 fps, shown at the top of the README and the Marketplace page.

Needs `ffmpeg` with libx264 on your PATH, and Playwright's Chromium (`npx playwright install chromium`).

## Architecture

| File | Role |
| --- | --- |
| `src/extension.ts` | Activation, commands, status bar |
| `src/sessionStore.ts` | Merges all sources into one sorted list; fires only when it changes |
| `src/sources/SessionSource.ts` | The interface every agent system implements |
| `src/sources/claudeCode.ts` | Reads `~/.claude/sessions/*.json`, checks the process is alive, maps the status |
| `src/sources/claudeTranscripts.ts` | Reads titles and last prompts from transcripts; after the first read it only reads what was appended |
| `src/dashboardPanel.ts` | The webview tab; stores the active view in `workspaceState`; answers history searches |
| `src/history/historyIndex.ts` | History search index over every transcript and subagent transcript. Typed prompts only, incremental reads, cached to disk. No `vscode` imports, so it's unit-testable |
| `src/update/` | Update check against GitHub Releases: `releaseClient.ts` (no `vscode` imports; version compare, download, SHA-256) and `updater.ts` (daily check, notification, install) |
| `scripts/` | `install.ps1` / `install.sh` (one-line installers), `release.mjs`, `release-notes.mjs` (CHANGELOG → release notes) |
| `src/history/historyService.ts` | VS Code glue around the index: background refresh, throttled progress, paged queries |
| `src/webview/` | React UI: `ViewManager`, `KanbanView`, `ListView`, `HistoryPanel`, `viewRegistry.ts` |
| `test/` | `node:test` unit tests, bundled with esbuild by `test/run.mjs` |

### Adding an agent system

1. Implement `SessionSource`. It converts that system's records into `AgentSession` cards.
2. Register it in the `SessionStore` list in `src/extension.ts`.

The views don't change.

### Adding a view

1. Create a component in `src/webview/components/` that takes `ViewProps`.
2. Add one entry to `VIEWS` in `src/webview/viewRegistry.ts`.

Don't change existing view ids. They're what's saved as each workspace's active view.

## Branding

The icon, colors and type come from the Four Ounces brand kit (`kratner/four-ounces-brand`). Products copy from the kit and never redefine its values; change them there first.

- **Colors:** the `brand` appearance in `src/webview/styles.css` uses the kit's tokens: warm ink, or warm paper when VS Code has a light theme (`body.vscode-light`). Old Gold `#C9A24A` is a fill (primary toggles, the waiting pill, search highlights); gold as text or line work uses gold-ink, which is `#7A5C14` on paper. Status colors keep their meaning.
- **Fonts:** `src/webview/fonts/` holds the kit's Inter (text) and Archivo Black (display) woff2 files, with their licenses in `licenses/`.
- **Marks:** `src/webview/components/BrandMarks.tsx` holds the product's board glyph and a copy of the Four Ounces mark, shown in the credit line under the board.
- **Icon working files:** they're in `branding/`.
  - `npm run brand` re-renders the icon concepts and writes `media/icon.png`.
  - `npm run brand:compare` checks a vector trace against its source image.
