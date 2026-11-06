// Builds a GitHub release's notes from CHANGELOG.md.
//   node scripts/release-notes.mjs 0.5.0 > notes.md
//
// Each changelog version is written as:
//   ## 0.5.0 (2026-10-23)
//   One-paragraph summary.
//   ![optional screenshot](https://raw.githubusercontent.com/<repo>/v0.5.0/...)
//   - the detailed changes
//   ### Upgrading            (optional, and any other ### subsections)
//
// The notes are: summary, release date, screenshot, "What's changed", subsections, a
// "Full changelog" compare link to the previous released version, then install and update
// instructions.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPO = 'kratner/agent-sessions-dashboard';
const HEADING = /^## (\d+\.\d+\.\d+)(?: \(([^)]+)\))?\s*$/;

/** Versions in CHANGELOG order (newest first), with each section's lines. */
export function parseChangelog(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const versions = [];
  for (const line of lines) {
    const m = HEADING.exec(line);
    if (m) versions.push({ version: m[1], date: m[2], lines: [] });
    else if (line.startsWith('## ')) versions.push({ version: undefined, lines: [] }); // not a version: ends the previous one
    else versions.at(-1)?.lines.push(line);
  }
  return versions.filter((v) => v.version);
}

/** Splits a section into blank-line-separated blocks and sorts them into the note's parts. */
function parts(lines) {
  const blocks = lines
    .join('\n')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const out = { summary: [], images: [], changes: [], subsections: [] };
  let seenChanges = false;
  let inSubsection = false;
  for (const block of blocks) {
    if (block.startsWith('### ')) inSubsection = true;
    if (inSubsection) out.subsections.push(block);
    else if (block.startsWith('![')) out.images.push(block);
    else if (block.startsWith('- ')) {
      seenChanges = true;
      out.changes.push(block);
    } else if (seenChanges) out.changes.push(block); // a note following the list belongs with it
    else out.summary.push(block);
  }
  return out;
}

/**
 * @param {string} changelog CHANGELOG.md text
 * @param {string} version e.g. "0.5.0"
 * @param {{ tags?: string[], repo?: string }} [opts] tags that exist, for the compare link
 */
export function releaseNotes(changelog, version, opts = {}) {
  const repo = opts.repo ?? REPO;
  const tags = new Set(opts.tags ?? []);
  const versions = parseChangelog(changelog);
  const i = versions.findIndex((v) => v.version === version);
  if (i < 0) return undefined;
  const { date, lines } = versions[i];
  const p = parts(lines);
  const previous = versions.slice(i + 1).find((v) => tags.has(`v${v.version}`));

  const sections = [];
  if (p.summary.length) sections.push(p.summary.join('\n\n'));
  if (date) sections.push(`*Released ${date}.*`);
  sections.push(...p.images);
  if (p.changes.length) sections.push(`### What's changed\n\n${p.changes.join('\n\n')}`);
  sections.push(...p.subsections);
  sections.push(
    previous
      ? `**Full changelog:** [v${previous.version}...v${version}](https://github.com/${repo}/compare/v${previous.version}...v${version})`
      : `**First release.** [Browse the code at v${version}](https://github.com/${repo}/tree/v${version})`,
  );
  sections.push(installFooter(repo, version));
  return sections.join('\n\n') + '\n';
}

function installFooter(repo, version) {
  const raw = `https://raw.githubusercontent.com/${repo}/main/scripts`;
  return `---

### Install or update

These install the **latest** release:

**Windows** (PowerShell):

\`\`\`powershell
irm ${raw}/install.ps1 | iex
\`\`\`

**macOS / Linux**:

\`\`\`sh
curl -fsSL ${raw}/install.sh | sh
\`\`\`

The installer verifies the download's SHA-256 checksum, then installs it with the \`code\` command.

**This version specifically:** download \`agent-sessions-dashboard-${version}.vsix\` below, then run \`code --install-extension agent-sessions-dashboard-${version}.vsix --force\`.

After installing or updating, run **Developer: Reload Window** in VS Code. From 0.5.0 on, the extension checks for new releases itself and offers to update.`;
}

function gitTags() {
  try {
    return execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

// CLI
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const version = process.argv[2];
  if (!version) {
    console.error('usage: node scripts/release-notes.mjs <version>');
    process.exit(1);
  }
  const changelog = readFileSync(fileURLToPath(new URL('../CHANGELOG.md', import.meta.url)), 'utf8');
  const notes = releaseNotes(changelog, version, { tags: gitTags() });
  if (!notes) {
    console.error(`CHANGELOG.md has no "## ${version} (date)" section`);
    process.exit(1);
  }
  process.stdout.write(notes);
}
