// Builds the web app in demo mode, captures Today, Closet and History at iPhone size,
// frames each one with a caption and writes docs/screenshots/*.webp.
// Needs Chromium: set CHROME to its path (defaults to the newest Playwright cache build) and Python with Pillow.
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, '../../docs/screenshots');
const dist = join(root, 'dist-web');

const SHOTS = [
  { name: 'today', path: '/', caption: 'Your outfit,\nevery morning.' },
  { name: 'closet', path: '/closet', caption: 'Your closet,\nat a glance.' },
  { name: 'history', path: '/history', caption: 'What you wore,\nand when.', tap: '[aria-label^="Worn on"]' },
];

const PAPER = '#F7F6F2';
const INK = '#1F1F1C';
const VIEWPORT = { width: 390, height: 844 };

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = join(homedir(), '.cache/ms-playwright');
  const dir = readdirSync(base)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]))
    .pop();
  if (!dir) throw new Error('No Chromium found; set CHROME');
  return join(base, dir, 'chrome-linux64/chrome');
}

function build() {
  const env = { ...process.env, EXPO_PUBLIC_DEMO: '1', EXPO_PUBLIC_BASE_PATH: '' };
  delete env.EXPO_PUBLIC_SUPABASE_URL;
  delete env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist-web', '--clear'], { cwd: root, env, stdio: 'inherit' });
  execFileSync('node', ['scripts/finish-web.mjs'], { cwd: root, env, stdio: 'inherit' });
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };

function serve() {
  const server = createServer((req, res) => {
    let file = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

function frameHtml(image, caption) {
  return `<!doctype html><html><head><style>
  html,body{margin:0;background:${PAPER};}
  body{width:1000px;height:1900px;display:flex;flex-direction:column;align-items:center;
    font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",Roboto,Arial,sans-serif;}
  h1{margin:110px 0 80px;font-size:68px;line-height:1.12;font-weight:700;letter-spacing:-0.5px;color:${INK};
    text-align:center;white-space:pre-line;}
  .phone{padding:18px;border-radius:96px;background:${INK};box-shadow:0 30px 60px rgba(31,31,28,0.18);}
  .phone img{display:block;width:640px;border-radius:78px;}
  </style></head><body><h1>${caption}</h1><div class="phone"><img src="${image}"></div></body></html>`;
}

async function main() {
  build();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: findChrome() });
  const tmp = mkdtempSync(join(tmpdir(), 'matin-shots-'));
  try {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 3, locale: 'en-US', colorScheme: 'light' });
    const page = await context.newPage();
    await page.goto(base + '/');
    await page.waitForTimeout(6000);
    const framer = await browser.newPage({ viewport: { width: 1000, height: 1900 }, deviceScaleFactor: 1 });
    for (const shot of SHOTS) {
      await page.goto(base + shot.path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      if (shot.tap) {
        await page.locator(shot.tap).last().click();
        await page.waitForTimeout(1500);
      }
      const raw = (await page.screenshot({ type: 'png' })).toString('base64');
      await framer.setContent(frameHtml(`data:image/png;base64,${raw}`, shot.caption), { waitUntil: 'load' });
      const png = join(tmp, `${shot.name}.png`);
      await framer.screenshot({ path: png, type: 'png' });
      execFileSync('python3', [
        '-c',
        'import sys; from PIL import Image; Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2], "WEBP", quality=85, method=6)',
        png,
        join(out, `${shot.name}.webp`),
      ]);
      console.log(`docs/screenshots/${shot.name}.webp`);
    }
  } finally {
    await browser.close();
    server.close();
    rmSync(tmp, { recursive: true, force: true });
  }
}

await main();
