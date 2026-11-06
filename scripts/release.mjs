// npm run release
// Checks that the version in package.json is ready to release, then tags it and pushes the
// tag. The Release workflow on GitHub builds, tests and publishes it from there.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const tag = `v${version}`;
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const fail = (msg) => {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
};

console.log(`Releasing ${tag}`);

if (git('status', '--porcelain')) fail('Commit or stash your changes first; the working tree is not clean.');
if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') fail('Releases are cut from main.');
git('fetch', '--quiet', '--tags', 'origin');
if (git('rev-parse', 'HEAD') !== git('rev-parse', 'origin/main')) fail('main is not in sync with origin/main. Push or pull first.');
if (git('tag', '--list', tag)) fail(`${tag} already exists. Bump "version" in package.json.`);

const notes = spawnSync(process.execPath, ['scripts/release-notes.mjs', version], { encoding: 'utf8' });
if (notes.status !== 0) fail(`CHANGELOG.md needs a "## ${version} (date)" section: a summary paragraph, then the changes.`);
console.log(`\nRelease notes preview:\n${'-'.repeat(60)}\n${notes.stdout.split('\n---\n')[0].trim()}\n${'-'.repeat(60)}`);

console.log('Running tests…');
// One command string: npm is npm.cmd on Windows, so it needs a shell, and passing an args array
// with shell: true is deprecated.
const tests = spawnSync('npm test', { stdio: 'inherit', shell: true });
if (tests.status !== 0) fail('Tests failed.');

git('tag', '-a', tag, '-m', tag);
git('push', 'origin', tag);

console.log(`
✔ Pushed ${tag}. GitHub Actions is building the release:
  https://github.com/kratner/agent-sessions-dashboard/actions
When it finishes (about two minutes) it appears at:
  https://github.com/kratner/agent-sessions-dashboard/releases/tag/${tag}`);
