// Agent Sessions demo video: the real built webview (dist/) inside a VS Code-like frame
// (preview/vscode-frame.html), showing the preview's made-up sample sessions, never real ones.
// Captioned in the Four Ounces style and assembled with ffmpeg, like MingTab's promo video.
//
//   npm run build && npm run demo-video
//
// Writes release/agent-sessions-demo.mp4 (silent 1920x1080 H.264, for YouTube) and
// media/screenshots/demo.gif (960px wide, for the README and the Marketplace page).
// Needs ffmpeg with libx264 on PATH. Frames are full-resolution screenshots
// (1280x720 at 1.5x = 1920x1080), held for set times and cross-faded between beats,
// so the UI stays sharp (Playwright's own screen recording is soft).
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'release', 'agent-sessions-demo.mp4');
const gif = path.join(root, 'media', 'screenshots', 'demo.gif');
const work = path.join(os.tmpdir(), `asd-demo-${process.pid}`);
if (!existsSync(path.join(root, 'dist', 'webview.js'))) throw new Error('Run npm run build first.');
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
mkdirSync(path.dirname(out), { recursive: true });

const FPS = 30;
const FADE = 0.5;

// Brand art: the product icon and the Four Ounces mark (geometry from BrandMarks.tsx).
const icon = `data:image/png;base64,${readFileSync(path.join(root, 'media', 'icon.png')).toString('base64')}`;
const enso = readFileSync(path.join(root, 'src', 'webview', 'components', 'BrandMarks.tsx'), 'utf8').match(/const ENSO = '([^']+)'/)[1];
const mark = `<svg viewBox="0 0 104 72" width="208" height="144"><g fill="none" stroke="#EDE8DE" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M16 12 L4 44 H32 M26 26 V62"/><path d="M76 32 H98 L76 62 H98"/></g><g transform="translate(52 47) scale(0.43) translate(-50 -50)" fill="#C9A24A"><path d="${enso}"/></g></svg>`;
const fonts = readdirSync(path.join(root, 'dist', 'fonts'));
const archivo = fonts.find((f) => f.startsWith('ArchivoBlack'));

