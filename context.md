# Singulars Project Context

Reference file for Claude Code sessions. This captures decisions, setup details, and progress so nothing gets lost between conversations.

## Supabase Setup

- **Project name:** singulars
- **Dashboard:** https://supabase.com/dashboard (look for "singulars" project)
- **Project URL:** `https://smytgqkgomsfyurskpcl.supabase.co`
- **Credentials location:** `.env.local` (not committed to git)
- **Required env vars:**
  - `NEXT_PUBLIC_SUPABASE_URL` — Project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — publishable key
  - `SUPABASE_SERVICE_ROLE_KEY` — secret key (for seed scripts, bypasses RLS)
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
3. All human poems initially attributed to "Halim Madi" — some need correction (other poets contributed to versus.exe)
4. `scripts/poems-from-pdf.json` is the authoritative data file with real poems
5. `scripts/seed-data.json` still has placeholder/fake poems — should be replaced

## Deployment

- **Vercel project:** singulars (prj_wAF6Dx0ddTLn2WhNlIMAWapI0cp3)
- **Team:** team_9h3UVrcMfPTPWYdvGpnKezrd
- **Domains:** singulars.vercel.app, also accessible via oulipo.xyz/singulars (rewrite from parent project)
- **Framework:** Next.js 14 (App Router)
- **Node:** 22.x
- **Git repo:** madihg/oulipo (Root Directory: singulars)
- **Auto-deploy:** GitHub Action `.github/workflows/deploy-singulars.yml` on push to main when singulars/ changes
- **Fix guide:** See `singulars/docs/DEPLOYMENT.md` if pushes don't trigger deploys

## Key Decisions Made

- Anonymous voting with fingerprint-based dedup (@fingerprintjs/fingerprintjs)
- Poems displayed as pairs: 1 human + 1 machine per theme
- Only "training" performances accept votes
- Vote counts start at 0 on the website (live performance counts stored in `_live_votes` metadata in JSON)
- Touch Grass theme (reinforcement.exe): order swapped from PDF — first poem is machine based on content analysis
- Enfance (carnation.exe): PDF label contradicts content — attributed to Halim based on Arabic reference in poem

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
- `/theme-voting/admin` - Password-protected admin panel (password: singularpoetics)
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
- Admin auth uses env var `THEME_ADMIN_PASSWORD` (fallback: "singularpoetics") and `COOKIE_SECRET` (fallback: built-in default)
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
- [x] Deploy and verify all routes (done March 2026 - all working on singulars.vercel.app)
- [x] Build admin panel at /theme-voting/admin (done March 2026)
- [x] Import 27 themes from old production app (done March 2026)
- [x] Delete absorbed standalone folders (done March 2026 - 7 folders removed)
- [ ] Verify human/machine assignments - Halim to review
- [ ] Identify non-Halim poets in versus.exe and update author_name
- [ ] Update performance metadata (locations, dates, model_link, huggingface_link) if placeholders
- [ ] Replace `seed-data.json` with real data from `poems-from-pdf.json`
