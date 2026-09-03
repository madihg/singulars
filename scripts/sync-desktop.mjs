#!/usr/bin/env node
/**
 * sync-desktop - keep the Desktop design language in this app byte-identical
 * to the canon that lives in the halim-madi repo.
 *
 * The canon (halim-madi):        this app:
 *   Assets/css/tokens.css   ->   src/app/desktop/tokens.css
 *   Assets/css/desktop.css  ->   src/app/desktop/desktop.css
 *   Assets/js/desktop.js    ->   public/desktop/desktop.js
 *
 * desktop.js sits under public/ rather than src/app/desktop/ because Next only
 * serves static scripts from public/; next/script loads it from
 * /singulars/desktop/desktop.js. It is the same file, byte for byte.
 *
 * Usage
 *   node scripts/sync-desktop.mjs --check <halim-madi-checkout>
 *       exits 1 and prints a diff summary when any file has drifted.
 *   node scripts/sync-desktop.mjs --write <halim-madi-checkout>
 *       copies the canon over the local copies.
 *
 * The checkout path may also come from the HALIM_MADI_PATH env var. With no
 * path at all the script reports "canon not available" and exits 0, so CI on a
 * machine without the halim-madi checkout is not blocked; drift is caught
 * locally before a reskin lands.
 *
 * Never edit src/app/desktop/*.css or public/desktop/desktop.js by hand. Change
 * the canon, then run --write. Singulars-only rules belong in
 * src/app/desktop/pages.css, which this script does not touch.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FILES = [
  ["Assets/css/tokens.css", "src/app/desktop/tokens.css"],
  ["Assets/css/desktop.css", "src/app/desktop/desktop.css"],
  ["Assets/js/desktop.js", "public/desktop/desktop.js"],
];

const args = process.argv.slice(2);
const write = args.includes("--write");
const canonRoot =
  args.find((a) => !a.startsWith("--")) ?? process.env.HALIM_MADI_PATH ?? "";

if (!canonRoot) {
  console.log(
    "sync-desktop: no halim-madi checkout given (pass a path or set HALIM_MADI_PATH); skipping drift check.",
  );
  process.exit(0);
}
if (!fs.existsSync(canonRoot)) {
  console.error(`sync-desktop: canon path does not exist: ${canonRoot}`);
  process.exit(1);
}

let drift = 0;
for (const [from, to] of FILES) {
  const src = path.join(canonRoot, from);
  const dest = path.join(APP_ROOT, to);
  if (!fs.existsSync(src)) {
    console.error(`sync-desktop: missing in canon: ${src}`);
    drift++;
    continue;
  }
  const canon = fs.readFileSync(src, "utf8");
  const local = fs.existsSync(dest) ? fs.readFileSync(dest, "utf8") : null;
  if (canon === local) continue;
  if (write) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, canon);
    console.log(`sync-desktop: wrote ${to}`);
  } else {
    drift++;
    console.error(
      `sync-desktop: DRIFT ${to} (${local === null ? "missing" : `${local.length}b local vs ${canon.length}b canon`})`,
    );
  }
}

if (drift > 0) {
  console.error(
    `\nsync-desktop: ${drift} file(s) drifted from the canon at ${canonRoot}.\n` +
      "Run: node scripts/sync-desktop.mjs --write <halim-madi-checkout>",
  );
  process.exit(1);
}
console.log("sync-desktop: in sync with the canon.");
