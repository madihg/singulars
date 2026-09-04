# Singulars Project Context

Reference file for Claude Code sessions. This captures decisions, setup details, and progress so nothing gets lost between conversations.

## Supabase Setup

- **Project name:** singulars
- **Dashboard:** https://supabase.com/dashboard (look for "singulars" project)
- **Project URL:** `https://smytgqkgomsfyurskpcl.supabase.co`
- **Credentials location:** `.env.local` (not committed to git)
- **Required env vars:**
  - `NEXT_PUBLIC_SUPABASE_URL` - Project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - publishable key
  - `SUPABASE_SERVICE_ROLE_KEY` - secret key (for seed scripts, bypasses RLS)
- **Vercel env vars:** All 3 set for production, preview, and development (Feb 2026)
- **Status:** Connected and seeded with 66 real poems (Feb 2026)

## Database Schema

Three tables: `performances`, `poems`, `votes`

- Schema file: `scripts/schema.sql`
- Apply with: `node scripts/apply-schema.mjs`
- Seed with: `node scripts/seed.mjs [optional-json-path]`
- Default seed file: `scripts/seed-data.json`
- Real poems extracted from PDF: `scripts/poems-from-pdf.json`

## Performances

| Performance       | Slug              | Color   | Status   | Themes                                   |
| ----------------- | ----------------- | ------- | -------- | ---------------------------------------- |
| reverse.exe       | reverse-exe       | #8B5CF6 | upcoming | 0                                        |
| hard.exe          | hard-exe          | #2AA4DD | training | 4 (Particles, Diegetic, Sun, Romance)    |
| reinforcement.exe | reinforcement-exe | #02F700 | trained  | 18 themes                                |
| versus.exe        | versus-exe        | #FEE005 | trained  | 7 (incl. Solitude split into 2 rounds)   |
| carnation.exe     | carnation-exe     | #F6009B | trained  | 4 (Liberté, Solitude, La Ville, Enfance) |

Total: 33 themes, 66 poems

## Data Pipeline

1. Poems were extracted from `Carnation Poems.pdf` (Google Sheets export of all performances)
2. Human/machine labeling was done via content analysis + PDF markers
3. All human poems initially attributed to "Halim Madi" - some need correction (other poets contributed to versus.exe)
4. `scripts/poems-from-pdf.json` is the authoritative data file with real poems
5. `scripts/seed-data.json` still has placeholder/fake poems - should be replaced

## Deployment

Updated September 2026. Full detail in `docs/DEPLOYMENT.md`.

- **Git repo:** madihg/singulars (public), production branch `main`, root directory = repo root
- **Vercel project:** singulars (prj_wAF6Dx0ddTLn2WhNlIMAWapI0cp3)
- **Team:** halims-projects (team_9h3UVrcMfPTPWYdvGpnKezrd)
- **Framework:** Next.js 14 (App Router), Node 24.x
- **basePath:** `/singulars` (next.config.mjs)
- **Public URL:** https://www.halimmadi.com/singulars - the halim-madi project rewrites `/singulars/:path*` to `https://singulars.oulipo.xyz/singulars/:path*`
- **Origin domain:** singulars.oulipo.xyz. Its `vercel.json` rewrites `/api/:path*` to `/singulars/api/:path*`, which keeps the registered OpenAI and Together webhook URLs alive and makes the server-side self-fetches resolve. Everything else on that host 301s to www.halimmadi.com/singulars.
- **Auto-deploy:** Vercel Git integration on push to `main`. The old GitHub Action and the oulipo monorepo root directory are gone.
- **Cron:** `/singulars/api/admin/cron/check-trained` daily at 03:00 UTC (a no-op until ADMIN_NIGHTLY_EMAIL and RESEND_API_KEY are set)
- **Env vars:** names and per-environment coverage are listed in `docs/DEPLOYMENT.md`
- **basePath rule:** `next/link` hrefs and middleware paths are written WITHOUT `/singulars`; `fetch()` strings, `window.location.href` and plain `<a href>` keep it
- **Before pushing:** `npm run verify` (next build, tsc --noEmit, scripts/verify-copy.mjs)
- **Open, dashboard-only:** set `OPENAI_WEBHOOK_SECRET` and `TOGETHER_WEBHOOK_SECRET` in Vercel (signature checks are skipped while they are empty) and confirm the callback URLs registered at OpenAI and Together

## Key Decisions Made

- Anonymous voting with fingerprint-based dedup (@fingerprintjs/fingerprintjs)
- Poems displayed as pairs: 1 human + 1 machine per theme
- Only "training" performances accept votes
- Vote counts start at 0 on the website (live performance counts stored in `_live_votes` metadata in JSON)
- Touch Grass theme (reinforcement.exe): order swapped from PDF - first poem is machine based on content analysis
- Enfance (carnation.exe): PDF label contradicts content - attributed to Halim based on Arabic reference in poem

