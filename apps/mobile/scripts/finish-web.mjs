// Fills the base path into dist-web/index.html. With WEB_404_FALLBACK=1 it also writes 404.html,
// which hosts without rewrites (GitHub Pages) serve on deep links.
import { readFileSync, writeFileSync } from 'node:fs';

const out = new URL('../dist-web/', import.meta.url);
const base = (process.env.EXPO_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '');
const html = readFileSync(new URL('index.html', out), 'utf8').replaceAll('%BASE_PATH%', base);

writeFileSync(new URL('index.html', out), html);
if (process.env.WEB_404_FALLBACK === '1') writeFileSync(new URL('404.html', out), html);
