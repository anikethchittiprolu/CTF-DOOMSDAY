#!/usr/bin/env node
// After `vite build`: write the template include with hashed asset names, the asset manifest
// the Prepare page and service worker use, and enforce the download budgets.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticDir = path.join(root, 'theme/doomsday/static');
const manifest = JSON.parse(fs.readFileSync(path.join(staticDir, '.vite/manifest.json'), 'utf8'));
const BASE = '/themes/doomsday/static/';
const MB = 1048576;
const BUDGET = { first: 8 * MB, region: 3 * MB, total: 40 * MB };

const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { if (f.name === '.vite') continue; const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else files.push(p); } };
walk(staticDir);
const rel = (p) => path.relative(staticDir, p).split(path.sep).join('/');
const size = (p) => fs.statSync(path.join(staticDir, p)).size;
const gz = (p) => zlib.gzipSync(fs.readFileSync(path.join(staticDir, p))).length;

// Entry and its static imports are the first load. Dynamic imports (3D map, scenes) are not.
const entry = Object.values(manifest).find((m) => m.isEntry && m.src === 'index.html');
const seen = new Set();
const collect = (key, acc) => { if (seen.has(key)) return; seen.add(key); const m = manifest[key]; acc.push(m.file, ...(m.css ?? [])); (m.imports ?? []).forEach((k) => collect(k, acc)); };
const first = []; collect(Object.keys(manifest).find((k) => manifest[k] === entry), first);
const firstJs = [...new Set(first)].filter((f) => f.endsWith('.js')), firstCss = [...new Set(first)].filter((f) => f.endsWith('.css'));

const partial = [
  ...firstCss.map((f) => `<link rel="stylesheet" href="${BASE}${f}">`),
  ...firstJs.slice(1).map((f) => `<link rel="modulepreload" href="${BASE}${f}">`),
  `<script type="module" src="${BASE}${entry.file}"></script>`,
].join('\n');
const partialDir = path.join(root, 'theme/doomsday/templates/partials');
fs.mkdirSync(partialDir, { recursive: true });
fs.writeFileSync(path.join(partialDir, 'game_assets.html'), partial + '\n');

const publish = files.map(rel).filter((p) => !p.endsWith('asset-manifest.json') && p !== 'sw.js' && !p.endsWith('index.html'));
const list = publish.map((p) => ({ path: p, bytes: size(p) }));
const totalBytes = list.reduce((a, f) => a + f.bytes, 0);
fs.writeFileSync(path.join(staticDir, 'asset-manifest.json'), JSON.stringify({ built: new Date().toISOString(), totalBytes, files: list }));

const errors = [];
const firstBytes = [...new Set(first)].reduce((a, f) => a + size(f), 0);
if (firstBytes > BUDGET.first) errors.push(`first load ${(firstBytes / MB).toFixed(2)} MB exceeds ${BUDGET.first / MB} MB`);
if (totalBytes > BUDGET.total) errors.push(`whole game ${(totalBytes / MB).toFixed(2)} MB exceeds ${BUDGET.total / MB} MB`);
for (const f of list) if (f.path.startsWith('assets/') && f.bytes > BUDGET.region) errors.push(`${f.path} is ${(f.bytes / MB).toFixed(2)} MB; a region chunk may not exceed ${BUDGET.region / MB} MB`);
if (publish.some((p) => /mock/i.test(p))) errors.push('the mock API leaked into the production build');

console.log(`first load: ${(firstBytes / 1024).toFixed(0)} KB raw, ${(([...new Set(first)].reduce((a, f) => a + gz(f), 0)) / 1024).toFixed(0)} KB gzip (budget 8 MB)`);
console.log(`whole game: ${(totalBytes / 1024).toFixed(0)} KB in ${list.length} files (budget 40 MB)`);
if (errors.length) { console.error('budget check failed:\n  - ' + errors.join('\n  - ')); process.exit(1); }
