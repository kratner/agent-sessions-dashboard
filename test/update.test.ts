import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import { sourceFromExtensionsJson } from '../src/update/installSource';
import { expectedSha256, isCheckDue, isNewer, sha256, vsixAsset } from '../src/update/releaseClient';

test('the daily check is due after a day, including in a window that stayed open', () => {
  const day = 86_400_000;
  const started = Date.UTC(2026, 9, 29, 5, 38); // VS Code started and checked
  assert.equal(isCheckDue(0, started), true, 'never checked');
  assert.equal(isCheckDue(started, started + 60_000), false, 'checked a minute ago');
  // The hourly look in a window left open: 0.6.1 came out 2026-10-30 05:16 UTC, and before
  // 0.6.2 nothing looked again after the startup check.
  assert.equal(isCheckDue(started, started + day - 3_600_000), false, '23 hours later');
  assert.equal(isCheckDue(started, started + day + 3_600_000), true, '25 hours later');
});

test('update check compares versions numerically, not as text', () => {
  assert.equal(isNewer('0.5.0', '0.4.0'), true);
  assert.equal(isNewer('v0.10.0', '0.9.9'), true, '10 > 9, and a leading v is ignored');
  assert.equal(isNewer('1.0.0', '0.99.99'), true);
  assert.equal(isNewer('0.4.0', '0.4.0'), false, 'same version is not an update');
  assert.equal(isNewer('0.3.9', '0.4.0'), false, 'older is not an update');
  assert.equal(isNewer('0.4', '0.4.0'), false, 'missing parts count as 0');
});

test('picks the .vsix out of a release', () => {
  const release = {
    tag_name: 'v1.0.0',
    html_url: '',
    assets: [
      { name: 'notes.txt', browser_download_url: '', size: 1 },
      { name: 'x-1.0.0.vsix', browser_download_url: 'u', size: 2 },
    ],
  };
  assert.equal(vsixAsset(release)?.name, 'x-1.0.0.vsix');
  assert.equal(vsixAsset({ ...release, assets: [] }), undefined);
});

test('sha256 matches the known digest of a file', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'awd-update-')), 'abc.txt');
  fs.writeFileSync(file, 'abc');
  assert.equal(await sha256(file), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('finds the old kratner copy to remove, and never removes itself', async () => {
  const { legacyCopies } = await import('../src/update/legacyId');
  const installed = (ids: string[]) => (id: string) => ids.includes(id);
  const both = installed(['kratner.agent-workspace-dashboard', 'fourounces.agent-workspace-dashboard']);
  assert.deepEqual(legacyCopies('fourounces.agent-workspace-dashboard', both), ['kratner.agent-workspace-dashboard']);
  assert.deepEqual(legacyCopies('FourOunces.agent-workspace-dashboard', both), ['kratner.agent-workspace-dashboard'], 'IDs are case-insensitive');
  assert.deepEqual(legacyCopies('fourounces.agent-workspace-dashboard', installed(['fourounces.agent-workspace-dashboard'])), [], 'nothing to remove');
  assert.deepEqual(legacyCopies('kratner.agent-workspace-dashboard', both), [], 'an old copy never removes itself');
});

test('install source comes from extensions.json: Marketplace installs skip the daily check', () => {
  const json = [
    { identifier: { id: 'fourounces.agent-workspace-dashboard' }, relativeLocation: 'fourounces.agent-workspace-dashboard-0.7.2', metadata: { source: 'gallery' } },
    { identifier: { id: 'kratner.agent-workspace-dashboard' }, relativeLocation: 'kratner.agent-workspace-dashboard-0.6.2', metadata: { source: 'vsix' } },
  ];
  assert.equal(sourceFromExtensionsJson(json, 'FourOunces.agent-workspace-dashboard', 'fourounces.agent-workspace-dashboard-0.7.2'), 'gallery');
  assert.equal(sourceFromExtensionsJson(json, 'kratner.agent-workspace-dashboard', 'kratner.agent-workspace-dashboard-0.6.2'), 'vsix');
  // Matched by location when relativeLocation is missing (Windows path).
  const byPath = [{ identifier: { id: 'a.b' }, location: { fsPath: 'C:\\Users\\k\\.vscode\\extensions\\a.b-1.0.0' }, metadata: { source: 'vsix' } }, { identifier: { id: 'a.b' }, relativeLocation: 'a.b-0.9.0', metadata: { source: 'gallery' } }];
  assert.equal(sourceFromExtensionsJson(byPath, 'a.b', 'a.b-1.0.0'), 'vsix');
  assert.equal(sourceFromExtensionsJson(json, 'someone.else', 'x'), 'unknown');
  assert.equal(sourceFromExtensionsJson({ not: 'an array' }, 'a.b', 'x'), 'unknown');
});

test('the fallback download needs a published SHA-256, or nothing is installed', () => {
  const hex = 'a'.repeat(64);
  const asset = (digest?: string | null) => ({ name: 'x.vsix', browser_download_url: 'https://example.invalid/x.vsix', size: 1, digest });
  assert.equal(expectedSha256(asset(`sha256:${hex.toUpperCase()}`)), hex);
  assert.throws(() => expectedSha256(asset(undefined)), /no SHA-256/);
  assert.throws(() => expectedSha256(asset(null)), /no SHA-256/);
  assert.throws(() => expectedSha256(asset('sha1:abc')), /no SHA-256/);
});
