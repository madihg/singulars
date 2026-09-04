# Singulars wears the Desktop

Singulars is a surface of halimmadi.com, not a separate site. Since the
reskin (Sep 2026) every page of this app - public, venue, admin - uses the
Desktop design language defined in the halim-madi repo. This file says where
that language comes from, how it is kept honest, and the few rules that are
specific to this app.

The canon is `DESIGN-DESKTOP.md` in the halim-madi repo. Read it before
changing anything visual. What follows does not replace it.

## Where the language lives

| in this app                   | copied from halim-madi     |
| ----------------------------- | -------------------------- |
| `src/app/desktop/tokens.css`  | `Assets/css/tokens.css`    |
| `src/app/desktop/desktop.css` | `Assets/css/desktop.css`   |
| `public/desktop/desktop.js`   | `Assets/js/desktop.js`     |

Those three files are copies, byte for byte. Never edit them here. Change the
canon in halim-madi, then run:

```
node scripts/sync-desktop.mjs --write /path/to/halim-madi
```

`npm run verify` runs the same script in check mode. Given a checkout path
(argument or `HALIM_MADI_PATH`) it exits non-zero if any of the three files has
drifted; with no path it prints a note and exits 0, so a machine without the
halim-madi checkout is not blocked.

`desktop.js` sits under `public/` rather than `src/app/desktop/` only because
Next serves static scripts from `public/`. The root layout loads it with
`next/script` at `/singulars/desktop/desktop.js` (`next/script` does not apply
basePath, so the prefix is written by hand).

Two files in this app are ours, not the canon's:

- `src/app/globals.css` - reset and `@font-face` only. Nothing here may set
  colour, type scale, or layout: it loads first so the canon wins.
- `src/app/desktop/pages.css` - page-scoped composition for this app: window
  spans (`w--*`), the poem duel, the chat ledger, the admin tables. Everything
  in it is prefixed `sg-`, and it composes the canon's vocabulary rather than
  redefining it.

## The bones of a page

The root layout puts `class="desktop acc-machine"` on `<body>`: machine poetry
wears vermilion. Cobalt stays the one bold note, spent on the
start-a-conversation CTA (menu bar, footer, and the landing's enquiry window
are the same standing control).

Route groups decide which pages carry chrome:

```
src/app/
  layout.tsx            html, body, stylesheets, desktop.js
  (desk)/               landing, chat, evolution, theme voting  -> footer + mascot
  [slug]/(view)/        a performance, its about page, one theme -> footer + mascot
  [slug]/stage/         venue screen   -> body.venue  (black, no chrome)
  [slug]/control/       operator console -> body.bare (plain, no chrome)
  timer/                venue timer      -> body.bare (paints its own theme)
  admin/                menu bar + footer, and the "admin/" nav window
```

Each page renders its own `<MenuBar menu={...}>` so the bar can carry that
page's anchors; the layouts supply the footer and the mascot. The venue screens
opt out of the ground with `<BodyClass>`, which is the only way a nested route
can reach the body element the root layout owns.

Components: `src/components/desktop/Chrome.tsx` (menu bar, footer, mascot),
`Win.tsx` (one window), `BodyClass.tsx`.

## Rules that bite

- No long dashes anywhere in copy, alt text, titles or JSX strings. Em (U+2014)
  and en (U+2013) both fail `npm run verify`. A spaced hyphen carries the pause.
- The fine-tune system prompts (`src/lib/system-prompts.ts`, the
  `SYSTEM_PROMPT_*` and `IN_CONTEXT_BLOCK` constants in `src/lib/models.ts`) are
  training data, not copy. They are exempt from the dash law and must not be
  edited for style: changing a character changes the model.
- Under basePath `/singulars`, a `next/link` href stays root-relative (Next adds
  the prefix) while a plain `<a href>` or `<img src>` must carry `/singulars`
  itself. `npm run verify` fails on a plain tag that gets this wrong.
- The body never scrolls sideways. Wide tables and ledgers scroll inside their
  own `.sg-tablewrap`.
- Do not invent a class name for something the canon already has. `.win`,
  `.file`, `.btn`, `.k`, `.dk-input`, `.hdr`, `.rule`, `.cdot`, `.note`,
  `.prose` are the vocabulary.

## Known follow-ups

- The performance stills under `public/images/` are originals, some 5712px
  wide, and they are what the cards and heroes load. They should be resized and
  re-encoded (a 1600px wide variant would cover every use on the site). The
  reskin left the files alone on purpose so the change is reviewable on its own.
  The two heroes above the fold are `loading="eager"` because they are the
  largest paint; every other still is lazy.
- `machine vs me` on /evolution is a hand-drawn bar chart in a five-column
  window, so a column is narrower than the word "reinforcement". The names wrap
  and hyphenate inside their column and "pending" runs vertically up its dashed
  box. If the window ever gets more columns, both can go back to one line.
