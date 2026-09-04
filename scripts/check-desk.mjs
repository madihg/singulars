#!/usr/bin/env node
/**
 * check-desk - the browser checks for the desk surface, run against a server.
 *
 * `npm run verify` is hermetic (build, types, copy law, canon drift). These
 * checks need a real page, so they live here and are run by hand:
 *
 *   npm run build && npx next start -p 4312
 *   npm run check:desk -- http://127.0.0.1:4312/singulars
 *
 * They cover the things that only break in a browser:
 *   1. the favicon is the halimmadi.com mark, so a tab opened here matches a
 *      tab opened on the rest of the site
 *   2. the mascot pill and the site map still respond after a client-side
 *      navigation, which is what voting in vote.exe performs. This is the
 *      regression test for the bug where the bottom menu died after a vote:
 *      the chrome used to be rendered per route group, so a navigation out of
 *      the group replaced the nodes desktop.js had bound
 *   3. no photograph is greyscale
 *   4. every tool chip is visible at once, with no sideways scroll
 *   5. the duel window is vote.exe, says a visitor can vote, and each poem
 *      carries its own pick line
 *   6. Participating Poets opens as a carousel, Elise Liu first, small
 *      portraits, every bio word for word
 *   7. machine.txt opens from MACHINE and closes from HUMAN
 *
 * Playwright is not a dependency of this app. Install it where you run this
 * (npm i -D playwright) or the script says so and exits 0.
 */

import assert from "node:assert";
import process from "node:process";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3000/singulars").replace(/\/$/, "");
const WIDTHS = [
  [1440, 900, "1440"],
  [390, 844, "390"],
];

/* the poets' own words, verbatim: these are the strings the page must keep */
const BIO_EDGES = [
  ["Elise Liu is an immigrant third-culture kid poet", "working on her first novel."],
  ["Theory leads the writing program", "studies improv and comedy."],
  ["Halim Madi is a poet and performer", "audience keeps choosing."],
];

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.log("check-desk: playwright is not installed here; skipping browser checks.");
  process.exit(0);
}

const passed = [];
const failed = [];
function check(name, fn) {
  try {
    fn();
    passed.push(name);
  } catch (err) {
    failed.push(`${name} :: ${err.message}`);
  }
}

const browser = await chromium.launch({ channel: "chrome" });