## Unified Platform Consolidation (March 2026)

Consolidated 7 standalone projects into Singulars. All standalone folders have been deleted.
PRDs: `tasks/prd-unified-singulars.md`, `tasks/prd-theme-admin.md`

### What was consolidated

| Standalone project(s)                                              | Absorbed into         | Status   |
| ------------------------------------------------------------------ | --------------------- | -------- |
| carnation-fr, carnation-eng, versus, reinforcement, hard-exe       | `/chat` (unified)     | Deployed |
| singulars-theme-voting (Express.js on singulars-voting.vercel.app) | `/theme-voting`       | Deployed |
| singulars-timer (static HTML)                                      | `/timer`              | Deployed |
| (new)                                                              | `/theme-voting/admin` | Deployed |

All 7 standalone folders deleted from `/Users/halim/Documents/` on 2026-03-27.

### Routes added

- `/chat` - Unified chat with 5 fine-tuned GPT-4.1-nano models (persistent sidebar on desktop, dropdown on mobile)
- `/theme-voting` - Public theme suggestion + upvoting (Supabase-backed, optimistic UI)
- `/theme-voting/admin` - Password-protected admin panel (password: the `ADMIN_PASSWORD` env var)
- `/timer` - 30-min performance countdown with break mode, light/dark toggle, browser notifications

### Files added

**Chat system:**

- `src/lib/models.ts` - Model registry (5 models: carnation-fr, carnation-eng, versus, reinforcement, hard) with colors, system prompts
- `src/app/api/chat/route.ts` - Streaming chat API (edge runtime, OpenAI SDK)
- `src/app/chat/page.tsx` - Chat UI with ModelSidebar, MobileModelSelector, WelcomeScreen

**Theme voting:**

- `scripts/migration-themes.sql` - Themes table DDL (additive only, singulars schema)
- `scripts/import-themes.mjs` - One-time import of 27 themes from old production app
- `src/app/api/themes/route.ts` - GET (list) + POST (create) themes
- `src/app/api/themes/[id]/upvote/route.ts` - Atomic upvote via RPC
- `src/app/theme-voting/page.tsx` - Public voting UI

**Admin panel:**

- `src/app/api/themes/admin/auth/route.ts` - Password auth (HttpOnly cookie, HMAC-SHA256, 24h expiry)
- `src/app/api/themes/admin/[id]/route.ts` - PUT (edit) + DELETE theme
- `src/app/api/themes/admin/[id]/toggle-complete/route.ts` - PATCH toggle completed
- `src/app/theme-voting/admin/page.tsx` - Admin dashboard (stats, inline edit, delete with confirm, add theme, logout)

**Timer:**

- `src/app/timer/page.tsx` - Timer page

**Other changes:**

- `src/app/page.tsx` - Added nav links (Chat, Theme Voting, Timer) to landing page
- `src/app/globals.css` - Added responsive CSS for chat sidebar (768px breakpoint)
- `.env.local.example` - Added OPENAI_API_KEY

### Dependencies added

- `openai` (^4.104.0) - OpenAI API client for chat
- `ai` (^2.2.37) - Vercel AI SDK for streaming (useChat, OpenAIStream, StreamingTextResponse)
- `clsx` (^2.1.1) - Conditional classnames
- `react-textarea-autosize` (^8.5.9) - Auto-expanding chat input

### Design system

All new pages use the Singulars design system:

- **Terminal Grotesque** - Large display text (timer digits, page titles)
- **Diatype Variable** - Headings
- **Diatype Mono Variable** - Labels, buttons, monospaced text
- **Standard** - Body text
- CSS variables: `--background`, `--text-primary`, `--text-secondary`, `--text-hint`, `--border-light`
- Fonts loaded from type.cargo.site CDN (see `src/app/layout.tsx`)

### Database: themes table

- Table: `singulars.themes` (same schema as all other tables - NOT public schema)
- Columns: id (uuid), content, theme_slug, votes, completed, archived, performance_id (nullable FK), created_at, updated_at
- Unique index on `lower(content)` (case-insensitive)
- RLS: public read + insert for anon role
- RPC: `singulars.upvote_theme(p_theme_id)` for atomic vote increment
- 27 themes imported from old production (26 completed, 1 active: "Liberation")
- Migration applied manually via Supabase SQL Editor

### Technical notes

