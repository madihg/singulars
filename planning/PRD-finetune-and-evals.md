# PRD: Singulars Fine-Tuning, Evals, and Admin Panel

**Version:** 1.1 (improved 2026-05-01 via /ralphy-tui-prd + /ui-ux-pro-max; v1.0 content preserved verbatim with new subsections layered on)
**Date:** 2026-04-30 (original) / 2026-05-01 (improvements)
**Author:** Halim Madi (artist) + research synthesis
**Audience:** Coding agent (Claude Code) implementing this on top of the existing Singulars Next.js app at `/Users/halim/Documents/singulars`

---

## 0. How to read this PRD

This document **extends** the existing `singulars-prd.md` (US-001 through whatever exists today). It does not modify or rewrite anything already shipped. New user stories are numbered starting at **US-100** to avoid collision.

Every user story closes by referencing the research artifact it draws from. Read those files when an acceptance criterion is ambiguous - they hold the load-bearing detail.

Research backing (under `/Users/halim/Documents/singulars/planning/research/`):

- `01-evals-primer.md` - non-technical foundation
- `02-poetry-classifiers-and-eval-design.md` - eval methodology, judge prompt, calibration
- `03-best-poetry-models.md` - candidate model shortlists
- `04-eval-tooling.md` - chosen runner (promptfoo) + Day-One workflow
- `05-visualization/` - public chart design + mockups (HTML files)
- `06-update-loop.md` + `06-migration-evals.sql` - admin panel + post-show update loop + canonical schema

### v1.1 reading guide

Each user story is now structured as four blocks:

1. **Description** - the original "as a / I want / so that" line (verbatim from v1.0)
2. **Acceptance Criteria** - the original checklist (verbatim from v1.0)
3. **UX notes** _(new in v1.1)_ - states (loading / empty / error), microcopy, mobile behavior, accessibility, design-system anchors
4. **Verification** _(new in v1.1)_ - concrete steps an agent or human runs to confirm "done"

Nothing was removed. If you want to audit, diff against git for v1.0 and confirm every checkbox and code path still appears.

---

## 1. Overview

Singulars is a human-vs-machine poetry performance series at oulipo.xyz/singulars. The audience votes on poem pairs at each show; those votes are the artistic ground truth. This PRD adds the **fine-tuning evaluation system** and the **admin panel** that drives it. After the next performance (`ground.exe`, June 12 2026, Currents New Media Festival, Santa Fe), Halim will fine-tune a poetry model on the cumulative vote data, evaluate it against past performances, and publish the results as a chart on the public site.

The scope is:

1. New Supabase tables for candidate models, eval runs, and per-theme scores.
2. A protected admin panel at `/admin` for vote entry, eval triggering, and publish controls.
3. A CLI-driven eval runner (promptfoo wrapper) that scores candidate models against audience-voted winners.
4. Two public visualizations (Model Evolution Chart, Head-to-Head Matrix) on the live site.
5. A post-performance update loop that Halim runs manually after each show.

## 2. Goals

- Make audience preference legible as a measurable, time-series quality signal.
- Keep Halim - not a Postgres trigger or a cron job - in the loop. Eval runs are a deliberate ritual.
- Match the existing oulipo.xyz design language exactly (Terminal Grotesque + Diatype Mono Variable, CSS variables, restraint).
- Reuse the existing admin auth pattern from `/theme-voting/admin` instead of inventing a new one.
- Keep eval costs under $50/year at the project's 3-4-shows-per-year cadence.

## 3. Non-goals

- No streaming, real-time eval results. Runs complete in batch and are explicitly published.
- No automatic eval triggering on `status` changes (artistically incorrect).
- No public exposure of judge rationales beyond the drilldown view (auditable but small).
- No replacement of the existing `cast_vote` RPC or the `votes` table.

## 4. Technology choices (locked)

| Concern                   | Choice                                                                                           | Source                           |
| ------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------- |
| Eval runner               | **promptfoo** (npm, MIT)                                                                         | research/04                      |
| Judge model (default)     | **GPT-5.5** (cross-family from Claude candidates)                                                | research/02, research/06 §10     |
| Candidate benchmarks      | Claude Opus 4.7, Gemini 3.1 Pro, DeepSeek R1                                                     | research/03 Shortlist A          |
| Fine-tune base candidates | Qwen3-14B (top), Llama 3.3 70B Instruct, Mistral Nemo 12B                                        | research/03 Shortlist B          |
| Ground.exe color          | `#D97706` (already seeded)                                                                       | scripts/migration-2026-03-10.sql |
| Visualization library     | d3 v7 (CDN, no npm dep for the .html mockups; the in-app version uses recharts already in scope) | research/05                      |

## 5. Quality Gates

Same as the existing PRD:

- `npm run build` - passes
- `npm run lint` - passes
- For UI stories: visual verification on desktop + mobile viewports, matching the existing design language
- For schema stories: `psql -f scripts/06-migration-evals.sql` runs idempotently twice in a row with no errors
- For runner stories: `npm run eval -- --performance hard-exe --candidates claude-opus-4-7 --judge openai:gpt-5-5 --dry-run` succeeds without spending real API budget

### 5.1 Per-story-type gate matrix _(new in v1.1)_

| Story type                                                          | Required gates                                                                                       | Visual gate? | DB gate? | Cost gate?    |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------ | -------- | ------------- |
| Schema (US-100, US-122)                                             | `npm run build`, `npm run lint`, idempotent migration twice                                          | no           | yes      | n/a           |
| Shared lib / auth (US-101)                                          | `npm run build`, `npm run lint`, login round-trip in both panels                                     | no           | n/a      | n/a           |
| Admin UI (US-102, 103, 104, 105, 106, 107, 108, 109, 121, 123, 124) | `npm run build`, `npm run lint`, desktop + mobile screenshot at iPhone 14 Pro (390x844) and 1440x900 | yes          | n/a      | n/a           |
| Admin API (US-111, 112, 113, 114)                                   | `npm run build`, `npm run lint`, `requireAuth` returns 401 for unauth call (curl probe)              | no           | yes      | n/a           |
| Runner / CLI (US-110, 124 CLI)                                      | `npm run build`, `npm run lint`, `--dry-run` smoke from §5                                           | no           | yes      | yes (dry run) |
| Public API (US-115, 116)                                            | `npm run build`, `npm run lint`, anon read returns only `published=true AND status='completed'` rows | no           | yes      | n/a           |
| Public page (US-117, 118)                                           | `npm run build`, `npm run lint`, desktop + mobile screenshot, axe-core no critical issues            | yes          | n/a      | n/a           |
| Webhooks (US-122 routes)                                            | `npm run build`, `npm run lint`, signature verification with bad sig returns 401                     | no           | n/a      | n/a           |
| Cron (US-119, 122 poll)                                             | `npm run build`, `npm run lint`, route returns 200 to Vercel cron header probe, no-op when env unset | no           | n/a      | n/a           |

### 5.2 Visual verification protocol _(new in v1.1)_

For every UI story, agent must:

1. Open `/admin/<route>` in dev (`npm run dev`) and capture a desktop screenshot.
2. Resize the viewport to 390x844 (iPhone 14 Pro) and capture a mobile screenshot.
3. Confirm the page uses the **Singulars design system** (see §6.5) - Terminal Grotesque only on the H1, Diatype Mono Variable on labels/buttons/status pills, white background, no shadows or rounded cards.
4. Confirm interactive surfaces honor the **five interaction moves** (custom dot cursor on hover, opacity 0.7 on link hover, focus ring 3px in performance color, selection-by-contrast-collapse where applicable, grayscale-to-color where images appear).

## 6. Schema reconciliation note

Two of the research artifacts (research/05 data-spec and research/06 migration) proposed slightly different table shapes. **The canonical schema is `06-migration-evals.sql`.** Specifically:

- `singulars.candidate_models`, `singulars.eval_runs`, `singulars.eval_scores` are the three new tables.
- One eval run = one (candidate_model × performance) pair. Re-running creates a new row.
- The `published` flag lives on `eval_runs` (not at a "batch" level). Publishing the latest completed run for a (model, performance) pair makes that data point visible on the public chart.
- Per-theme drilldown reads directly from `eval_scores` (no separate `eval_score_themes` table).
- The visibility model uses `candidate_models.is_public` (column-level) AND `eval_runs.published` (row-level) AND-gated for anon reads via RLS.

The data-spec.md from research/05 reflects an earlier proposal; the views/queries it defines should be adapted to the canonical schema.

### 6.5 Design system contract _(new in v1.1)_

All UI in this PRD must match the Singulars + oulipo.xyz design system documented at `/Users/halim/.claude/plans/can-you-create-a-groovy-hummingbird.md` (Part 1). Summary contract for agents:

**Colors (chrome only):**

- Background `#ffffff` (only)
- Text `rgba(0,0,0,0.85)` primary, opacity steps `0.7 / 0.6 / 0.5 / 0.4` for hierarchy
- Borders `rgba(0,0,0,0.75)` heavy, `rgba(0,0,0,0.12)` hairline
- Status pills: upcoming `bg #f3f4f6 border #d1d5db text #4b5563`; training `bg #fff border #171717 text #171717`; trained `bg #171717 border #171717 text #fff`

**Performance accents (functional only - never page chrome):**

- reverse.exe `#8B5CF6`, hard.exe `#2AA4DD`, reinforcement.exe `#02F700`, versus.exe `#FEE005`, carnation.exe `#F6009B`, ground.exe `#D97706`
- Run accent text through `accessibleTextColor()` (4.5:1) and accent borders through `accessibleUIColor()` (3:1) before applying

**Type:**

- Terminal Grotesque - H1 only, once per page, big (`7rem` desktop, `4.5rem` under 600px, line-height `0.9`)
- Standard (Book / Bold) - body sans, `1.06-1.3rem`
- Diatype Variable (200-1000) - section titles, `2rem / 700`
- Diatype Mono Variable (200-700) - captions, labels, buttons, status pills, navigation, all admin metadata. Often uppercase with `0.05em` letter-spacing.

**Layout:**

- Admin pages: same `max-width: 800px` centered column as public Singulars pages (mobile-first - Halim runs the admin from a phone)
- Spacing scale (rem): `0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 3 / 4`
- Breakpoints: `768px` (sidebar collapse), `900px` (3-col -> 2-col), `600px` (full mobile)

**Forbidden:**

- Card UI with shadows or rounded corners
- Gradients, glassmorphism, off-whites
- Iconography (the mono `↗` is the only allowed icon)
- Color in chrome
- Animations beyond opacity/filter swaps
- Em dashes anywhere in copy. Use hyphen-with-spaces ( - ).