for (const [width, height, tag] of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

  /* 1. the favicon */
  const icons = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel~="icon"]')].map((l) => l.getAttribute("href")),
  );
  const iconSvg = await (await page.request.get(`${BASE}/icon.svg`)).text();
  check(`[${tag}] the favicon is the halimmadi.com mark`, () => {
    assert.equal(icons.length, 1, JSON.stringify(icons));
    assert.ok(icons[0].startsWith("/singulars/icon.svg"), icons[0]);
    assert.ok(iconSvg.includes("#1C39E8"), iconSvg);
    assert.ok(iconSvg.includes("<circle"), iconSvg);
  });

  /* 3. colour */
  const greyed = await page.evaluate(() =>
    [...document.querySelectorAll("img")]
      .filter((i) => /grayscale/.test(getComputedStyle(i).filter))
      .map((i) => i.currentSrc),
  );
  check(`[${tag}] no photograph is greyscale`, () =>
    assert.equal(greyed.length, 0, JSON.stringify(greyed)),
  );

  /* 4. the tools */
  const tools = await page.evaluate(() => {
    const strip = document.querySelector(".sg-scroll");
    const box = strip.getBoundingClientRect();
    return {
      wrap: getComputedStyle(strip).flexWrap,
      scrolls: strip.scrollWidth > strip.clientWidth + 1,
      count: strip.children.length,
      allInside: [...strip.children].every((c) => {
        const r = c.getBoundingClientRect();
        return r.left >= box.left - 1 && r.right <= box.right + 1;
      }),
    };
  });
  check(`[${tag}] every tool chip is visible at once`, () => {
    assert.equal(tools.wrap, "wrap", tools.wrap);
    assert.ok(!tools.scrolls, "the strip still scrolls sideways");
    assert.ok(tools.allInside, "a chip sits outside the strip");
    assert.ok(tools.count >= 4, `only ${tools.count} chips`);
  });

  /* 5. vote.exe */
  await page.waitForSelector('[data-testid="mini-voting-poems"] .sg-poem', { timeout: 30000 });
  const vote = await page.evaluate(() => {
    const win = document.querySelector('[data-testid="mini-voting"]');
    return {
      title: win.querySelector(".win__t").textContent,
      note: win.querySelector(".note").textContent.replace(/\s+/g, " ").trim(),
      picks: [...win.querySelectorAll(".sg-poem__pick")].map((p) => p.textContent),
      menu: [...document.querySelectorAll(".mb__menu a")].map((a) => a.textContent),
    };
  });
  check(`[${tag}] the duel window is vote.exe and says a visitor can vote`, () => {
    assert.equal(vote.title, "vote.exe", vote.title);
    assert.ok(/^You can vote here\./.test(vote.note), vote.note);
    assert.equal(vote.picks.length, 2, JSON.stringify(vote.picks));
    assert.ok(vote.picks.every((p) => p === "vote for this one"), JSON.stringify(vote.picks));
    assert.ok(vote.menu.includes("vote"), JSON.stringify(vote.menu));
  });

  /* 6. Participating Poets */
  const poets = await page.evaluate(() => {
    const win = document.querySelector("#poets");
    const rail = win.querySelector(".sg-rail");
    return {
      title: win.querySelector(".win__t").textContent,
      isRail: !!rail,
      snap: rail ? getComputedStyle(rail).scrollSnapType : null,
      names: [...win.querySelectorAll(".sg-card__t")].map((n) => n.textContent),
      thumbs: [...win.querySelectorAll(".sg-card__thumb--poet")].map(
        (t) => t.getBoundingClientRect().width,
      ),
      bios: [...win.querySelectorAll(".sg-card__w")].map((b) => b.textContent),
      views: [...win.querySelectorAll('[aria-label="view poets as"] .btn')].map(
        (b) => `${b.textContent}:${b.getAttribute("aria-pressed")}`,
      ),
    };
  });
  check(`[${tag}] Participating Poets is a carousel, Elise Liu first, portraits small`, () => {
    assert.equal(poets.title, "Participating Poets", poets.title);
    assert.ok(poets.isRail, "the poets are not on a rail");
    assert.ok(poets.snap && poets.snap.includes("x"), `rail snap: ${poets.snap}`);
    assert.equal(poets.names[0], "Elise Liu", JSON.stringify(poets.names));
    assert.equal(poets.views[0], "carousel:true", JSON.stringify(poets.views));
    assert.ok(
      poets.thumbs.length === poets.names.length && poets.thumbs.every((w) => w > 0 && w <= 100),
      `portrait widths ${JSON.stringify(poets.thumbs)}`,
    );
  });
  check(`[${tag}] every poet bio is kept word for word`, () => {
    assert.equal(poets.bios.length, BIO_EDGES.length, `${poets.bios.length} bios`);
    for (const [head, tail] of BIO_EDGES) {
      assert.ok(
        poets.bios.some((b) => b.startsWith(head) && b.endsWith(tail)),
        `a bio changed: ${head}`,
      );
    }
  });

  /* 2. the bug: vote, then use the bottom menu */
  await page.locator('[data-testid="mini-voting-poems"] .sg-poem').first().click();
  await page.waitForTimeout(200);
  const chosen = await page.evaluate(() => ({
    picks: [...document.querySelectorAll('[data-testid="mini-voting"] .sg-poem__pick')].map(
      (p) => p.textContent,
    ),
    submit: !!document.querySelector('[data-testid="mini-voting"] .btn--send'),
  }));
  check(`[${tag}] choosing a poem is legible and offers a submit`, () => {
    assert.ok(chosen.picks.includes("chosen"), JSON.stringify(chosen.picks));
    assert.ok(chosen.submit, "no submit button");
  });

  await page.locator('[data-testid="mini-voting"] .btn--send').click();
  await page.waitForURL(/\/singulars\/[^/]+\/[^/]+$/, { timeout: 30000 });
  await page.waitForLoadState("networkidle");

  await page.locator("[data-mascot-machine]").click();
  await page.waitForTimeout(600);
  const afterVote = await page.evaluate(() => {
    const m = document.querySelector("[data-mascot-root]");
    return {
      on: m.classList.contains("is-machine"),
      pressed: m.querySelector("[data-mascot-machine]").getAttribute("aria-pressed"),
      line: m.querySelector(".mascot__line").textContent,
      machineWin: !!document.querySelector("[data-machine-window]"),
    };
  });
  check(`[${tag}] the bottom menu still responds after voting on a poem`, () => {
    assert.equal(afterVote.on, true, "the pill did not switch to machine");
    assert.equal(afterVote.pressed, "true", afterVote.pressed);
    assert.ok(afterVote.line.length > 0, "the pill said nothing");
  });
  /* 7. machine.txt, opened by the same press */
  check(`[${tag}] MACHINE opens machine.txt`, () =>
    assert.ok(afterVote.machineWin, "machine.txt did not open"),
  );

  await page.locator("[data-mascot-human]").click();
  await page.waitForTimeout(400);
  const back = await page.evaluate(() => ({
    win: !!document.querySelector("[data-machine-window]"),
    on: document.querySelector("[data-mascot-root]").classList.contains("is-machine"),
  }));
  check(`[${tag}] HUMAN closes machine.txt and leaves the page as it was`, () =>
    assert.ok(!back.win && !back.on, JSON.stringify(back)),
  );

  await page.locator("[data-menu-toggle]").click();
  await page.waitForTimeout(250);
  const map = await page.evaluate(() => !document.querySelector("[data-menu-drop]").hidden);
  check(`[${tag}] the site map still opens after voting`, () =>
    assert.ok(map, "the site map is dead"),
  );

  await page.close();
}

await browser.close();

for (const name of passed) console.log(`ok    ${name}`);
for (const name of failed) console.error(`FAIL  ${name}`);
console.log(`\ncheck-desk: ${passed.length} passed, ${failed.length} failed.`);
if (failed.length) process.exit(1);
