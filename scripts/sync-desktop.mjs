#!/usr/bin/env node
/**
 * sync-desktop - keep the Desktop design language in this app in step with the
 * canon that lives in the halim-madi repo.
 *
 * The canon (halim-madi):        this app:
 *   Assets/css/tokens.css   ->   src/app/desktop/tokens.css
 *   Assets/css/desktop.css  ->   src/app/desktop/desktop.css
 *   Assets/js/desktop.js    ->   public/desktop/desktop.js      (rewritten)
 *   Assets/js/machine.js    ->   public/desktop/machine.js      (rewritten)
 *   Assets/css/machine.css  ->   public/desktop/machine.css
 *
 * The scripts sit under public/ rather than src/app/desktop/ because Next only
 * serves static assets from public/; next/script loads desktop.js from
 * /singulars/desktop/desktop.js, and desktop.js imports machine.js from beside
 * it the first time anyone presses MACHINE.
 *
 * REWRITES. Two of these files address the site by URL, and this app is served
 * from a basePath on another host. Every difference from the canon is a literal
 * string swap declared in REWRITES below - nothing else may differ, and --check
 * re-derives the expected bytes from the canon, so a canon edit that moves one
 * of these strings fails the build instead of drifting silently. The rule the
 * swaps encode: assets this app serves become /singulars/desktop/... , and
 * everything belonging to halimmadi.com (its endpoints, its data files, the
 * links the model writes) becomes an absolute www.halimmadi.com URL.
 *
 * Usage
 *   node scripts/sync-desktop.mjs --check <halim-madi-checkout>
 *       exits 1 and prints a diff summary when any file has drifted.
 *   node scripts/sync-desktop.mjs --write <halim-madi-checkout>
 *       copies the canon over the local copies, applying the rewrites.
 *
 * The checkout path may also come from the HALIM_MADI_PATH env var. With no
 * path at all the script reports "canon not available" and exits 0, so CI on a
 * machine without the halim-madi checkout is not blocked; drift is caught
 * locally before a reskin lands.
 *
 * Never edit src/app/desktop/*.css or public/desktop/* by hand. Change the
 * canon, then run --write. Singulars-only rules belong in
 * src/app/desktop/pages.css, which this script does not touch.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Ordered literal swaps, per canon file. Every one must match exactly once. */
const REWRITES = {
  "Assets/js/desktop.js": [
    ['import("/Assets/js/machine.js?v=1")', 'import("/singulars/desktop/machine.js?v=1")'],
  ],
  "Assets/js/machine.js": [
    [
      'var CSS_HREF = "/Assets/css/machine.css?v=1";\n' +
        'var ENDPOINT = "/api/machine";\n' +
        'var POEM_ENDPOINT = "/api/chat";',
      "/* Rewritten for singulars by scripts/sync-desktop.mjs. This surface is\n" +
        "   served from /singulars on another host, so the stylesheet is the copy\n" +
        "   beside this file and everything else - the endpoints, the site's own\n" +
        "   data files, the links the model writes - is an absolute URL back to\n" +
        "   halimmadi.com. Reached through halimmadi.com/singulars those calls are\n" +
        "   same-origin; reached at singulars.oulipo.xyz they are cross-origin and\n" +
        "   the window falls back to the poem lines until that origin is allowed. */\n" +
        'var SITE = "https://www.halimmadi.com";\n' +
        'var CSS_HREF = "/singulars/desktop/machine.css?v=1";\n' +
        "var ENDPOINT = SITE + \"/api/machine\";\n" +
        'var POEM_ENDPOINT = SITE + "/api/chat";',
    ],
    ['a.setAttribute("href", m[2]);', 'a.setAttribute("href", m[2].charAt(0) === "/" ? SITE + m[2] : m[2]);'],
    ['fetch("/Assets/data/works.json"', 'fetch(SITE + "/Assets/data/works.json"'],
    ['a.setAttribute("href", "/llms.txt");', 'a.setAttribute("href", SITE + "/llms.txt");'],
    ['go("/cv/");', 'go(SITE + "/cv/");'],
    ['go("/connect/#start");', 'go(SITE + "/connect/#start");'],
  ],
};

const FILES = [
  ["Assets/css/tokens.css", "src/app/desktop/tokens.css"],
  ["Assets/css/desktop.css", "src/app/desktop/desktop.css"],
  ["Assets/js/desktop.js", "public/desktop/desktop.js"],
  ["Assets/js/machine.js", "public/desktop/machine.js"],
  ["Assets/css/machine.css", "public/desktop/machine.css"],
];

/** Canon bytes -> the bytes this app must hold. Throws if a swap misfires. */
function project(from, text) {
  let out = text;
  for (const [needle, replacement] of REWRITES[from] ?? []) {
    const hits = out.split(needle).length - 1;
    if (hits !== 1) {
      throw new Error(
        `rewrite for ${from} matched ${hits} times (expected 1):\n  ${needle.split("\n")[0]}`,
      );
    }
    out = out.replace(needle, replacement);
  }
  return out;
}

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
  let canon;
  try {
    canon = project(from, fs.readFileSync(src, "utf8"));
  } catch (err) {
    console.error(`sync-desktop: ${err.message}`);
    drift++;
    continue;
  }
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