**Microcopy voice:** lower-case wordmarks, declarative, no marketing puffery, no emojis, no exclamation marks. Confirm modals state the consequence in one sentence ("Flip reverse.exe to trained? This finalizes the audience-vote results.").

---

## 7. User Stories

### US-100: Apply eval-pipeline migration

**Description:** As a developer, I want the new schema applied so the eval pipeline has tables to write to.

**Acceptance Criteria:**

- [ ] `planning/research/06-migration-evals.sql` is applied to the live Supabase project (singulars schema)
- [ ] All three new tables exist: `singulars.candidate_models`, `singulars.eval_runs`, `singulars.eval_scores`
- [ ] All three new enum types exist: `eval_run_status`, `eval_trigger`, `candidate_family`
- [ ] Helper function `singulars.golden_tuples_for_performance(text)` returns rows for `'hard-exe'` (smoke test in research/06 §9)
- [ ] Views `singulars.v_model_winrate_per_performance` and `singulars.v_latest_eval_run` exist
- [ ] RLS policies are in place: anon can read public+non-archived models, published+completed runs, and scores tied to those runs
- [ ] Migration is idempotent - running it twice produces no errors and changes nothing the second time
- [ ] Seed candidates land: `ground-exe-v0`, `claude-opus-4-7`, `gemini-3-1-pro`, `deepseek-r1` (all `is_public=false` initially)
- [ ] Rollback block from research/06 §9 has been tested in a branch DB

**UX notes:** None - schema-only.

**Verification:**

1. `psql "$DATABASE_URL" -f planning/research/06-migration-evals.sql` returns no errors.
2. Run the same command a second time - confirm no errors and no row changes (use `pg_dump --schema-only singulars` diff before/after).
3. `select count(*) from singulars.golden_tuples_for_performance('hard-exe')` returns > 0.
4. As anon role, `select * from singulars.candidate_models where archived = false and is_public = true` returns only the seed candidates that were marked public (zero on first apply since all seed `is_public=false`).
5. As anon role, `select * from singulars.eval_runs` returns zero rows (none published yet).

### US-101: Shared admin-auth library

**Description:** As a developer, I want admin auth logic centralized so both `/theme-voting/admin` and the new `/admin` panel use the same cookie.

**Acceptance Criteria:**

- [ ] New file `src/lib/admin-auth.ts` exports: `hashToken()`, `isValidAdminCookie(req)`, `requireAuth(req)` (throws 401), `setAuthCookie(res)`, `clearAuthCookie(res)`
- [ ] Logic lifted verbatim from `src/app/api/themes/admin/auth/route.ts` (HMAC-SHA256 of SUPABASE_SERVICE_ROLE_KEY with `ADMIN_PASSWORD` as the message; cookie name `theme-admin-token`; 24h expiry)
- [ ] New env `ADMIN_PASSWORD` takes precedence over `THEME_ADMIN_PASSWORD` (fallback for backwards compat)
- [ ] The existing `/api/themes/admin/auth` route is refactored to import from this lib - no behavior change
- [ ] New parallel route `src/app/api/admin/auth/route.ts` mirrors the existing one (POST to log in, GET to check, DELETE to log out) using the shared lib
- [ ] One login session works across both `/theme-voting/admin` and `/admin/*`

**UX notes:** No visible UI here, but the cookie name (`theme-admin-token`) is preserved deliberately - any logged-in `/theme-voting/admin` session must continue working without a re-login.

**Reuse:** Read `src/app/api/themes/admin/auth/route.ts` first; do not reimplement HMAC from scratch.

**Verification:**

1. Log into `/theme-voting/admin/login` with `THEME_ADMIN_PASSWORD`. Visit `/admin` - lands on dashboard, not login (cookie is shared).
2. Log out from `/admin`. Refresh `/theme-voting/admin` - it bounces to its login.
3. Set `ADMIN_PASSWORD=foo` and `THEME_ADMIN_PASSWORD=bar`. Log in with `foo` - succeeds. Log in with `bar` - fails. (Confirms precedence.)
4. `curl -X GET http://localhost:3000/api/admin/auth` returns `401` without cookie, `200` with valid cookie.

### US-102: Admin shell at /admin

**Description:** As Halim, I want a single admin home with navigation to every section so I can move between tasks quickly.

**Acceptance Criteria:**

- [ ] Page at `src/app/admin/page.tsx` (dashboard: counts, latest eval status snapshot)
- [ ] Login screen at `src/app/admin/login/page.tsx` mirroring `/theme-voting/admin` login UI
- [ ] Layout `src/app/admin/layout.tsx` with `<AdminNav>` showing tabs: **Performances** | **Models** | **Eval runs** | **Publish** | **Logout**
- [ ] Unauthenticated visitors get redirected to `/admin/login`; on success they return to where they came from
- [ ] Styling primitives (`monoStyle`, `inputStyle`, `btnPrimaryStyle`, `pageStyle`, `titleStyle`, `backLinkStyle`, etc.) are lifted out of `src/app/theme-voting/admin/page.tsx` into `src/lib/admin-styles.ts` and imported by both panels
- [ ] Mobile-responsive (Halim runs this from a phone in a hotel room - research/06 §0)

**UX notes:**

- Nav is a horizontal row of Diatype Mono links on desktop. On mobile (<600px), the nav collapses to a single line of comma-separated links - no hamburger drawer (we are not Cargo).
- Active tab gets `border-bottom: 2px solid currentColor`. Inactive tabs at `opacity 0.6`, hover `opacity 1.0` with the standard `0.3s ease`.
- The dashboard H1 reads "admin" in Terminal Grotesque (lowercase). No subtitle.
- Phase 2.5 lands two more nav items - **Training data** and **Fine-tunes**. Build the nav as an array so adding tabs is one line.
- Empty state on the dashboard before any data exists: "no eval runs yet. start one →" linking to `/admin/eval-runs/new`. Diatype Mono, secondary text color.
- Login error message: "wrong password" (lower-case, Diatype Mono, secondary text). No iconography.

**Reuse:** `src/app/theme-voting/admin/page.tsx` style primitives - they are good, do not redesign.

**Verification:**

1. Visit `/admin` while logged out - redirected to `/admin/login?from=%2Fadmin`. Submit correct password - lands on `/admin`.
2. Visit `/admin/eval-runs` while logged out - redirected to `/admin/login?from=%2Fadmin%2Feval-runs`. Submit correct password - lands on `/admin/eval-runs`.
3. Resize to 390px - nav collapses to comma-separated single line; main content reflows; no horizontal scroll.
4. Confirm `/theme-voting/admin` still renders identically to before US-102 (visual diff of pre/post screenshots).

### US-103: Admin > Performances

**Description:** As Halim, I want to see every performance, flip statuses, and reconcile vote tallies after a show.

**Acceptance Criteria:**

- [ ] Page at `/admin/performances` lists all performances with: name, slug, date, status pill, num themes with vote-pairs, total votes
- [ ] Each row has buttons: **View votes** (links to US-104), **Flip status**, **Sync tallies**
- [ ] Status flip surfaces a confirm modal: "Flip reverse.exe to trained? This finalizes the audience-vote results."
- [ ] "Sync tallies" recomputes `poems.vote_count` from the underlying `votes` table and shows a toast with the diff (e.g. "Reconciled 0 poems" or "Updated 2 poems")
- [ ] API: `GET /api/admin/performances`, `POST /api/admin/performances/[slug]/status`, `POST /api/admin/performances/[slug]/sync-tallies`
- [ ] All admin API routes call `requireAuth(req)` from US-101

**UX notes:**

