// Sunset Cover Studio — a make.fun gta6-cover-art-01 entry (Node 22, standard library only).
//
// The app is this directory's app/ folder: plain static files a desktop browser loads offline
// (app/index.html and its ES modules, no library and no network request). This program hands it
// in: it copies app/ and screenshots/ from beside this file into the output directory and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
//
// It never removes the output directory itself (the grader mounts that directory, and removing
// it fails the run); it creates the directory if needed and copies into it. Outside the grader's
// container, MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Serve the app locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const MAX_SCREENSHOTS = 4;
const MAX_SCREENSHOT_BYTES = 262144;

/** Refuse a broken entry before copying anything: the app page must exist and the
 *  screenshots must be 3 or 4 real PNG/JPEG files, each within the byte cap. */
function preflight() {
  const indexHtml = join(here, 'app', 'index.html');
  if (!existsSync(indexHtml)) throw new Error('preflight: app/index.html is missing');
  const shotsDir = join(here, 'screenshots');
  if (!existsSync(shotsDir)) throw new Error('preflight: screenshots/ is missing');
  const shots = readdirSync(shotsDir)
    .filter((name) => /\.(png|jpe?g)$/i.test(name))
    .sort();
  if (shots.length < 3 || shots.length > MAX_SCREENSHOTS) {
    throw new Error(`preflight: expected 3 or 4 screenshots, found ${shots.length}`);
  }
  for (const name of shots) {
    const path = join(shotsDir, name);
    const size = statSync(path).size;
    if (size > MAX_SCREENSHOT_BYTES) {
      throw new Error(`preflight: screenshots/${name} is ${size} bytes, over the 256 KiB cap`);
    }
    const head = readFileSync(path).subarray(0, 4);
    const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
    const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    if (!isPng && !isJpeg) throw new Error(`preflight: screenshots/${name} is not a PNG or JPEG`);
  }
  return shots;
}

/** Copy one tree into the output directory, creating the target first. */
function handInTree(name) {
  const from = join(here, name);
  const to = join(out, name);
  mkdirSync(to, { recursive: true });
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

const shots = preflight();
mkdirSync(out, { recursive: true });
handInTree('app');
handInTree('screenshots');

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others
// refuse an entry the scorer would refuse (more than 4 screenshots or one over 256 KiB; more than
// 993 files in app/ or 48 MiB of app files, in all, or a path under app/ over 1000 bytes: app/
// counts beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: MAX_SCREENSHOTS, max_bytes: MAX_SCREENSHOT_BYTES },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

console.log(`Sunset Cover Studio handed in to ${out} (${shots.length} screenshots)`);
