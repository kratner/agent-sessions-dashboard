# Roadmap

## Shipped

| Version | Date | What |
| --- | --- | --- |
| 0.1.0 | 2026-10-21 | Kanban and List views of Claude Code sessions, live updates, click to open or resume |
| 0.2.x | 2026-10-22 | KR brand appearance, extension page, diagnostics log |
| 0.3.0 | 2026-10-23 | Search across the sessions on the dashboard |
| 0.4.0 | 2026-10-23 | Search the full session history, including subagents |
| 0.5.0 | 2026-10-23 | GitHub Releases built by Actions, one-line installers, in-extension update check |
| 0.6.0 | 2026-10-25 | Four Ounces brand: ink and paper looks, Old Gold, Inter, new icon |
| 0.7.1 | 2026-11-05 | Prepared for the VS Code Marketplace; updates install from it (first published in 0.7.3) |
| 0.7.2 | 2026-11-05 | Marketplace installs skip the GitHub check; fallback download requires its checksum; tested on macOS too |
| 0.7.3 | 2026-11-06 | Renamed Agent Sessions Dashboard, on the Marketplace as `fourounces.agent-sessions-dashboard`; agent-neutral listing |
| 0.7.4 | 2026-11-06 | Settings, command IDs and the GitHub repository renamed to match; old settings copied over |

The "Waiting on you" column was confirmed working in real use on 2026-10-23. Claude Code's status files do report sessions waiting for approval, so no hook is needed.

## Next

- [ ] Optionally publish to [Open VSX](https://open-vsx.org) as well, for Cursor and VSCodium users.
- [ ] Verified-publisher badge for Four Ounces: possible once the extension has been on the Marketplace for 6 months. The Marketplace blocked fourounces.live in the publisher profile, so the domain to verify is still open.

## 0.4.0: search your full session history (shipped)

Search extends from the sessions on the dashboard to every past Claude Code session on the machine, so you can find the session where you worked on something weeks ago and pick it back up.

### What shipped

- **History toggle:** a **History** button next to the search box. With it off, search is exactly what it was in 0.3.0.
- **What it matches:** every transcript in `~/.claude/projects/` (or `CLAUDE_CONFIG_DIR`). For each session, that means its title, its folder and every prompt the user typed. It doesn't match Claude's replies or tool output, which are most of a transcript's bytes and would bury the useful matches.
- **Where results appear:** in a **From history** section below the current results, newest first. Each result shows the line that matched; click it to resume, or use *Copy resume*.
- **Changed from the plan:** results were planned as Ended cards. A common word can match hundreds of past sessions, which would swamp the Ended column, so they got their own section instead. Sessions already on the dashboard aren't repeated there.

### Large result sets: short list first

- **Up to 150 matches:** all of them show.
- **More than 150:** you get the 25 most recent first, with "Showing 25 of 340 matches, most recent first" and a **Show all 340 results** button.
- **After Show all:** the first 150 appear, and the rest load in pages of 100 as you scroll. A common word never sends thousands of results to the webview at once.
- **A new or narrower query** goes back to the short list.
- **Setting:** `agentSessions.historyResultThreshold` (default 150, allowed 100–200). The short list size, 25, is fixed.

### Subagent sessions: shown under their parent

Claude Code stores each subagent's transcript under its parent session:

- **The transcript:** `projects/<folder>/<parent session id>/subagents/agent-<id>.jsonl`. Every record in it carries the parent's session id and `isSidechain: true`.
- **A `.meta.json` beside it**, with:
  - the subagent's short task description
  - its agent type
  - its nesting depth (`spawnDepth`)
  - whether it finished

How subagent matches are shown:

- **One result per parent session**, with the parent's title, folder and date.
- **"↳ Found in subagent: *description* (agent type)"**, with the subagent's matching line. If there's no description, it falls back to the agent type, then to the subagent's first prompt.
- **Several matching subagents** show the first, with "+N more subagents" to expand the rest.
- **Matches in both** the parent and a subagent show both.
- **Nested subagents** are labelled "subagent of a subagent", and still roll up to the top-level session.
- **Opening or resuming** a result acts on the parent session.
- **"Include subagents"** (on by default) limits results to top-level matches when turned off.

Caveat: `.meta.json` is internal to Claude Code and undocumented, like the session status files. It's read defensively. If its format changes, the label falls back to "subagent".

### How it works

- **The index:** `src/history/historyIndex.ts` has no `vscode` imports, so it runs under plain Node for tests and benchmarks. For each transcript it keeps:
  - session id and agent id
  - folder
  - titles
  - the prompts the user typed, with timestamps
  - size, modification time, and how far it has read
- **The read:** cheap byte checks pick out title lines and typed user messages, and only those get parsed as JSON. Assistant output, tool results and attachments are skipped without parsing.
- **Incremental, line-safe reads:** after the first scan, only bytes appended since the last read are read. A half-written last line is left until it's complete. A transcript that shrinks is re-read from the start, and a deleted one is dropped.
- **The cache:** in the extension's global storage (`history-index-v1.json`). A restart picks up where it left off.
- **Paging:** `HistoryService` refreshes the index in the background on each query and answers in pages. Indexing progress is sent to the dashboard, which re-runs the query when indexing finishes.

### Measured

On this machine's real history (86 transcripts, 1.09 GB, the largest 253 MB):

| | Target | Result |
| --- | --- | --- |
| First full index | under 10 s | **1.4 s** |
| Start from cache | under 1 s | **17 ms** |
| Worst event-loop stall while indexing | stays responsive | **28 ms** |
| One search | n/a | 1–2 ms |
| Cache size | n/a | 268 KB |

### Done when

- [x] With History on, a word from an older session's prompt finds that session. Verified against the real index from the command line.
- [ ] Clicking or *Copy resume* on a history result resumes the right session in the right folder. To confirm in VS Code; this path reuses the code that ended-session cards already use.
- [x] The performance targets above.
- [x] More than 150 matches shows the 25 most recent first, and **Show all** pages through the rest. Browser test: 340 rows, no duplicates, no errors.
- [x] A word found only in a subagent's transcript finds the parent session, with the subagent named and its matching line shown. Unit test, plus 5 real queries with subagent matches.
- [x] A deleted transcript, or one still being written, doesn't break the index (unit tests).
- [x] History off behaves exactly like 0.3.0.
- [x] README, CHANGELOG and the preview harness cover it, with neutral sample data only.

## Later

- **More agent systems.** Add `SessionSource` implementations for other agents with VS Code extensions, such as Copilot or ChatGPT.
- **Session actions.** Stop, archive or rename a session from its card.
- **History search over Claude's replies too**, as an opt-in, if prompt-only search turns out to miss things.