- Table is a vertical list on mobile (no horizontal scroll). Each row is a card-less stack: performance name (Standard, `1.1rem`), slug + date (Diatype Mono, `0.85rem`, secondary), status pill, then a row of action buttons.
- Status pill uses the design-system tokens from §6.5.
- Confirm modal: white background, hairline border, no shadow. Two buttons: "Cancel" (mono link, opacity hover) and "Flip" (mono, accent in the destination performance's color, only enabled after a 500ms hold-to-confirm? - no, single click is fine, the modal text is the safety net).
- Toast: top-right on desktop, top-center on mobile. Single line, Diatype Mono, white bg, hairline border, performance accent color on the left as a 4px bar. Auto-dismisses after 4s, click to dismiss earlier.
- Empty list state ("no performances yet"): unreachable - performances are seeded - but render `"no performances. seed via scripts/seed-performances.mjs"` defensively.
- Loading state: rows render as 2-line skeletons in `rgba(0,0,0,0.06)` (no animation).
- Error state on `Sync tallies`: red-darkened-to-3:1 hairline border on the toast, message reads `"sync failed: <error>"`.
- Status state machine: enforce `upcoming -> training -> trained` and `upcoming -> trained` (skipping training if a show was cancelled). Block `trained -> training` (refuse with toast `"cannot un-train a performance"`).

**Verification:**

1. Visit `/admin/performances` logged in - all 6 performances render.
2. Click "Flip status" on `reverse.exe` (currently `upcoming`) - modal opens with exact copy from the AC. Cancel - no DB change. Confirm - status flips to `training`, row re-renders, toast confirms.
3. Click "Sync tallies" on a performance - toast surfaces the count.
4. `curl -X POST http://localhost:3000/api/admin/performances/reverse-exe/status -d '{"status":"training"}'` without cookie returns 401.
5. Mobile screenshot at 390px - no horizontal scroll, action buttons stack readable.

### US-104: Admin > Vote entry (per performance)

**Description:** As Halim, I want to enter or correct vote counts after each show - including paper-ballot votes from the venue.

**Acceptance Criteria:**

- [ ] Page at `/admin/performances/[slug]/votes`
- [ ] Editable table, one row per theme, columns: theme, human-poem snippet (60 chars), human votes input, machine-poem snippet, machine votes input, save row, current totals
- [ ] Click on a snippet expands the full poem inline
- [ ] "Save all" at top with confirm modal showing diff before committing
- [ ] CSV import dropzone accepts `theme_slug, human_votes, machine_votes` columns; preview before commit; errors surfaced per row
- [ ] API: `GET /api/admin/performances/[slug]/vote-pairs`, `PATCH /api/admin/poems/[poem_id]` (body: `{ vote_count, reason? }`), `POST /api/admin/performances/[slug]/import-csv`
- [ ] All vote-count writes log to `console` with `{ poem_id, old, new, reason, ts }` (audit trail v1; promote to a `poem_vote_overrides` table in v2)

**UX notes:**

- The table is dense - on mobile, switch to a stacked layout: each theme is a section with theme name as a Diatype Variable `1.1rem / 700` heading, then human and machine sub-blocks each with snippet + numeric input + save.
- Inputs are `<input type="number" min="0" inputmode="numeric">` so phone keyboards show a numpad. Diatype Mono, `1.1rem`, white bg, hairline border, no rounded corners.
- Snippet expand: clicking the snippet inline-expands to full poem text in `white-space: pre-line` (preserve stanzas - this is a poem). A second click collapses. Animation is opacity-only, 0.2s.
- "Save all" confirm modal lists every changed row as `theme: human N -> M, machine N -> M` in Diatype Mono. Long lists scroll inside the modal.
- CSV dropzone: dashed hairline border (`rgba(0,0,0,0.12)` 1px dashed). Text inside says `"drop a csv with columns theme_slug, human_votes, machine_votes - or click to pick"`. On hover, dropzone darkens to `rgba(0,0,0,0.18)`. On drag-over, the dot cursor in the performance's accent color appears.
- CSV preview: a table showing parsed rows; rows with errors get a red-3:1 left border and the error inline (`"unknown theme slug: foo"`).
- Disable "Commit" until all CSV rows validate. Allow "Commit valid only" as a secondary text-link if there are mixed valid/invalid rows.
- "reason" input on per-row save: optional text input (mono, `0.85rem`) with placeholder `"optional - why this change?"`. Reasons go into the audit log.
- Empty state (performance has no themes): `"no themes for this performance yet. add them via the existing theme admin."` linking to `/theme-voting/admin`.
- Error state on save: row's save button turns red-3:1 with text `"retry"`; underneath, mono error.

**Verification:**

1. Visit `/admin/performances/hard-exe/votes` logged in - all themes render with current vote counts pre-filled.
2. Edit one row's human votes from 4 to 6 with reason `"adding paper ballots"` - click save row - toast confirms - DB row updates - server log line emitted.
3. Click "Save all" after editing 3 rows - modal lists exact diffs - confirm - all 3 commit.
4. Drop a CSV with 3 valid rows and 1 invalid (bad slug) - preview shows 4 rows, 1 with red border. "Commit valid only" works; the invalid row stays in the form.
5. Mobile screenshot at 390px - rows stack readably, no horizontal scroll.
6. `curl -X PATCH /api/admin/poems/<uuid> -d '{"vote_count":99}'` without cookie returns 401.

### US-105: Admin > Candidate models (CRUD)

**Description:** As Halim, I want to add new candidate models, mark them public/private, and assign chart colors.

**Acceptance Criteria:**

- [ ] Page at `/admin/models` lists all rows from `candidate_models` (including archived, behind a toggle): name, family, endpoint, color swatch, is_public toggle, archive button
- [ ] Form at `/admin/models/[id]` (and `/admin/models/new`) with fields: name, slug (auto-from-name with override), family (select), version_label, api_endpoint, hf_repo, color picker, is_public, fine_tune_source (FK select), notes
- [ ] Slug is unique; form surfaces conflict before submit
- [ ] API: standard CRUD at `/api/admin/candidate-models` and `/api/admin/candidate-models/[id]`, plus `POST /api/admin/candidate-models/[id]/toggle-public`
- [ ] Inline preview of how the model will render on the public chart (color swatch + name as it would appear in the legend)

**UX notes:**

- List view: stacked rows on mobile, name + family + status chips on the left, color swatch (24x24px square, no border-radius) and toggles on the right.
- "Show archived" is a Diatype Mono link in the page header (`opacity 0.5` when off, `1.0` on, no toggle widget). When on, archived rows render at `opacity 0.5`.
- Color picker: native `<input type="color">` plus a text input next to it for exact hex entry. Display the contrast-safe darkened version next to the raw hex (`#02F700 -> #007a00 for text`) so Halim sees what visitors will see.
- Slug auto-fill: kebab-case the name, but show the input pre-filled and editable. Validate on blur via `GET /api/admin/candidate-models?slug=<slug>` - if taken, surface inline error `"slug taken by <other model name>"`.
- Family select: hardcoded to the `candidate_family` enum values from US-100.
- `fine_tune_source` FK select: list other candidate models, with the currently-being-edited row excluded. Defaults to none.
- Inline chart preview: a 240x60 mini-chart with a single horizontal line in the chosen accent color, label = the model's name in Diatype Mono. Updates live as the form changes. Renders with `accessibleUIColor()` applied.
- Confirm modal on archive: `"archive <name>? it disappears from the public chart and from new eval runs. existing eval runs keep their reference."` - destructive action button in the model's accent color.
- Empty state on `/admin/models`: unreachable after US-100 seeding; defensively render `"no candidate models yet."`.

**Verification:**

1. Visit `/admin/models/new`, type "ground.exe (v2 - 4o-mini-DPO)" - slug auto-fills as `ground-exe-v2-4o-mini-dpo`. Submit - row created.
2. Edit the new row, change color to `#02F700` - inline preview shows `#02F700` swatch and `#007a00` darkened-for-text. Save - persists.
3. Toggle `is_public` from row list - row reflects new state without page reload.
4. Try to create a second row with slug `claude-opus-4-7` - inline error blocks submit.
5. Archive a row - confirm modal opens with exact copy - confirm - row hides unless "show archived" is on.

### US-106: Admin > Eval runs list

**Description:** As Halim, I want to see all eval runs, filter them, and trigger reruns.

**Acceptance Criteria:**

- [ ] Page at `/admin/eval-runs` shows a table: model | performance | status pill | win rate | progress bar (`n_themes_completed/n_themes`) | judge model | cost | published toggle | actions (View / Rerun / Cancel)
- [ ] Filter chips: by performance, by status, by candidate model, "drafts only", "completed only"
- [ ] **Live polling** (5s interval) while any visible row is in `pending` or `running` state
- [ ] "Run new eval" CTA links to US-107
- [ ] API: `GET /api/admin/eval-runs?perf=&status=&model=` with pagination
- [ ] Click on row opens detail page (US-108)

**UX notes:**

- Filter chips are Diatype Mono, `0.85rem`, hairline border, padding `0.25rem 0.7rem`, `2px` radius (matches status pill geometry from §6.5). Active chip gets accent text + filled bg in `rgba(0,0,0,0.06)`. Inactive chips at `opacity 0.6`.
- Progress bar: 1px-tall `rgba(0,0,0,0.12)` bg with the model's accent color filling left-to-right. No animation, no gradient.
- Win rate: shown as `"73%"` in Diatype Mono, `0.95rem`, weight 500. If `n_themes < 5`, append `(low n)` in secondary text.
- Status pill colors: `pending` (warm gray bg `#f3f4f6`), `running` (mono with a slow-blinking 1px-wide dot before the text - opacity-only animation, 1s cycle), `completed` (white bg, black border), `failed` (white bg, red-3:1 border + text), `cancelled` (gray bg, secondary text).
- Polling stops when no visible row is in `pending`/`running`. Use `setInterval` cleanup on unmount; stop polling when the tab is hidden (`document.visibilitychange`).
- Pagination: 50 rows per page. Mono `← prev` / `next →` links at the bottom. URL params drive state (filter chips also push to URL).
- Mobile: drop the table; render each run as a 4-line stack (model + perf, status + win rate, judge + cost, actions). Sticky "Run new eval" CTA at top.
- Empty state (no runs at all): hero text `"no eval runs yet."` + a single accent-colored CTA `"run your first eval →"` linking to US-107.
- Empty filtered state: `"no runs match these filters."` + a "clear filters" link.
- Error state on the polling fetch: tiny mono pill at top reads `"polling failed - retry in 30s"`. No alert.

**Verification:**

1. Seed 3 fake `eval_runs` rows via SQL (`pending`, `completed`, `failed`). Visit `/admin/eval-runs` - all three render with correct status pills.
2. Filter chips: click "completed only" - only the completed row shows. URL updates to `?status=completed`.
3. Set the `pending` row to `running` via SQL - within 5s the page polls and updates. Set it to `completed` - polling stops.
4. Resize to 390px - rows stack as 4-line mono blocks; sticky CTA stays at top on scroll.

### US-107: Admin > Start a new eval run

**Description:** As Halim, after a show I want to kick off an eval against the just-trained performance with a clear cost preview.

**Acceptance Criteria:**

- [ ] Form at `/admin/eval-runs/new` with fields: **Performance** (select, only `trained`), **Candidate models** (multi-select from `candidate_models WHERE archived=false`), **Judge model** (select; defaults to a candidate not in the multi-select to avoid family-leak), **Cost cap** (number input, defaults to `EVAL_COST_CAP_USD` env, default $20), **n per theme** (defaults to 3 from research/02)
- [ ] Below the form, a live cost estimator that computes `n_themes × n_candidates × (1 generation + 2 judge calls × A/B swap) × est-tokens × $/M` from research/06 §8 and shows "Estimated $X.XX, cap $Y.YY"
- [ ] Submit calls `POST /api/admin/eval-runs/start` with `{ performance_id, candidate_model_ids[], judge_model, cost_cap_usd, n_per_theme }`
- [ ] API returns `{ run_ids: uuid[] }` (one per candidate); status starts `pending`, immediately enqueues runner tasks (see US-110)
- [ ] On success, redirects to `/admin/eval-runs?status=pending` so Halim can watch the polling

**UX notes:**

- Form is a single vertical column, max-width `560px` even on desktop (Halim's reading column width). Each field has a Diatype Mono `0.85rem` label above the input, hairline border below.
- Performance select: shows performance name + date, ordered by date desc. Disabled options (non-`trained`) appear at `opacity 0.4` with mono suffix `(not trained)`.
- Candidate multi-select: rendered as a list of clickable chips (no native multi-select). Clicked chip = selected (filled bg in chip's accent). Unclicked = hairline border. This avoids the dropdown UX disaster on mobile.
- Judge model select: default-pick logic is `pick the cheapest candidate-family member NOT in the candidate multi-select`. Recompute on candidate selection change. If no valid default exists, force the user to pick.
- Cost estimator: large Diatype Variable `1.6rem / 700` showing `Estimated $X.XX`. Below in mono `0.85rem`: `cap $Y.YY`. If estimate > cap, the estimate goes red-3:1 and submit is disabled with mono error: `"estimate exceeds cap. raise the cap or remove a candidate."`.
- Field validation surfaces inline (no toast). Submit button at bottom right, accent color of the first selected candidate (or black if none).
- After submit, transition to the redirected list page is instant - no spinner; the new rows show as `pending` immediately.
- Empty state when no `trained` performances exist: `"no trained performances yet. flip a performance to trained first."` with link to `/admin/performances`.
- Mobile: same layout, just narrower. The chip multi-select wraps to multiple lines.

**Verification:**

1. Visit `/admin/eval-runs/new` - form renders, cost estimator reads `Estimated $0.00`.
2. Pick `hard-exe` (trained, 8 themes) and `claude-opus-4-7` - estimator updates within 100ms to a non-zero value matching the formula.
3. Add `gpt-5-5` to candidates - judge default switches off `gpt-5-5` to avoid family-leak.
4. Lower cost cap to `$0.10` - estimate goes red, submit disables.
5. Submit valid form - redirects to `/admin/eval-runs?status=pending` with N new rows visible.

### US-108: Admin > Eval run detail + per-theme drilldown

**Description:** As Halim, I want to see exactly how the model performed on each theme, including the poem it generated and the judge's reasoning.

**Acceptance Criteria:**

- [ ] Page at `/admin/eval-runs/[id]` shows run header (status, win rate, judge, cost, started/finished, cancel/rerun/publish buttons)
- [ ] Below: per-theme rows with theme, audience winner snippet, audience loser snippet, candidate poem (full), judge ranking (1/2/3), `candidate_won` boolean, `judge_rationale`, `confidence` chip, `position_swap_agreement` flag (amber if false)
- [ ] If `position_swap_agreement = false` for >30% of rows, surface a warning banner: "judge appears position-biased - interpret win rate cautiously"
- [ ] If `status = 'failed'`, surface `error_message` prominently with a "Rerun" CTA that clones `config_snapshot` into a new run
- [ ] **Publish** button (single click + confirm) flips `published=true`; cache for `/api/evals/results` is busted so the public chart refreshes
- [ ] API: `GET /api/admin/eval-runs/[id]`, `POST /api/admin/eval-runs/[id]/cancel`, `POST /api/admin/eval-runs/[id]/rerun`, `POST /api/admin/eval-runs/[id]/publish`

**UX notes:**

- Header: model name in Diatype Variable `2rem / 700` + performance name in Diatype Mono `1rem` secondary; below, a row of stat blocks (win rate / themes / cost / judge / started / finished) each with mono label above value.
- Action buttons sit at top-right: `cancel` (mono link), `rerun` (mono link), `publish` (accent-color filled button). Publish becomes `unpublish` when already published.
- Per-theme rows: theme name in Diatype Variable `1.1rem / 700`. Three poem blocks side-by-side on desktop (audience winner | audience loser | candidate), stacked on mobile. Each block has a label header in mono uppercase (`audience winner / audience loser / candidate`) and the full poem below in Standard with `white-space: pre-line` and line-height `1.7`.
- The `candidate` block has a hairline left border in the candidate's accent color when `candidate_won = true`, and `rgba(0,0,0,0.12)` otherwise.
- Judge rationale collapsed by default (`"+ rationale"` mono link). Click expands. Rationale text is italic Standard, secondary color.
- `confidence` chip: mono `0.7rem` uppercase pill (`HIGH / MEDIUM / LOW`) with status-pill styling.
- `position_swap_agreement = false` per row: amber-darkened-to-3:1 dot before the judge ranking number.
- Banner at top when >30% disagreement: `bg #fff3e0` (one of the only allowed off-whites since it carries warning meaning), 1px amber border, mono text. Dismissable with `×` (mono).
- Failed-run state: header replaces win rate with red-3:1 `"failed"` and an `error_message` block in mono below.
- Publish confirm modal: `"publish this run? the public chart will update within 60 seconds."` - confirm button in candidate's accent color.
- Cancel confirm modal: `"cancel this run? partial scores keep, the runner stops between themes."`.
- Mobile: header collapses to 2-column stat grid; per-theme blocks stack.

**Verification:**

1. Visit `/admin/eval-runs/<id>` for a `completed` run - header + per-theme rows render correctly.
2. Set `position_swap_agreement=false` on 4 of 8 themes - banner appears.
3. Click "publish" - confirm - row updates, `eval_runs.published=true`. `revalidateTag('eval-results')` fires; visit `/api/evals/results` - the run's data point now appears.
4. Click "rerun" - new `pending` row created via API, redirected to its detail page.
5. Cancel a `running` run - status flips to `cancelled`; the runner script (running locally) detects the flip on its next inter-theme check and exits.

### US-109: Admin > Publish controls

**Description:** As Halim, I want a one-screen view to control which models and performances are visible on the public chart, with a live preview of what visitors will see.

**Acceptance Criteria:**

- [ ] Page at `/admin/publish` shows a matrix: rows = `candidate_models WHERE archived=false`, columns = performances ordered by date
- [ ] Each cell shows the latest run for that (model, performance) pair: win rate, status pill, draft/published toggle
- [ ] Toggling a cell flips `eval_runs.published` for that latest run
- [ ] Toggling a row's `is_public` (header chip) flips `candidate_models.is_public` - removes the entire model series from the public chart
- [ ] Right-side preview pane renders the public chart with the current draft state (read-only, refreshes on every toggle)
- [ ] API: reuses `POST /api/admin/eval-runs/[id]/publish` and `POST /api/admin/candidate-models/[id]/toggle-public` (US-105)

**UX notes:**

- Matrix: row labels (model name + accent swatch) on the left, column labels (performance name) at the top. Cells are 80x80px on desktop, 56x56px on mobile.
- Cell content: 2-line vertical stack - win rate (mono `0.95rem`) on top, draft/published toggle (a single click target showing `draft` or `published` in mono `0.7rem` uppercase) below.
- Empty cell (no run for that model/perf): single `·` glyph in `rgba(0,0,0,0.4)`.
- Row-level `is_public` toggle: a small chip next to the model name. When off, the entire row gets `opacity 0.4`.
- Preview pane: on desktop, splits the page 50/50 with sticky right side. On mobile, slides up from the bottom as a drawer (full-height, swipe-down to close) on tap of a "preview" mono link.
- Optimistic updates: toggles flip immediately, fetch fires; on failure, revert + toast `"publish failed - retried"`.
- Confirm modal for unpublishing a row's `is_public`: `"hide <model name> from the public chart? this removes all its data points from /singulars/evolution."`.
- No confirm for individual cell publish/unpublish - this is the mutation Halim makes most often, friction here is the wrong tradeoff.

**Verification:**

1. Visit `/admin/publish` - matrix renders with all models × all performances.
2. Toggle a cell from draft to published - within 1s the right-side preview reflects the new data point.
3. Toggle a row's `is_public` off - confirm modal opens; confirm; entire row dims; preview removes that line from the chart.
4. `curl /api/evals/results` after a toggle returns updated data (cache busted).
5. Mobile screenshot - matrix scrolls horizontally with sticky model column; preview opens as a drawer.

### US-110: Eval runner script

**Description:** As a developer, I want a CLI script that runs a single (model, performance) eval end-to-end, callable from both the admin API and the terminal.

**Acceptance Criteria:**

- [ ] Script at `scripts/run-eval.ts` matches the implementation in research/06 §4.3 verbatim
- [ ] `package.json` has `"scripts": { "eval": "tsx scripts/run-eval.ts" }`
- [ ] Two invocation modes:
  - Server-invoked: `--run-id <uuid>` - run row already exists; runner just executes
  - CLI: `--performance <slug> --candidates <slug,slug> --judge <provider:model>` - runner creates run rows, then executes
- [ ] Loads tuples via `singulars.golden_tuples_for_performance(p_slug)` RPC
- [ ] Builds a `promptfooconfig.yaml` per candidate with the judge prompt from research/02 §2.3 verbatim (do NOT rewrite)
- [ ] Runs with `--max-cost ${EVAL_COST_CAP_USD}` and `--max-concurrency 4`; honors A/B position swap via two assertions
- [ ] Writes results back via `singulars.upsert_eval_score(...)` RPC (idempotent)
- [ ] Updates `eval_runs` denormalized fields on completion: `win_rate`, `mean_rank`, `cost_usd`, `n_themes`, `n_themes_completed`, `status`, `started_at`, `finished_at`, `config_snapshot`, `error_message` (on failure)
- [ ] Failure modes from research/06 §7 are handled: judge timeouts (retry 3x), partial completion (resumable via idempotent upserts), cost overrun (`status='failed'`, `error_message='cost cap reached at $X'`), missing API keys (`status='failed'` with explicit env name)
- [ ] `--dry-run` flag generates the config and prints it without calling APIs (for the quality-gate smoke test)

**UX notes (CLI):**

- All log output is plain text, no color codes (Halim runs this from Vercel logs and terminal both).
- Progress format: `[<theme N>/<total>] <model> -> <theme name>: <result>` one line per theme.
- Final summary: 5-line block with model, perf, win_rate, cost, duration. No fancy box-drawing.
- Errors print to stderr with the env name explicit when an API key is missing: `missing OPENAI_API_KEY - set it in .env.local or Vercel env`.

**Reuse:** Read research/06 §4.3 first; do not rewrite the runner from scratch. Read research/02 §2.3 for the judge prompt - copy it character-for-character.

**Verification:**

1. `npm run eval -- --performance hard-exe --candidates claude-opus-4-7 --judge openai:gpt-5-5 --dry-run` - prints the resolved promptfooconfig.yaml, no API calls, exit 0.
2. With API keys set: `npm run eval -- --performance hard-exe --candidates claude-opus-4-7 --judge openai:gpt-5-5` - runs end-to-end, writes scores, writes run row.
3. Mid-run, kill the process - re-running with `--run-id <id>` resumes (idempotent upserts skip already-scored themes).
4. Set `EVAL_COST_CAP_USD=0.01` - run aborts with `error_message='cost cap reached at $0.01'`.
5. Unset `OPENAI_API_KEY` - run aborts with stderr `missing OPENAI_API_KEY - set it in .env.local or Vercel env`.

### US-111: API > start eval run

**Description:** As the admin UI, I want a single endpoint that creates run rows and triggers the runner.

**Acceptance Criteria:**

- [ ] Route at `src/app/api/admin/eval-runs/start/route.ts` (POST)
- [ ] Auth-gated via `requireAuth`
- [ ] Validates body: performance must be `trained`, candidates must be non-archived, judge model must be a known provider:model id
- [ ] For each candidate: insert an `eval_runs` row with `status='pending'`, `triggered_by='manual'`, `triggered_by_user='<cookie-derived-id>'`
- [ ] Triggers the runner asynchronously. **Recommended:** invoke a Vercel route at `/api/admin/eval-runs/[id]/_run` with `export const maxDuration = 300` and `runtime = 'nodejs'`, which shells out to `scripts/run-eval.ts --run-id <id>`. One run row → one Vercel function invocation, parallelizable.
- [ ] Returns `{ run_ids: uuid[] }` immediately, before the runner completes
- [ ] Failure to enqueue marks the run as `failed` with `error_message='enqueue failed: <reason>'`

**UX notes:** No UI - this powers US-107.

**Verification:**

1. POST without cookie - 401.
2. POST with invalid `performance_id` - 400 with body `{ "error": "performance not trained" }`.
3. POST with valid body - returns `{ run_ids: [...] }` within 500ms; runner invocations fire in background.
4. Simulate enqueue failure (e.g. malformed config) - run row marked `failed` with explicit message.

### US-112: API > eval run lifecycle endpoints

**Description:** As the admin UI, I want endpoints to cancel, rerun, and publish individual runs.

**Acceptance Criteria:**

- [ ] `POST /api/admin/eval-runs/[id]/cancel` - sets status to `cancelled`. The runner checks this between themes and aborts; partial scores remain.
- [ ] `POST /api/admin/eval-runs/[id]/rerun` - clones `config_snapshot` into a new `eval_runs` row with `status='pending'`, returns the new id.
- [ ] `POST /api/admin/eval-runs/[id]/publish` - body `{ published: boolean }`. Toggles `eval_runs.published`. Side effect: revalidates the `/api/evals/results` cache tag.
- [ ] All auth-gated.

**UX notes:** No UI - powers US-108.

**Verification:**

1. Cancel a `running` run - status flips; runner exits at next inter-theme boundary; partial `eval_scores` rows persist.
2. Rerun - new row created, `config_snapshot` matches the source.
3. Publish - flag flips; `revalidateTag('eval-results')` confirmed by Vercel logs; `/api/evals/results` returns fresh data.
4. All endpoints return 401 without cookie.

### US-113: API > performances admin endpoints

**Description:** Endpoints behind US-103 / US-104.

**Acceptance Criteria:**

- [ ] `GET /api/admin/performances` returns rows joined with vote-pair counts
- [ ] `POST /api/admin/performances/[slug]/status` - body `{ status }`, validates state machine (no skipping `upcoming → trained`)
- [ ] `POST /api/admin/performances/[slug]/sync-tallies` - recomputes `poems.vote_count` from `votes` for that performance, returns `{ updated: n }`
- [ ] `GET /api/admin/performances/[slug]/vote-pairs` - returns one row per theme with both poems and current vote counts
- [ ] `PATCH /api/admin/poems/[poem_id]` - body `{ vote_count, reason? }`. Audit-logged.
- [ ] `POST /api/admin/performances/[slug]/import-csv` - multipart upload, returns `{ ok, applied, errors[] }`
- [ ] All auth-gated.

**UX notes:** No UI - powers US-103 and US-104.

**Verification:**

1. `GET /api/admin/performances` returns array with `vote_pair_count` and `total_votes` per row.
2. `POST .../status` with `{ status: "trained" }` on an `upcoming` perf - allowed (skips training - this is the cancelled-show case). With `{ status: "training" }` on a `trained` perf - rejected with `400`.
3. `POST .../sync-tallies` returns `{ updated: 0 }` when in sync, > 0 when divergent.
4. `POST .../import-csv` with malformed file returns `{ ok: false, applied: 0, errors: [...] }`.

### US-114: API > candidate models CRUD

**Description:** Endpoints behind US-105.

**Acceptance Criteria:**

- [ ] `GET /api/admin/candidate-models` (auth) - returns all rows, including archived if `?include_archived=true`
- [ ] `POST /api/admin/candidate-models` (auth) - create
- [ ] `PUT /api/admin/candidate-models/[id]` (auth) - update
- [ ] `DELETE /api/admin/candidate-models/[id]` (auth) - soft-delete (sets `archived=true`)
- [ ] `POST /api/admin/candidate-models/[id]/toggle-public` (auth) - flips `is_public`
- [ ] Public read endpoint NOT needed - RLS handles anon reads via `is_public=true` directly when the chart query joins.

**UX notes:** No UI - powers US-105.

**Verification:**

1. `GET .../candidate-models` returns non-archived rows by default; `?include_archived=true` returns all.
2. POST a duplicate slug - `409 conflict` with body `{ "error": "slug taken" }`.
3. DELETE flips `archived=true` rather than deleting; confirm via SQL.
4. All endpoints 401 without cookie.

### US-115: Public API > eval results

**Description:** As a visitor, I want the public chart to load fast and from a single endpoint.

**Acceptance Criteria:**

- [ ] Route at `src/app/api/evals/results/route.ts` (GET)
- [ ] Public (no auth)
- [ ] Reads from `singulars.v_model_winrate_per_performance` (RLS auto-filters to `published=true AND status='completed'`)
- [ ] Returns the JSON shape from research/05 data-spec.md §3.1, **adapted to the canonical schema**:
  ```json
  {
    "performances": [{ "slug", "name", "color", "location", "date", "status" }, ...],
    "models": [{
      "slug", "name", "family", "color", "is_public",
      "series": [{ "perf": "<slug>", "rate": 0.0..1.0, "n_themes": int }, ...]
    }, ...]
  }
  ```
- [ ] Cache headers: `Cache-Control: s-maxage=300, stale-while-revalidate=86400`, tagged with `eval-results` for tag-based revalidation
- [ ] Cache busts when any `eval_runs.published` flips (called via `revalidateTag('eval-results')` from US-112)

**UX notes:**

- Color values returned must already be passed through `accessibleUIColor()` (3:1 against white) so the client can render directly without re-deriving.
- Empty `models` array is a valid response - the page handles "no published runs yet" client-side. Don't return 404.

**Verification:**

1. `curl http://localhost:3000/api/evals/results` returns 200 with the documented shape.
2. With no published runs: returns `{ performances: [...], models: [] }`.
3. After a publish toggle in US-108: within 1s a fresh request returns the new data point.
4. Inspect response headers - `Cache-Control` and `x-vercel-cache-tag` (or equivalent) present.

### US-116: Public API > theme drilldown

**Description:** As a visitor, when I click a matrix cell I want to see the per-theme detail.

**Acceptance Criteria:**

- [ ] Route at `src/app/api/evals/themes/route.ts` (GET) - query params `?model=<slug>&perf=<slug>`
- [ ] Public (RLS-gated)
- [ ] Returns the latest published run's per-theme rows joined with the audience-winner poem text:
  ```json
  {
    "model_slug", "performance_slug",
    "themes": [{
      "theme", "theme_slug",
      "audience_winner_text", "audience_winner_type",
      "candidate_text",
      "candidate_won", "confidence", "judge_rationale"
    }, ...]
  }
  ```
- [ ] No cache (response is small, request rate is tap-driven)

**UX notes:**

- `audience_winner_type` is `'human' | 'machine'` - the client uses this to label the winner block.
- All poem text returned with `\n` preserved - client must use `white-space: pre-line` to honor stanzas.
- If no published completed run exists for the (model, perf) pair, return `404` with body `{ "error": "no published run" }` so the client can show an empty drilldown gracefully.

**Verification:**

1. `curl '...?model=claude-opus-4-7&perf=hard-exe'` returns the documented shape.
2. With unpublished run: 404.
3. Poem text contains newlines (verify with `cat -A`).

### US-117: Public page > Model Evolution Chart

**Description:** As a visitor, I want a single page that visualizes how the project's poetry models have evolved against audience preference.

**Acceptance Criteria:**

- [ ] Page at `src/app/evolution/page.tsx` (rendered as `/singulars/evolution` once mounted under the existing routing)
- [ ] Renders the **Model Evolution Chart** matching `planning/research/05-visualization/view-1-evolution.html` exactly (line-per-model, x = performance milestones, y = win rate)
- [ ] Below it, the **Head-to-Head Matrix** matching `view-2-matrix.html` exactly
- [ ] Both consume `/api/evals/results` (US-115) on page load - single round-trip
- [ ] Hover/tap on a chart line shows the underlying tuples + a sample winning poem
- [ ] Tap on a matrix cell calls `/api/evals/themes` (US-116) and opens a drilldown panel
- [ ] Mobile: matrix scrolls horizontally with a sticky model column; chart squashes to ≥360px wide
- [ ] Loading state: skeleton lines/cells with monospace placeholder labels
- [ ] Empty state (no published runs yet): "Evaluation in progress - first results will appear after ground.exe."
- [ ] Accessibility: every line has a screen-reader-narrated description ("ground.exe rose from 41% on carnation.exe to 73% projected on ground.exe across 5 performances")
- [ ] Match the design language: Terminal Grotesque title, Diatype Mono Variable labels, CSS variables for colors, no dashboard chrome

**UX notes:**

- Page H1 is `"evolution"` in Terminal Grotesque, lowercase, single line. No subtitle.
- Below H1, a 2-3 sentence intro paragraph in Standard, secondary text, max-width `560px`. Copy: `"the audience trains the machine. each performance updates how every model fares against the winners. lines rising means models learning the room - or, sometimes, the room learning to lose."` (Halim voice - he can rewrite this on the page in 30 seconds, but ship a default that sounds like him.)
- Chart: `view-1-evolution.html` is the source of truth. Reproduce in recharts (already in scope per §4 tech table). Y axis 0-100% with `0.05em` letter-spaced mono labels. X axis = performances in date order. Lines in each model's accent color, 1.5px stroke. Hover = full opacity, others drop to `opacity 0.4` (selection-by-contrast-collapse from §6.5).
- Tooltip on hover/tap: white bg, hairline border, no shadow, no rounded corners. Content: model name (Diatype Variable `1.1rem`), `<perf name>: <rate>% (n=<themes>)` (mono), and on tap: a sample winning poem snippet (60 chars + ellipsis) with mono `view full →` link to drilldown.
- Matrix below the chart: row = model, column = performance. Cell shows win rate as `73%` in mono, with a 4px-tall horizontal bar in the model's accent color filling left-to-right by rate. Tap = drilldown panel slides up from bottom (mobile) or in from right (desktop).
- Drilldown panel: closes via `×` (mono, top right) or backdrop tap. Shows the themes array from US-116 as vertical blocks, each with theme name (Diatype Variable `1.1rem`), winner poem (Standard, `pre-line`), candidate poem (Standard, `pre-line`, with hairline left border in accent color when `candidate_won`), and judge rationale collapsed by default.
- Loading state: skeleton renders within 50ms - chart area shows 3 horizontal `rgba(0,0,0,0.06)` 1.5px lines at faux y-positions; matrix shows a grid of `rgba(0,0,0,0.06)` cells. No animation.
- Empty state copy is exactly per AC. Below it a mono link `← back to singulars`.
- Accessibility: chart wrapped in `<figure>` with `<figcaption>` listing each model's narration. Each matrix cell has `aria-label="<model> on <perf>: <rate> percent"`. axe-core scan must report no critical issues.
- Footer: a single line `"data: <last published run timestamp>. judge: <judge model name>."` in mono `0.85rem` secondary. Not a footer in the layout sense - just the last block on the page.

**Verification:**

1. With seed data: visit `/singulars/evolution` - chart and matrix render in design-system colors and type.
2. Hover a line - others dim to `opacity 0.4`; tooltip appears with rate + n.
3. Tap a matrix cell - drilldown panel opens with themes array; poems preserve line breaks.
4. Resize to 360px - chart still fits; matrix becomes horizontally scrollable with sticky model column.
5. axe-core via `npm run a11y` (or browser extension) shows no critical issues.
6. Empty DB state: page renders the empty-state copy without error.

### US-118: Landing page integration (optional)

**Description:** As Halim, I may want to embed a thumbnail of the chart on `/singulars` itself.

**Acceptance Criteria:**

- [ ] Below the existing performance card row on `/singulars`, an optional `<EvolutionThumbnail>` component renders a static 4:3 mini-chart
- [ ] Click expands to `/singulars/evolution`
- [ ] Toggleable via env `NEXT_PUBLIC_SHOW_EVOLUTION_ON_LANDING` (default: false until first published run exists)

**UX notes:**

- Thumbnail is a 320x240px (4:3) static SVG render of the chart - no interactivity, no tooltips, just the lines on a white field with mono performance labels along the x axis.
- Click area is the full thumbnail; cursor changes to the dot cursor in `ground.exe` accent (`#D97706`) on hover.
- Above the thumbnail: a single mono line `"how the models are doing →"`.
- When env is `false`, the component renders nothing - not a placeholder, not a comment, not a zero-height div. (Avoid layout shift on toggle.)

**Verification:**

1. Set env `NEXT_PUBLIC_SHOW_EVOLUTION_ON_LANDING=true`, build, deploy - thumbnail appears below card row.
2. Click thumbnail - navigates to `/singulars/evolution`.
3. Set env to `false` - thumbnail vanishes; page layout unchanged.

### US-119: Cron polling (off by default)

**Description:** As Halim, I want an optional reminder when a freshly-trained performance has no eval run.

**Acceptance Criteria:**

- [ ] Route at `src/app/api/admin/cron/check-trained/route.ts`
- [ ] `vercel.json` cron entry: `{ "path": "/api/admin/cron/check-trained", "schedule": "0 3 * * *" }`
- [ ] Looks up performances where `status='trained'` AND no `eval_runs` row with `status='completed'` exists from the last 24h
- [ ] If found AND `ADMIN_NIGHTLY_EMAIL` env is set: sends a single email "[performance.name] is ready to evaluate - open the admin to run it." Does NOT trigger anything.
- [ ] If env not set: no-ops silently
- [ ] Authed by Vercel's cron header check

**UX notes:** Email only. Plain text. Subject: `"[singulars] <performance> is ready to evaluate"`. Body: `"open https://singulars.oulipo.xyz/admin/eval-runs/new?performance=<slug> to run it. - the watcher"`. No HTML.

**Verification:**

1. Without `ADMIN_NIGHTLY_EMAIL` set, hit the route via Vercel cron header simulation - returns 200, no email sent.
2. With env set, hit the route while a `trained` performance has no recent completed run - one email sent.
3. Re-hit within 24h - no duplicate email.

### US-120: Cost monitoring on dashboard

**Description:** As Halim, I want to see eval spend at a glance so I don't accidentally rack up costs.

**Acceptance Criteria:**

- [ ] On `/admin` dashboard, a stat card shows: total eval spend this month, total this year, latest run cost
- [ ] If month-to-date spend exceeds 2× the typical (~$5/month), surface an amber warning
- [ ] Reads from `SUM(eval_runs.cost_usd) GROUP BY date_trunc('month', created_at)`

**UX notes:**

- Stat card is a hairline-bordered block, no fill, no shadow. Three values stacked vertically with mono labels above each: `month-to-date $X.XX`, `year $X.XX`, `latest run $X.XX`.
- Amber warning: 1px amber-3:1 border around the card + a mono line below `"month-to-date is 2x typical. check /admin/eval-runs."`.
- Click on the card navigates to `/admin/eval-runs`.

**Verification:**

1. Seed a run with `cost_usd=15` this month - card shows `month-to-date $15.00`, no warning.
2. Seed enough runs to exceed `$10` (2× typical) - warning border + line appears.
3. Click card - navigates to `/admin/eval-runs`.

### US-121: Training data export (SFT + DPO JSONL)

**Description:** As Halim, I want to turn audience-voted poem pairs into training data I can ship to OpenAI, Together AI, or any other fine-tuning provider - without leaving the admin or copy-pasting JSONL.

**Acceptance Criteria:**

- [ ] Page at `/admin/training-data` with a configurable export form: source performances (multi-select, defaults to all `trained`), exclude themes (multi-select), training format (radio: **SFT** / **DPO**), system prompt (textarea, default below), train/test split mode (radio: **none** / **random N%** / **hold out specific performance**)
- [ ] Live preview pane shows the first 5 rows of the resulting JSONL given the current form state, plus row count and approx token count
- [ ] Default system prompt: `"You are a poet. Write a short poem on the given theme. No preamble. Free verse. 8-24 lines. Avoid 'tapestry', 'whispers', em-dash overuse."` (matches the generation prompt in `scripts/run-eval.ts` from US-110 - keeps fine-tunes comparable across versions)
- [ ] **SFT format** (one row per `(theme, winner)` tuple, OpenAI-compatible):
  ```jsonl
  {
    "messages": [
      {
        "role": "system",
        "content": "<system_prompt>"
      },
      {
        "role": "user",
        "content": "<theme>"
      },
      {
        "role": "assistant",
        "content": "<winner_text>"
      }
    ]
  }
  ```
- [ ] **DPO format** (one row per `(theme, winner, loser)` triple - exploits the loser-poem signal the SFT format throws away):
  ```jsonl
  {
    "input": {
      "messages": [
        {
          "role": "system",
          "content": "<system_prompt>"
        },
        {
          "role": "user",
          "content": "<theme>"
        }
      ]
    },
    "preferred_output": [
      {
        "role": "assistant",
        "content": "<winner_text>"
      }
    ],
    "non_preferred_output": [
      {
        "role": "assistant",
        "content": "<loser_text>"
      }
    ]
  }
  ```
- [ ] Hold-out split: when "hold out specific performance" is chosen, the form lets Halim pick which `trained` performance becomes the test set. The training file excludes those tuples; a sibling `_holdout.jsonl` is generated for downstream eval calibration
- [ ] API: `GET /api/admin/training-data/export?format=sft|dpo&performances=...&exclude_themes=...&holdout=<slug>&system_prompt=<base64>` returns the JSONL stream with `Content-Disposition: attachment; filename="<auto>.jsonl"`
- [ ] Auth-gated. Source SQL: `singulars.golden_tuples_for_performance(<slug>)` per performance, unioned

**UX notes:**

- Form layout: 2 columns on desktop (form left, preview right), stacked on mobile (form first, then preview).
- Multi-selects use the same chip pattern as US-107.
- System prompt textarea: monospace (Diatype Mono), `1rem`, `12rem` tall, hairline border.
- Preview pane: monospace `0.85rem`, hairline border, fixed-height with internal scroll. Shows first 5 rows pretty-printed (one JSON object per line, no syntax highlighting - too much chrome). Above the preview: `"<row count> rows · ~<token count> tokens"` in mono.
- Filename auto-suggested: `singulars-<format>-<n>perfs-<YYYYMMDD>.jsonl` and `singulars-<format>-<n>perfs-holdout-<slug>-<YYYYMMDD>.jsonl` for the holdout file.
- Download button: accent color of the latest performance; mono label `"download <filename>"`.
- DPO unavailable for SFT-only providers (callout: `"DPO requires Together or OpenAI - HuggingFace AutoTrain is SFT-only"`).
- Empty state when no `trained` performances exist: `"no training data yet. flip a performance to trained first."`.

**Verification:**

1. Visit `/admin/training-data` - form renders with defaults; preview shows first 5 rows.
2. Switch format to DPO - preview format updates; row count drops (one row per triple).
3. Pick "hold out reverse-exe" - row count drops by reverse-exe's tuple count; download button label includes the holdout suffix.
4. Click download - browser downloads the .jsonl. Open it - line count matches preview.
5. `curl` the export endpoint without cookie - 401.

### US-122: Fine-tune jobs schema + webhooks

**Description:** As a developer, I want a table that tracks every fine-tune job kicked off from the admin, plus webhook receivers that update job status as providers report progress.

**Acceptance Criteria:**

- [ ] New migration file at `planning/research/07-migration-finetunes.sql` (additive, idempotent, in `singulars` schema)
- [ ] New enum `singulars.finetune_provider` with values: `'openai' | 'together' | 'huggingface' | 'replicate' | 'modal' | 'other'`
- [ ] New enum `singulars.finetune_format` with values: `'sft' | 'dpo'`
- [ ] New enum `singulars.finetune_status` with values: `'queued' | 'validating' | 'running' | 'succeeded' | 'failed' | 'cancelled'`
- [ ] New table `singulars.fine_tune_jobs` with columns:
  - `id uuid PK`
  - `provider singulars.finetune_provider NOT NULL`
  - `base_model text NOT NULL` (e.g. `'gpt-4o-mini-2024-07-18'`, `'meta-llama/Llama-3.3-70B-Instruct'`)
  - `training_format singulars.finetune_format NOT NULL`
  - `system_prompt text NOT NULL`
  - `source_performance_ids uuid[] NOT NULL`
  - `holdout_performance_ids uuid[] NOT NULL DEFAULT '{}'`
  - `n_training_rows integer`
  - `hyperparameters jsonb` (epochs, learning rate multiplier, batch size, etc. - provider-specific)
  - `provider_job_id text` (e.g. `'ftjob-abc123'` for OpenAI)
  - `provider_file_id text` (the uploaded JSONL's id on the provider side)
  - `status singulars.finetune_status NOT NULL DEFAULT 'queued'`
  - `output_model_id text` (populated on success, e.g. `'ft:gpt-4o-mini-2024-07-18:personal:singulars-ground-v2:abc123'`)
  - `auto_registered_candidate_id uuid REFERENCES singulars.candidate_models(id)` (the row auto-created on success)
  - `cost_usd numeric(10,4)`
  - `started_at timestamptz`, `finished_at timestamptz`, `duration_ms integer`
  - `error_message text`
  - `triggered_by_user text`
  - `created_at timestamptz NOT NULL DEFAULT now()`
- [ ] Indexes on `(provider, status)` and `(provider_job_id)` (UNIQUE)
- [ ] RLS: admin-only read/write via service role; no anon access
- [ ] Webhook routes:
  - `POST /api/admin/fine-tunes/webhooks/openai` - verifies `OpenAI-Webhook-Signature` header, parses event, updates the matching `fine_tune_jobs` row by `provider_job_id`
  - `POST /api/admin/fine-tunes/webhooks/together` - verifies HMAC signature, updates row
- [ ] Webhook routes are public (signature-verified) but rate-limited; failures log and return 200 to avoid retries flooding
- [ ] Polling fallback: a Vercel cron at `/api/admin/cron/poll-finetunes` runs every 10 minutes, polls provider APIs for any job in `running`/`validating` state with no recent webhook update, syncs status. Off by default, on when `FINETUNE_POLLING=1`

**UX notes:** No UI here.

**Verification:**

1. Apply `07-migration-finetunes.sql` twice - no errors second time.
2. Insert a fake job, simulate an OpenAI webhook payload with valid signature - row updates.
3. Same payload with invalid signature - 401.
4. Without `FINETUNE_POLLING=1`, hit `/api/admin/cron/poll-finetunes` - returns 200 with body `{ "polled": false, "reason": "FINETUNE_POLLING not set" }`.

### US-123: Fine-tune kick-off UI

**Description:** As Halim, I want to start a fine-tune job from the admin in <60 seconds, with a clear cost preview and the new model auto-registered as a candidate.

**Acceptance Criteria:**

- [ ] Form at `/admin/fine-tunes/new` with fields:
  - **Provider** (radio: OpenAI / Together AI / HuggingFace AutoTrain) - disable providers whose API key is missing in env
  - **Base model** (select, filtered by provider): for OpenAI: `gpt-4o-mini-2024-07-18`, `gpt-4.1-2025-04-14`, `gpt-3.5-turbo-1106`; for Together: `meta-llama/Llama-3.3-70B-Instruct`, `Qwen/Qwen3-14B`, `mistralai/Mistral-Nemo-Instruct-2407`
  - **Training format** (radio): SFT / DPO. Greys out DPO if provider doesn't support it (HuggingFace AutoTrain currently SFT-only)
  - **Source performances** (multi-select, defaults to all `trained`)
  - **Hold out performance** (single select, defaults to "latest trained" - that performance becomes the implicit test set)
  - **System prompt** (textarea, prefilled with the US-121 default; editable)
  - **Hyperparameters** (collapsible "advanced" section): epochs (default 3), learning rate multiplier (default 1.0 for OpenAI, lr 1e-5 for Together), batch size (auto)
  - **Cost cap** (number input, default `FINETUNE_COST_CAP_USD` env, default $50)
  - **Candidate model name** (auto-suggested: e.g. `"ground.exe (v2 - 4o-mini-DPO)"`; editable)
- [ ] Live cost estimator: `n_training_rows × tokens_per_row × n_epochs × $/M-tokens` per provider's pricing. Shows "Estimated $X.XX, cap $Y.YY" before submit
- [ ] Submit calls `POST /api/admin/fine-tunes/start` with full form payload
- [ ] Server-side flow:
  1. Generate the JSONL via the same logic as US-121
  2. Upload it to the chosen provider (`POST /v1/files` for OpenAI; equivalent for Together)
  3. Kick off the fine-tune job (`POST /v1/fine_tuning/jobs` for OpenAI)
  4. Insert a `fine_tune_jobs` row with status `'queued'`, the provider's `job_id`, `file_id`, and `training_data_snapshot` (full JSONL stored as jsonb for reproducibility)
  5. Pre-create a `candidate_models` row in `archived=false, is_public=false` state with the proposed name and a placeholder `api_endpoint` (filled on success). Link via `fine_tune_jobs.auto_registered_candidate_id`
- [ ] On submit, redirects to `/admin/fine-tunes/[id]` (US-124)

**UX notes:**

- Provider radio: each option is a chip with provider name in mono. Disabled providers at `opacity 0.4` with a small mono suffix `(set OPENAI_API_KEY)` or `(set TOGETHER_API_KEY)`.
- Base model select: native `<select>` is fine here - lists are short and stable.
- Format radio: 2 chips, SFT and DPO. DPO chip disabled with `opacity 0.4` + suffix `(provider does not support DPO)` when applicable.
- Source performances: same chip multi-select pattern as US-107 / US-121.
- Holdout: native single `<select>` with options matching trained perfs. Default is the latest one (highest `date`).
- System prompt textarea: same as US-121 (mono, 12rem tall, hairline).
- Advanced section: a `+ advanced` mono link. On click, expands inline to show 3 inputs. No accordion icon.
- Cost estimator: same look as US-107 (`$X.XX` in Diatype Variable `1.6rem / 700`, cap below in mono). Goes red when over cap.
- Candidate name input: prefilled but editable. Validated for slug uniqueness same as US-105.
- Submit button: large, accent color of the latest performance, mono label `"start fine-tune"`. After submit, button text becomes `"starting..."` for up to 10s while the JSONL uploads, then redirects.
- Network error state: red-3:1 mono error inline below the button: `"failed to upload to <provider>: <error>"`.
- Disable submit until: provider chosen + base model chosen + ≥1 source performance + name is unique.

**Verification:**

1. Without `OPENAI_API_KEY` set: OpenAI radio disabled with the suffix copy.
2. Set valid form, submit - within 10s redirect to `/admin/fine-tunes/<id>`. Provider's API receives the JSONL; their dashboard shows the queued job.
3. Cost estimator goes red when cap lowered below estimate; submit disables.
4. Candidate model name conflict surfaces inline.

### US-124: Fine-tune monitoring + auto-register

**Description:** As Halim, I want to watch fine-tune jobs run, see them finish overnight, and have the resulting model show up in my candidate list ready to evaluate without any copy-paste.

**Acceptance Criteria:**

- [ ] Page at `/admin/fine-tunes` lists all jobs with: provider | base model | format | source performances (chips) | status pill | duration | cost | output model id | actions
- [ ] Live polling (5s) for any visible job in `queued`/`validating`/`running`
- [ ] Detail page at `/admin/fine-tunes/[id]`: full status, hyperparameters table, training data summary (rows, tokens, performances), live training-loss chart if the provider returns one (OpenAI does), cost-so-far, error_message on failure, "View on provider" link
- [ ] On `status='succeeded'` (set by webhook from US-122):
  1. The auto-registered `candidate_models` row's `api_endpoint` is populated with the canonical promptfoo provider id format (`openai:chat:ft:gpt-4o-mini-...:personal:singulars-ground-v2:abc123` or `together:fine-tunes:halim/ground-exe-v2`)
  2. A toast appears in the admin nav: "ground.exe (v2 - 4o-mini-DPO) is ready. Run eval?"
  3. Clicking the toast pre-fills the `/admin/eval-runs/new` form (US-107) with: the new candidate, the holdout performance from US-123, and the default judge model
- [ ] On `status='failed'`: surface `error_message` + a "Retry" button that re-submits the same job config (new row, same params)
- [ ] CLI parity: `npm run finetune -- --provider openai --base gpt-4o-mini-2024-07-18 --format dpo --performances carnation-exe,versus-exe,reinforcement-exe,hard-exe --holdout reverse-exe --name "ground.exe (v2)"` does the same thing from the terminal

**UX notes:**

- List view layout matches US-106 (table desktop, stacked mobile).
- Status pills: `queued` (gray), `validating` (mono with blinking dot), `running` (mono with blinking dot), `succeeded` (white bg, black border, `"ready"` instead of `"succeeded"` - more direct), `failed` (red-3:1), `cancelled` (gray secondary).
- Detail page hyperparameters table: 2-column key/value, mono.
- Training-loss chart (OpenAI only): a recharts line chart with x = step, y = loss. Same design-system styling as US-117 chart - 1.5px stroke, mono labels, no shadows.
- Cost-so-far: stat block updates on every poll/webhook.
- "View on provider" link: opens in a new tab, mono with `↗`.
- Toast in admin nav: persistent (no auto-dismiss) until clicked or dismissed via `×`. Up to 3 stacked. Position: top-right desktop, top-center mobile.
- Toast clicking pre-fills `/admin/eval-runs/new` via URL params (`?candidate=<slug>&performance=<slug>&judge=<provider:model>`); the form picks them up and renders pre-selected.
- Failed state: detail page shows error in red-3:1 mono block; "retry" button below, mono accent.
- Empty state: `"no fine-tune jobs yet. start one →"` linking to US-123.

**Verification:**

1. Start a job via US-123 - row appears in `/admin/fine-tunes` as `queued`.
2. Simulate webhook progression `queued -> validating -> running -> succeeded` - status pill updates within 5s of each change (or instantly via webhook).
3. On `succeeded`: candidate model row's `api_endpoint` is populated; toast appears in admin nav; clicking toast lands on `/admin/eval-runs/new` with pre-filled fields.
4. Trigger a `failed` status - detail page shows error + retry button; click retry creates a new row with identical config.
5. CLI: `npm run finetune -- ...` runs end-to-end same as the UI.

### US-125: Fine-tune cost dashboard

**Description:** As Halim, I want to see fine-tune spend separately from eval spend so I can budget the project as a whole.

**Acceptance Criteria:**

- [ ] On `/admin` dashboard, a second stat card shows fine-tune spend (this month / this year / latest job cost)
- [ ] Combined month-to-date total (eval + fine-tune) is also shown
- [ ] Reads from `SUM(fine_tune_jobs.cost_usd) GROUP BY date_trunc('month', created_at)`

**UX notes:**

- Two stat cards side-by-side on desktop (eval | fine-tune), stacked on mobile.
- Below them, a single line in mono `0.95rem`: `"combined month-to-date: $X.XX"`.
- Same warning behavior as US-120 - if combined exceeds 2× typical (~$10/month), amber border + line.

**Verification:**

1. Seed an eval run ($5) and a fine-tune job ($30) this month - eval card shows `$5`, fine-tune shows `$30`, combined line shows `$35.00`.
2. Combined exceeds 2× - warning appears.
3. Click fine-tune card - navigates to `/admin/fine-tunes`.

---

## 8. Phasing

The 21 user stories above are roughly grouped into three phases. Ship in this order:

**Phase 1 - Schema + admin shell (1-2 days):**

- US-100 (migration)
- US-101 (shared auth)
- US-102 (admin shell)
- US-103 (performances tab)
- US-104 (vote entry)

**Phase 2 - Eval pipeline (2-3 days):**

- US-105 (models CRUD)
- US-106 (eval runs list)
- US-107 (start run)
- US-108 (run detail)
- US-110 (runner script)
- US-111, US-112, US-113, US-114 (APIs)
- US-120 (cost dashboard)

**Phase 2.5 - Fine-tuning (1-2 days):**

- US-121 (training data export)
- US-122 (fine-tune jobs schema + webhooks)
- US-123 (kick-off UI)
- US-124 (monitoring + auto-register)
- US-125 (fine-tune cost dashboard)

**Phase 3 - Public surface (1-2 days):**

- US-115, US-116 (public APIs)
- US-117 (evolution page)
- US-109 (publish controls)
- US-118 (landing thumbnail, optional)
- US-119 (cron, optional)

Phase 1 ships before ground.exe (June 12 2026) at the latest, so Halim can enter votes from the show in the new admin. Phase 2 + 2.5 ship right after, so the post-show ritual works: vote-entry → fine-tune kickoff (overnight) → eval against the fresh fine-tunes (morning). Phase 3 ships in time for the first public reveal of the chart with ground.exe data.

**Decoupling note:** Phases 2 and 2.5 are intentionally independent. The model that performs at any given show has nothing to do with the models being fine-tuned afterward. One model duels Halim on stage; **all** candidate fine-tunes (across providers and formats) get to learn from the resulting (theme, winner, loser) tuples. This means Halim can ship 4o-mini-DPO, Llama-3.3-SFT, and Qwen3-DPO variants in parallel, evaluate them all against the same holdout performance, and pick whichever wins for the next stage night - without ever locking the catalog into one base model.

### 8.1 Hidden assumptions surfaced _(new in v1.1)_

These are load-bearing assumptions an implementing agent might miss. Confirm before coding the affected story:

1. **Cookie domain is identical for `/theme-voting/admin` and `/admin`** (US-101). Both routes serve from `singulars.oulipo.xyz`; no subdomain split. If a future split happens, cookie sharing breaks.
2. **`poems.vote_count` is a denormalized cache of `votes`** (US-103). Sync-tallies recomputes; the `votes` table is the source of truth. Edits via US-104's PATCH go to `vote_count` directly (overrides the cache); the audit log captures the override. There is no trigger keeping these in sync.
3. **No DPO support on HuggingFace AutoTrain at PRD-write-time** (US-123). If this changes, lift the gating.
4. **`config_snapshot` on `eval_runs` is the full reproducibility blob** (US-110, US-112). Reruns clone this verbatim. If you change the runner's config shape, write a migration that backfills existing snapshots.
5. **`accessibleTextColor()` and `accessibleUIColor()` exist in `src/lib/color-utils.ts`** (already shipped, used throughout `/singulars`). Do not re-derive contrast logic in admin code; import these.
6. **promptfoo has no native DPO eval mode** (US-110, US-117). DPO matters for fine-tuning (US-121, 123) but not for eval - eval always compares a candidate's generated poem against the audience-voted winner via a judge.
7. **The judge prompt in research/02 §2.3 is calibrated** (US-110). Do not paraphrase. Copy it character-for-character into the runner. Calibration (research/02 §2.5) is an open question (§9.5 below) and not in scope unless that question is answered.
8. **`is_public` AND `published` is the visibility gate** (US-115, US-105, US-108). Toggling either to false hides the data point. The matrix in US-109 visualizes both axes.
9. **`triggered_by_user` is derived from the cookie hash** (US-111). It is not a real user id - just a stable per-session hash so the audit log can group actions.
10. **Vercel function `maxDuration: 300` is the runner's wall clock** (US-111). If a single-candidate eval exceeds 5 minutes, the function will be killed and the run row will be left in `running` state. The next manual visit to `/admin/eval-runs` should not auto-fail it - the runner script's idempotent upserts mean a rerun resumes cleanly.

## 9. Open questions for Halim

These need an artist's call. Each maps to research/06 §10:

1. **Default judge model** - research recommends GPT-5.5 (cross-family from Claude candidates, cheap). Confirm.
2. **Publish-by-default** - currently `published=false`. Should `is_public=true` candidates auto-publish runs?
3. **Recency-weighting** - should `carnation.exe` data points fade over time on the public chart?
4. **Vote-entry audit** - v1 overwrites `poems.vote_count` directly. v2 could add a `poem_vote_overrides` table. Worth it for v1?
5. **Calibration cohort** - research/02 §2.5 specifies a Surge/Prolific human-labeling job to calibrate the judge to ≥80% agreement. Wire into this admin (a "calibration mode") or run as a separate one-time project before ground.exe?
6. **Public chart mounting** - `/singulars/evolution`, `/singulars/about/evolution`, or inline on `/singulars`?
7. **Position-bias threshold** - currently warn if >30% of themes diverge under A/B swap. Right number?

---

## 10. Cost summary

From research/06 §8: full bake-off (5 candidates × 1 performance × 8 themes, Opus judge, A/B swap) costs **~$1.74**. Yearly steady-state across 3-4 shows + periodic re-runs against the historical catalogue: **~$50/year**. Default per-run cost cap is $20, comfortably above any single run.

Calibration spend (one-time, via Surge/Prolific): $1,500-2,400 per research/02 §2.5. Not part of the recurring budget.

## 11. Files this PRD touches

```
NEW
  planning/research/06-migration-evals.sql                                     (already exists; apply via US-100)
  scripts/run-eval.ts                                                          (US-110)
  src/lib/admin-auth.ts                                                        (US-101)
  src/lib/admin-styles.ts                                                      (US-102)
  src/app/admin/layout.tsx                                                     (US-102)
  src/app/admin/page.tsx                                                       (US-102, US-120)
  src/app/admin/login/page.tsx                                                 (US-102)
  src/app/admin/performances/page.tsx                                          (US-103)
  src/app/admin/performances/[slug]/votes/page.tsx                             (US-104)
  src/app/admin/models/page.tsx                                                (US-105)
  src/app/admin/models/[id]/page.tsx                                           (US-105)
  src/app/admin/eval-runs/page.tsx                                             (US-106)
  src/app/admin/eval-runs/new/page.tsx                                         (US-107)
  src/app/admin/eval-runs/[id]/page.tsx                                        (US-108)
  src/app/admin/publish/page.tsx                                               (US-109)
  src/app/api/admin/auth/route.ts                                              (US-101)
  src/app/api/admin/performances/route.ts                                      (US-113)
  src/app/api/admin/performances/[slug]/status/route.ts                        (US-113)
  src/app/api/admin/performances/[slug]/sync-tallies/route.ts                  (US-113)
  src/app/api/admin/performances/[slug]/vote-pairs/route.ts                    (US-113)
  src/app/api/admin/performances/[slug]/import-csv/route.ts                    (US-113)
  src/app/api/admin/poems/[id]/route.ts                                        (US-113)
  src/app/api/admin/candidate-models/route.ts                                  (US-114)
  src/app/api/admin/candidate-models/[id]/route.ts                             (US-114)
  src/app/api/admin/candidate-models/[id]/toggle-public/route.ts               (US-114)
  src/app/api/admin/eval-runs/route.ts                                         (US-106)
  src/app/api/admin/eval-runs/start/route.ts                                   (US-111)
  src/app/api/admin/eval-runs/[id]/route.ts                                    (US-108)
  src/app/api/admin/eval-runs/[id]/cancel/route.ts                             (US-112)
  src/app/api/admin/eval-runs/[id]/rerun/route.ts                              (US-112)
  src/app/api/admin/eval-runs/[id]/publish/route.ts                            (US-112)
  src/app/api/admin/eval-runs/[id]/_run/route.ts                               (US-111 - Vercel-side runner invocation)
  src/app/api/admin/cron/check-trained/route.ts                                (US-119)
  src/app/api/evals/results/route.ts                                           (US-115)
  src/app/api/evals/themes/route.ts                                            (US-116)
  src/app/evolution/page.tsx                                                   (US-117)
  vercel.json                                                                  (US-119, US-122 cron)
  planning/research/07-migration-finetunes.sql                                 (US-122)
  src/app/admin/training-data/page.tsx                                         (US-121)
  src/app/admin/fine-tunes/page.tsx                                            (US-124)
  src/app/admin/fine-tunes/new/page.tsx                                        (US-123)
  src/app/admin/fine-tunes/[id]/page.tsx                                       (US-124)
  src/app/api/admin/training-data/export/route.ts                              (US-121)
  src/app/api/admin/fine-tunes/route.ts                                        (US-124 list)
  src/app/api/admin/fine-tunes/start/route.ts                                  (US-123)
  src/app/api/admin/fine-tunes/[id]/route.ts                                   (US-124 detail)
  src/app/api/admin/fine-tunes/[id]/retry/route.ts                             (US-124)
  src/app/api/admin/fine-tunes/webhooks/openai/route.ts                        (US-122)
  src/app/api/admin/fine-tunes/webhooks/together/route.ts                      (US-122)
  src/app/api/admin/cron/poll-finetunes/route.ts                               (US-122 fallback)
  scripts/run-finetune.ts                                                      (US-124 CLI parity)
  src/lib/finetune-providers.ts                                                (US-123 - OpenAI + Together API wrappers)

MODIFIED
  src/app/api/themes/admin/auth/route.ts                                       (refactored to use lib/admin-auth.ts; US-101)
  src/app/theme-voting/admin/page.tsx                                          (uses lib/admin-styles.ts; US-102)
  package.json                                                                 ("eval" script + promptfoo + tsx + yaml deps; US-110)
  next.config.mjs                                                              (revalidateTag wiring if needed; US-115)
```

---

## 12. Definition of Done for the whole project

The day Halim can:

1. After a show, open `singulars.oulipo.xyz/admin` from his phone
2. Enter the venue's paper-ballot votes for each theme
3. Flip the performance to `trained`
4. Open **Fine-tunes**, kick off two or three jobs in parallel - e.g. `gpt-4o-mini` SFT, `gpt-4o-mini` DPO, and `Llama-3.3-70B` DPO - each holding out the latest performance as a clean test set. Close the laptop. The jobs run overnight on the providers.
5. Next morning, open the admin again. The completed fine-tunes are auto-registered as `candidate_models`. Click the "Run eval?" toast.
6. Pick three candidates (including the new fine-tunes) and a $20 cap; click Run. Watch the eval complete (~10-30 min)
7. Open the run detail and read each candidate's poem and the judge's verdict per theme
8. Toggle "Publish" on the winning runs
9. Open `singulars.oulipo.xyz/evolution` and see the new ground.exe data points land on the chart, in their colors, ahead of the previous fine-tunes

- and the round trip from "show ends" to "chart updates publicly" is under 90 minutes of his attention spread across one evening and one morning, with the providers and the eval runner doing the unattended work in between.

That's done.
