// Bundles test/*.test.ts with esbuild and runs them with Node's built-in test runner.
//   npm test
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const outdir = 'out-test';
rmSync(outdir, { recursive: true, force: true });
const entryPoints = readdirSync('test')
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => join('test', f));
await esbuild.build({ entryPoints, outdir, bundle: true, platform: 'node', format: 'cjs', target: 'node20', outExtension: { '.js': '.cjs' }, logLevel: 'warning',
  // Code under test that imports 'vscode' gets a small stand-in (test/vscodeStub.ts).
  alias: { vscode: './test/vscodeStub.ts' } });

const files = readdirSync(outdir).map((f) => join(outdir, f));
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