// Serve the repo so the frame, the preview and dist/ load over http (no file:// quirks).
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
const open = async (query = '') => {
  await page.goto(`${base}/preview/vscode-frame.html${query}`);
  await board().getByRole('heading', { name: 'Agent Sessions' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
};
const board = () => page.frameLocator('#board');
const boardFrame = () => page.frames().find((f) => f.url().includes('/preview/index.html'));

// --- overlays (on the frame page, above the status bar) --------------------
const OVERLAY_CSS = `
@font-face{font-family:'Archivo Black';src:url('${base}/dist/fonts/${archivo}') format('woff2')}
#promo-cap{position:fixed;left:0;right:0;bottom:22px;z-index:2147483646;display:flex;align-items:center;gap:18px;
  padding:16px 32px;background:rgba(14,13,11,.94);border-top:1px solid #2C2A26;pointer-events:none}
#promo-cap .k{font:400 12px 'Archivo Black',sans-serif;letter-spacing:.18em;color:#C9A24A;white-space:nowrap}
#promo-cap .l{font:600 24px/1.2 Inter,sans-serif;color:#EDE8DE;letter-spacing:-.01em}
#promo-card{position:fixed;inset:0;z-index:2147483647;background:#0E0D0B;color:#EDE8DE;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:22px;text-align:center}
#promo-card .row{display:flex;align-items:center;gap:26px}
#promo-card .n{font:400 60px 'Archivo Black',sans-serif;letter-spacing:.04em}
#promo-card .t{font:600 34px Inter,sans-serif;color:#EDE8DE}
#promo-card .s{font:400 22px Inter,sans-serif;color:#9A948A}
#promo-card .g{font:400 22px Inter,sans-serif;color:#C9A24A}`;
const ensureCss = () =>
  page.evaluate((css) => {
    if (document.getElementById('promo-css')) return;
    const s = document.createElement('style');
    s.id = 'promo-css';
    s.textContent = css;
    document.head.append(s);
  }, OVERLAY_CSS);
const caption = async (label, line) => {
  await ensureCss();
  await page.evaluate(([label, line]) => {
    document.getElementById('promo-cap')?.remove();
    if (!line) return;
    const d = document.createElement('div');
    d.id = 'promo-cap';
    d.innerHTML = '<span class="k"></span><span class="l"></span>';
    d.querySelector('.k').textContent = label;
    d.querySelector('.l').textContent = line;
    document.body.append(d);
  }, [label, line]);
  await page.evaluate(() => document.fonts.ready);
};
const card = async (html) => {
  await ensureCss();
  await page.evaluate((html) => {
    document.getElementById('promo-card')?.remove();
    if (!html) return;
    const d = document.createElement('div');
    d.id = 'promo-card';
    d.innerHTML = html;
    document.body.append(d);
  }, html);
  await page.evaluate(() => document.fonts.ready);
};

// --- frames ---------------------------------------------------------------
const beats = [];
let frameNo = 0;
const beat = () => beats.push([]);
const shot = async (seconds) => {
  const file = path.join(work, `f${String(frameNo++).padStart(4, '0')}.png`);
  await page.screenshot({ path: file });
  beats.at(-1).push({ file, seconds });
};

await open();

// 1. Title
beat();
await card(
  `<div class="row"><img src="${icon}" width="120" height="120" style="border-radius:26px"><div class="n">AGENT SESSIONS</div></div>` +
    `<div class="t">Every AI coding agent session on one board.</div><div class="s">A VS Code extension for Claude Code</div>`,
);
await shot(3.5);
await card('');

// 2. Overview
beat();
await caption('AGENT SESSIONS', 'Every Claude Code session on this machine: in VS Code, a terminal or the background.');
await shot(5);

// 3. Live: a working session stops to ask for permission.
beat();
await caption('LIVE', 'Cards move as sessions change. Nothing to refresh.');
await shot(2);
await boardFrame().evaluate(() => {
  const s = sessions.find((x) => x.id === 'b1');
  Object.assign(s, { state: 'waiting', rawStatus: 'waiting', waitingFor: 'permission prompt', updatedAt: Date.now() });
  window.postMessage({ type: 'state', sessions, viewId: 'kanban', sources: ['Claude Code'], appearance: 'brand', historyThreshold: 150 }, '*');
});
await page.evaluate(() => window.setAgents(3, 1));
await page.waitForTimeout(500);
await caption('WAITING ON YOU', 'When a session needs you, it moves to the front, and the status bar says so.');
await shot(4.5);

// 4. Search
beat();
await caption('SEARCH', 'Filter as you type, by title, prompt, folder or state. Press / to start.');
const search = board().getByRole('searchbox', { name: 'Search sessions' });
await search.click();
await shot(0.6);
for (const ch of 'api') {
  await page.keyboard.type(ch);
  await page.waitForTimeout(200);
  await shot(0.3);
}
await page.waitForTimeout(300);
await shot(3.2);
await search.fill('');

// 5. History, including subagents
beat();
await caption('HISTORY', 'Search every past session, subagents included, and resume any of them.');
await board().getByRole('button', { name: 'History' }).click();
await search.click();
for (const ch of 'breaking') {
  await page.keyboard.type(ch);
  await page.waitForTimeout(120);
  if ('bkg'.includes(ch)) await shot(0.25);
}
await page.waitForTimeout(600);
await shot(4.5);
await search.fill('');
await board().getByRole('button', { name: 'History' }).click();

// 6. List view
beat();
await board().getByRole('tab', { name: 'List' }).click();
await page.waitForTimeout(400);
await caption('LIST', 'Or a list, with columns you can resize, hide and reorder.');
await shot(4);

// 7. Light look
beat();
await open('?theme=light');
await caption('TWO LOOKS', 'Four Ounces ink or paper, or your VS Code theme. Read-only, and nothing leaves your machine.');
await shot(4);

// 8. End card
beat();
await card(
  `<div class="row"><img src="${icon}" width="96" height="96" style="border-radius:21px"><div class="n" style="font-size:48px">AGENT SESSIONS</div></div>` +
    `<div class="t">Free on the VS Code Marketplace</div>` +
    `<div style="margin-top:28px">${mark}</div><div class="s">A Four Ounces tool · <span class="g">fourounces.live</span></div>`,
);
await shot(4.5);

await browser.close();
server.close();

// --- assemble -------------------------------------------------------------
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const clips = beats.map((frames, i) => {
  // Each frame is looped for exactly its hold time, then the frames are joined.
  const inputs = frames.flatMap((f) => ['-loop', '1', '-framerate', String(FPS), '-t', String(f.seconds), '-i', f.file]);
  const join = frames.map((_, k) => `[${k}:v]scale=1920:1080:flags=lanczos,setsar=1,format=yuv420p[f${k}]`).join(';');
  const concat = `${frames.map((_, k) => `[f${k}]`).join('')}concat=n=${frames.length}:v=1:a=0[v]`;
  const clip = path.join(work, `beat${i}.mp4`);
  ff([...inputs, '-filter_complex', `${join};${concat}`, '-map', '[v]', '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', '-r', String(FPS), clip]);
  // Measure the clip: the concat demuxer's timing differs a little from the sum of holds.
  const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', clip]).toString().trim());
  return { clip, seconds };
});

// Cross-fade the beats into one clip.
const inputs = clips.flatMap((c) => ['-i', c.clip]);
let filter = '';
let last = '[0:v]';
let offset = 0;
for (let i = 1; i < clips.length; i++) {
  offset += clips[i - 1].seconds - FADE;
  const label = i === clips.length - 1 ? '[v]' : `[x${i}]`;
  filter += `${last}[${i}:v]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}${label};`;
  last = label;
}
const total = offset + clips.at(-1).seconds;
filter += `[v]fade=t=in:st=0:d=0.4,fade=t=out:st=${(total - 0.6).toFixed(3)}:d=0.6[out]`;
ff([...inputs, '-filter_complex', filter, '-map', '[out]', '-an', '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', out]);

// README GIF: 960px, 12 fps, one palette for the whole clip.
ff(['-i', out, '-vf', 'fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', '-loop', '0', gif]);
rmSync(work, { recursive: true, force: true });
const mb = (f) => (statSync(f).size / 1e6).toFixed(1);
console.log(`→ ${out} (${total.toFixed(1)} s, ${mb(out)} MB)\n→ ${gif} (${mb(gif)} MB)`);