- `openai@4.x` + `ai@2.x` type mismatch on `OpenAIStream` - fixed with `as any` cast in `api/chat/route.ts`
- Chat API runs on edge runtime for streaming
- Admin auth reads `ADMIN_PASSWORD`, falling back to `THEME_ADMIN_PASSWORD`. There is no default password: with neither set, `src/lib/admin-auth.ts` fails closed and logs. The cookie is HMAC-SHA256(SUPABASE_SERVICE_ROLE_KEY, password).
- themes.theme_slug matches poems.theme_slug by convention (no FK) for future linking
- Supabase env vars are only in Vercel Production environment (not Development) - use `vercel env pull .env.production.local --environment production` for local scripts
- The themes unique index is functional (`lower(content)`) so Supabase upsert with `onConflict: "content"` won't work - use individual inserts with error handling instead

## What Still Needs Doing

- [x] Add Supabase credentials to `.env.local` and Vercel env vars (done Feb 2026)
- [x] Seed database with `poems-from-pdf.json` (done Feb 2026 - 66 poems)
- [x] Clean up old placeholder poems from DB (done Feb 2026 - removed 18 placeholders)
- [x] Consolidate chat apps into /chat (done March 2026)
- [x] Port theme-voting to /theme-voting (done March 2026)
- [x] Port timer to /timer (done March 2026)
- [x] Run migration-themes.sql in Supabase (done March 2026)
- [x] Add OPENAI_API_KEY to Vercel (done March 2026)
- [x] Deploy and verify all routes (done March 2026; re-verified September 2026 under www.halimmadi.com/singulars)
- [x] Build admin panel at /theme-voting/admin (done March 2026)
- [x] Import 27 themes from old production app (done March 2026)
- [x] Delete absorbed standalone folders (done March 2026 - 7 folders removed)
- [ ] Verify human/machine assignments - Halim to review
- [ ] Identify non-Halim poets in versus.exe and update author_name
- [ ] Update performance metadata (locations, dates, model_link, huggingface_link) if placeholders
- [ ] Replace `seed-data.json` with real data from `poems-from-pdf.json`

## Design: the Desktop language (Sep 2026)

Every page of this app wears the Desktop design language of halimmadi.com.
See `DESIGN.md` at the repo root for where the CSS and JS come from, how
`scripts/sync-desktop.mjs` keeps them from drifting, which route group carries
chrome, and the copy rules `npm run verify` enforces. Read it before changing
anything visual.

Short version:

- `src/app/desktop/{tokens,desktop}.css` and `public/desktop/{desktop,machine}.js`
  plus `public/desktop/machine.css` are copies of the halim-madi canon. Never
  edit them here; `scripts/sync-desktop.mjs --write` brings them over and
  applies the declared URL swaps.
- `src/app/globals.css` is reset and fonts only. Page-scoped rules live in
  `src/app/desktop/pages.css`, all prefixed `sg-`.
- The menu bar, footer and mascot are rendered once by the root layout
  (`SiteShell`), because desktop.js binds them once. `/[slug]/stage`,
  `/[slug]/control` and `/timer` are venue screens with no chrome. `/admin` gets
  the chrome plus an "admin/" nav window.
- Tailwind is gone (it was never used): no `tailwind.config.ts`, no
  `postcss.config.mjs`.
- Follow-up not done in the reskin: the stills under `public/images/` are
  originals, some 5712px wide, and they are what the cards load. They want a
  1600px variant.

## Round 4 (Sep 2026)

Seven changes, all on the desk surface.

- The favicon is the halimmadi.com mark: a cobalt (#1C39E8) disc,
  `src/app/icon.svg`. A tab here matches a tab anywhere else on the site.
- The bottom menu died after a vote. Cause: the chrome was rendered per route
  group, desktop.js binds once, and voting router.push()es out of `(desk)` into
  `[slug]/(view)`, which replaced the mascot with an unbound copy. The chrome
  now lives in the root layout. `npm run check:desk` is the regression test.
- No photograph is greyscale any more. The filter is gone from `.sg-hero img`
  and `.sg-card__thumb img`. Elise Liu's portrait is a monochrome photograph in
  the file itself, so only a new file changes that one.
- The tools chips wrap instead of scrolling sideways, so all four are visible
  on a phone.
- `duel.txt` is `vote.exe`, says a visitor can vote, and every poem carries its
  own pick line.
- The poets window is "Participating Poets", opens as a carousel with Elise Liu
  first, and the portraits are small squares. Every bio is untouched.
- `machine.txt` is ported: MACHINE on the pill opens it. It answers from
  `www.halimmadi.com/api/machine`, which is same-origin at
  `halimmadi.com/singulars` and cross-origin at `singulars.oulipo.xyz`, where it
  falls back to the poem lines until that origin is allowed CORS.

Browser checks live in `scripts/check-desk.mjs` (`npm run check:desk`), run
against a started server. Playwright is not a dependency; the script says so and
exits 0 where it is missing.
