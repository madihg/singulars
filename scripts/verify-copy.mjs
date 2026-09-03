#!/usr/bin/env node
/**
 * verify-copy - copy-law check, run by `npm run verify`.
 *
 * 1. FAILS the build on an em dash (U+2014) anywhere under src/. The hosted
 *    voice uses a spaced hyphen ( - ) instead, in prose, alt text, titles and
 *    JSX strings alike.
 *
 *    EXEMPTION - model prompts. The fine-tune system prompts and the
 *    in-context DPO block are training data, not site copy: their exact bytes
 *    were sent to OpenAI / Together and are reproduced verbatim when a model
 *    is re-trained or re-evaluated. Editing a character there changes the
 *    model, so they are skipped. Two forms of exemption:
 *      a. whole file - src/lib/prompts* (reserved for a future prompts module)
 *         and src/lib/system-prompts.ts
 *      b. inside a declaration whose name contains SYSTEM_PROMPT or
 *         IN_CONTEXT_BLOCK, for the length of its template literal
 *         (src/lib/models.ts holds SYSTEM_PROMPT_FR / SYSTEM_PROMPT_EN /
 *         FRONTIERE_IN_CONTEXT_BLOCK this way).
 *    Nothing else is exempt.
 *
 * 2. REPORTS (does not fail) the two ways a basePath href can go wrong.
 *    Under basePath "/singulars":
 *      - a next/link href must be root-relative, because Next prepends the
 *        basePath itself. <Link href="/singulars/x"> renders /singulars/singulars/x.
 *      - a plain <a href> or a plain <iframe/img/script/video/source src> is
 *        a real browser URL and must keep the prefix. <a href="/x"> and
 *        <iframe src="/x"> both land on www.halimmadi.com/x and 404.
 *    The first list is a report. The second is a FAILURE: a root-relative
 *    href/src on a plain HTML tag is always wrong under this basePath, and
 *    an <iframe src> missing the prefix is how the control page's stage
 *    preview 404'd unnoticed.
 *    (fetch() strings to '/singulars/api/...' are browser URLs too and are
 *    correct as written - they are not counted here. next/link and
 *    next/image DO get the basePath prepended for you, so their props must
 *    stay root-relative and are not flagged.)
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(process.argv[2] ?? "src");
const EM_DASH = "\u2014"; // written escaped so this file stays em-dash-free

const FILE_EXEMPT = [/^lib\/prompts/, /^lib\/system-prompts\.ts$/];
const EXEMPT_DECL =
  /(?:const|let|var)\s+[A-Za-z0-9_]*(?:SYSTEM_PROMPT|IN_CONTEXT_BLOCK)[A-Za-z0-9_]*\s*(?::[^=]*)?=\s*`/;

/** Every file under dir, recursively. */
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(ROOT).filter((f) => /\.(ts|tsx|js|jsx|mjs|css|json|md)$/.test(f));

const emDashHits = [];
const hrefHits = [];
const bareAnchorHits = [];

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const source = fs.readFileSync(file, "utf8");
  const lines = source.split("\n");
  const fileExempt = FILE_EXEMPT.some((re) => re.test(rel));

  // Em dash scan, tracking exempt template literals.
  let inExemptLiteral = false;
  lines.forEach((line, i) => {
    if (inExemptLiteral) {
      // A backtick on this line closes the literal (prompts contain no nested
      // template literals; if one is ever added, close it on its own line).
      if (line.includes("`")) inExemptLiteral = false;
      return;
    }
    if (EXEMPT_DECL.test(line)) {
      // Opening line: the rest of the line after the backtick is exempt too.
      const after = line.slice(line.indexOf("`") + 1);
      inExemptLiteral = !after.includes("`");
      return;
    }
    if (!fileExempt && line.includes(EM_DASH)) {
      emDashHits.push(`${path.join("src", rel)}:${i + 1}: ${line.trim()}`);
    }
  });

  // JSX href report, both directions.
  if (/\.(tsx|jsx)$/.test(rel)) {
    lines.forEach((line, i) => {
      const where = `${path.join("src", rel)}:${i + 1}: ${line.trim()}`;
      if (/(?:href|src)=\{?["'`]\/singulars(["'`/?#]|$)/.test(line)) {
        hrefHits.push(where);
      }
    });
    // Plain HTML tags (NOT next/link or next/image, which prepend the
    // basePath themselves) whose href/src is root-relative but has no
    // basePath. Matched across the whole file because a JSX tag wraps lines.
    // Nested braces are allowed one level deep so template literals with
    // ${...} inside a prop still match.
    const plainTag = /<(a|iframe|img|script|video|audio|source|embed|object)\b(?:[^<>]|\{(?:[^{}]|\{[^{}]*\})*\})*?>/gs;
    for (const m of source.matchAll(plainTag)) {
      const attr = /(href|src|data)=\{?[`"']([^`"']*)/.exec(m[0]);
      if (!attr) continue;
      const [, name, value] = attr;
      if (value.startsWith("/") && !value.startsWith("/singulars")) {
        const line = source.slice(0, m.index).split("\n").length;
        bareAnchorHits.push(
          `${path.join("src", rel)}:${line}: <${m[1]} ${name}=${value}>`,
        );
      }
    }
  }
}

console.log(`verify-copy: scanned ${files.length} files under ${ROOT}`);
console.log(
  `verify-copy: ${hrefHits.length} literal '/singulars' href/src(s) in JSX (review, not an error):`,
);
for (const hit of hrefHits) console.log(`  ${hit}`);
if (bareAnchorHits.length > 0) {
  console.error(
    `\nverify-copy: FAIL - ${bareAnchorHits.length} plain HTML href/src missing the basePath "/singulars". These 404 in production.`,
  );
  for (const hit of bareAnchorHits) console.error(`  ${hit}`);
} else {
  console.log(
    "verify-copy: 0 plain HTML href/src missing the basePath.",
  );
}

if (emDashHits.length > 0) {
  console.error(
    `\nverify-copy: FAIL - ${emDashHits.length} em dash(es) (U+2014) found. Use a spaced hyphen ( - ).`,
  );
  for (const hit of emDashHits) console.error(`  ${hit}`);
}

if (emDashHits.length > 0 || bareAnchorHits.length > 0) process.exit(1);

console.log(
  "verify-copy: OK - no em dashes outside the prompt exemption, no unprefixed href/src.",
);
