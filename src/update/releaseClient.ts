import { createHash } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { rm } from 'fs/promises';
import * as https from 'https';

// GitHub Releases client for the update check. No `vscode` imports, so it can be tested
// against the real repository from plain Node.

export const REPO = 'kratner/agent-sessions-dashboard';
const USER_AGENT = 'agent-sessions-dashboard-updater';

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  /** "sha256:<hex>", published by GitHub for each release file. */
  digest?: string | null;
}

export interface Release {
  tag_name: string;
  html_url: string;
  assets: ReleaseAsset[];
}

/** True when version `a` is newer than `b` (x.y.z, optional leading "v"). */
export function isNewer(a: string, b: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  }
  return false;
}

/** True when the daily check is due: never checked, or the last check was over a day ago. */
export function isCheckDue(lastCheck: number, now: number, dayMs = 86_400_000): boolean {
  return now - lastCheck > dayMs;
}

export function vsixAsset(release: Release): ReleaseAsset | undefined {
  return release.assets.find((a) => a.name.endsWith('.vsix'));
}

export async function latestRelease(repo = REPO): Promise<Release> {
  const body = await request(`https://api.github.com/repos/${repo}/releases/latest`, { Accept: 'application/vnd.github+json' });
  return JSON.parse(body.toString('utf8')) as Release;
}

/**
 * Downloads the asset to `dest` and checks it against GitHub's published SHA-256. Throws, leaving
 * nothing at `dest`, if GitHub publishes no checksum or the download doesn't match it.
 */
export async function downloadVerified(asset: ReleaseAsset, dest: string): Promise<void> {
  const expected = expectedSha256(asset);
  await downloadTo(asset.browser_download_url, dest);
  const actual = await sha256(dest);
  if (actual !== expected) {
    await rm(dest, { force: true });
    throw new Error(`Checksum mismatch for ${asset.name}: the download is not the published file.`);
  }
}

/** The SHA-256 GitHub publishes for the asset. Throws if there isn't one: nothing unverified is installed. */
export function expectedSha256(asset: ReleaseAsset): string {
  const m = /^sha256:([0-9a-f]{64})$/i.exec(asset.digest ?? '');
  if (!m) throw new Error(`GitHub publishes no SHA-256 checksum for ${asset.name}, so it can't be verified and won't be installed.`);
  return m[1].toLowerCase();
}

export function sha256(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

function get(url: string, headers: Record<string, string>, redirects = 5): Promise<import('http').IncomingMessage> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': USER_AGENT, ...headers }, timeout: 30_000 }, (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location && redirects > 0) {
          res.resume();
          resolve(get(new URL(res.headers.location, url).toString(), headers, redirects - 1));
        } else if (status !== 200) {
          res.resume();
          reject(new Error(`GET ${url} -> HTTP ${status}`));
        } else {
          resolve(res);
        }
      })
      .on('timeout', function (this: import('http').ClientRequest) {
        this.destroy(new Error(`GET ${url} timed out`));
      })
      .on('error', reject);
  });
}

async function request(url: string, headers: Record<string, string> = {}): Promise<Buffer> {
  const res = await get(url, headers);
  const chunks: Buffer[] = [];
  for await (const chunk of res) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

async function downloadTo(url: string, dest: string): Promise<void> {
  const res = await get(url, {});
  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(dest);
    res.pipe(out);
    out.on('finish', () => resolve());
    out.on('error', reject);
    res.on('error', reject);
  });
}
