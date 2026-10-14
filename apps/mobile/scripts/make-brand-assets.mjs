// Renders assets/brand/icon.svg into the app, splash, adaptive and web icons.
// Needs a headless Chromium: set CHROME to its path (defaults to the Playwright cache).
// Pass sheet names (for example `notification`) to render only those targets.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const images = join(root, 'assets/images');
const icons = join(root, 'public/icons');
mkdirSync(icons, { recursive: true });

const PAPER = '#F7F6F2';
const INK = '#1F1F1C';
const svg = readFileSync(join(root, 'assets/brand/icon.svg'), 'utf8');
const body = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const mark = body.replace(/<rect width="1024" height="1024"[^>]*\/>/, '');
const HORIZON = /<rect x="150" y="736"[^>]*\/>/;
// Layers drawn over a transparent background must not rely on opacity: Android blends it dark.
const markOpaque = mark.replace(HORIZON, `<rect x="150" y="736" width="724" height="30" rx="15" fill="${INK}"/>`);
const markNoHorizon = mark.replace(HORIZON, '');

// The mark's visible bounds are roughly x 150-874, y 243-766; centre it and scale it.
const centered = (scale, layer = mark) =>
  `<g transform="translate(512 512) scale(${scale}) translate(-512 -505)">${layer}</g>`;

const SAFE = 0.9;
const NOTIFICATION = 1.3;
const monochrome = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
      <rect width="1024" height="1024" fill="#fff"/>
      <path d="M512 318 C 512 262, 586 262, 586 318 C 586 358, 512 368, 512 418" fill="none" stroke="#000" stroke-width="86" stroke-linecap="round"/>
      <path d="M512 418 L798 640 Q824 660 798 680 L226 680 Q200 660 226 640 Z" fill="none" stroke="#000" stroke-width="90" stroke-linejoin="round"/>
    </mask>
    <clipPath id="up"><rect x="0" y="0" width="1024" height="700"/></clipPath>
  </defs>
  <g transform="translate(512 512) scale(${scale}) translate(-512 -505)">
    <circle cx="512" cy="700" r="320" fill="#fff" clip-path="url(#up)" mask="url(#cut)"/>
    <path d="M512 318 C 512 262, 586 262, 586 318 C 586 358, 512 368, 512 418" fill="none" stroke="#fff" stroke-width="38" stroke-linecap="round"/>
    <path d="M512 418 L798 640 Q824 660 798 680 L226 680 Q200 660 226 640 Z" fill="none" stroke="#fff" stroke-width="42" stroke-linejoin="round"/>
  </g>
</svg>`;

const sheets = {
  full: svg,
  foreground: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${centered(SAFE, markOpaque)}</svg>`,
  splash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${centered(SAFE, markNoHorizon)}</svg>`,
  maskable: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${PAPER}"/>${centered(SAFE)}</svg>`,
  monochrome: monochrome(SAFE),
  notification: monochrome(NOTIFICATION),
};

const targets = [
  ['full', 1024, join(images, 'icon.png'), false],
  ['foreground', 1024, join(images, 'adaptive-icon-foreground.png'), true],
  ['monochrome', 1024, join(images, 'adaptive-icon-monochrome.png'), true],
  ['notification', 96, join(images, 'notification-icon.png'), true],
  ['splash', 576, join(images, 'splash-icon.png'), true],
  ['full', 48, join(images, 'favicon.png'), false],
  ['full', 192, join(icons, 'icon-192.png'), false],
  ['full', 512, join(icons, 'icon-512.png'), false],
  ['full', 180, join(icons, 'apple-touch-icon.png'), false],
  ['maskable', 512, join(icons, 'icon-maskable-512.png'), false],
];

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = join(homedir(), '.cache/ms-playwright');
  const dir = readdirSync(base).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop();
  if (!dir) throw new Error('No headless Chromium found; set CHROME');
  return join(base, dir, 'chrome-headless-shell-linux64/chrome-headless-shell');
}

const only = process.argv.slice(2);
const chosen = only.length ? targets.filter(([sheet]) => only.includes(sheet)) : targets;

const chrome = findChrome();
const tmp = mkdtempSync(join(tmpdir(), 'matin-brand-'));
try {
  for (const [sheet, size, out, transparent] of chosen) {
    const page = join(tmp, `${sheet}-${size}.html`);
    writeFileSync(
      page,
      `<!doctype html><html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px">${sheets[sheet].replace('<svg ', `<svg width="${size}" height="${size}" `)}</div></body></html>`,
    );
    const args = ['--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1', `--screenshot=${out}`, `--window-size=${size},${size}`];
    if (transparent) args.push('--default-background-color=00000000');
    execFileSync(chrome, [...args, `file://${page}`], { stdio: 'ignore' });
    console.log(out.replace(`${root}/`, ''));
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
