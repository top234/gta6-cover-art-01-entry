// Sunset Cover Studio — entry program.
// Hands the app in: copies app/ and screenshots/ into the output directory
// and writes dossier.json there with the vendored make.fun library.
//
// The output directory is never removed: the grader mounts it, and removing
// it fails the run. It is created when missing and copied into. Outside the
// grader, MAKEFUN_OUTPUT_DIR names a stand-in output directory.
// A broken entry is refused before anything is written: the app entry page
// must exist, and screenshots/ must hold three or four images, each at most
// 256 KiB. Running twice writes byte-identical output.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

const MAX_SCREENSHOT_BYTES = 262144;
const SCREENSHOT_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, "app");
const shotsDir = join(here, "screenshots");
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

function fail(message: string): never {
  throw new Error("sunset-cover-studio: " + message);
}

function checkEntryReady(): string[] {
  if (!existsSync(join(appDir, "index.html")) || !statSync(join(appDir, "index.html")).isFile()) {
    fail("app/index.html is missing, so the entry is broken");
  }
  if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) {
    fail("screenshots/ is missing, so the entry is broken");
  }
  const shots = readdirSync(shotsDir)
    .filter((name) => !name.startsWith("."))
    .filter((name) => SCREENSHOT_EXTENSIONS.has(name.slice(name.lastIndexOf(".")).toLowerCase()))
    .sort();
  if (shots.length < 3 || shots.length > 4) {
    fail(`screenshots/ holds ${shots.length} images, need 3 or 4`);
  }
  for (const name of shots) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > MAX_SCREENSHOT_BYTES) {
      fail(`screenshots/${name} is ${size} bytes, over the 256 KiB cap`);
    }
  }
  return shots;
}

function main(): void {
  const shots = checkEntryReady();
  mkdirSync(outDir, { recursive: true });
  cpSync(appDir, join(outDir, "app"), { recursive: true });
  cpSync(shotsDir, join(outDir, "screenshots"), { recursive: true });
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: MAX_SCREENSHOT_BYTES },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, "dossier.json"), dossier);
  if (dossier.byteLength === 0) fail("dossier.json came out empty");
  console.log(
    `handed in ${shots.length} screenshots: ${shots.join(", ")} (${dossier.byteLength} dossier bytes)`,
  );
}

main();
