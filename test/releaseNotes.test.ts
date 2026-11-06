import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseChangelog, releaseNotes } from '../scripts/release-notes.mjs';

const changelog = `# Changelog

Intro text about the changelog.

## 0.3.0 (2026-03-01)

Search everything.

![Search](https://example.com/v0.3.0/search.png)

- Added search.
  - With highlights.
- Faster startup.

An internal build's changes are included here.

### Upgrading

Reload the window.

## 0.2.0 (2026-02-01)

- Untagged build.

## 0.1.0 (2026-01-01)

- First version.
`;

test('parses versions newest first, with dates', () => {
  const v = parseChangelog(changelog);
  assert.deepEqual(v.map((x) => `${x.version} ${x.date}`), ['0.3.0 2026-03-01', '0.2.0 2026-02-01', '0.1.0 2026-01-01']);
});

test('notes: summary, date, screenshot, changes, subsections, compare link, install', () => {
  const notes = releaseNotes(changelog, '0.3.0', { tags: ['v0.1.0', 'v0.3.0'], repo: 'me/repo' })!;
  const order = [
    'Search everything.',
    '*Released 2026-03-01.*',
    '![Search](https://example.com/v0.3.0/search.png)',
    "### What's changed",
    '- Added search.',
    "An internal build's changes are included here.",
    '### Upgrading',
    'Reload the window.',
    '**Full changelog:**',
    '### Install or update',
  ].map((s) => notes.indexOf(s));
  assert.ok(order.every((i) => i >= 0), `every part present: ${order}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'parts in order');
  assert.match(notes, /compare\/v0\.1\.0\.\.\.v0\.3\.0/, 'compares with the previous version that has a tag (0.2.0 has none)');
  assert.match(notes, /agent-sessions-dashboard-0\.3\.0\.vsix/, 'manual install names this version');
  assert.doesNotMatch(notes, /Intro text/, 'text before the first version is not part of any release');
});

test('the oldest release links to its code instead of a comparison', () => {
  const notes = releaseNotes(changelog, '0.1.0', { tags: ['v0.1.0'], repo: 'me/repo' })!;
  assert.match(notes, /\*\*First release\.\*\* \[Browse the code at v0\.1\.0\]\(https:\/\/github\.com\/me\/repo\/tree\/v0\.1\.0\)/);
  assert.doesNotMatch(notes, /Full changelog/);
});

test('a version without a summary still gets its changes; unknown version gives undefined', () => {
  const notes = releaseNotes(changelog, '0.2.0', { tags: [] })!;
  assert.ok(notes.startsWith('*Released 2026-02-01.*'));
  assert.match(notes, /### What's changed\n\n- Untagged build\./);
  assert.equal(releaseNotes(changelog, '9.9.9'), undefined);
});
