#!/usr/bin/env node
/**
 * Bundles the web app into www/ for Capacitor (its webDir).
 *
 * The web PWA lives at the repo root so GitHub Pages can serve it directly.
 * Capacitor needs its assets in a self-contained folder, so we copy the
 * shippable files into www/ before `cap sync`. www/ is generated (gitignored).
 * Missing optional files (e.g. config.js before the backend PR lands) are
 * skipped rather than failing the build.
 */
import { mkdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www');

const ASSETS = ['index.html', 'config.js', 'sw.js', 'manifest.json', 'icon.svg'];

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

let copied = 0;
for (const f of ASSETS) {
  const src = join(root, f);
  if (existsSync(src)) { copyFileSync(src, join(www, f)); copied++; }
  else console.warn(`skip (not found): ${f}`);
}
console.log(`Copied ${copied} file(s) into www/`);
