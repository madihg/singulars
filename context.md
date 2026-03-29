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

## Unified Platform (March 2026)

Consolidated 7 standalone projects into Singulars. PRD: `tasks/prd-unified-singulars.md`

### New routes

- `/chat` - Unified chat with 5 fine-tuned models (sidebar selector)
- `/theme-voting` - Theme suggestion + upvoting (Supabase-backed)
- `/timer` - 30-min performance countdown

### New files

- `src/lib/models.ts` - Model registry (5 GPT-4.1-nano models)
- `src/app/api/chat/route.ts` - Streaming chat API (edge runtime)
- `src/app/chat/page.tsx` - Chat UI
- `scripts/migration-themes.sql` - Themes table migration (additive only)
- `src/app/api/themes/route.ts` - GET + POST themes
- `src/app/api/themes/[id]/upvote/route.ts` - Upvote RPC
- `src/app/theme-voting/page.tsx` - Theme voting UI
- `src/app/timer/page.tsx` - Timer page

### New dependencies

- openai (^4.104.0), ai (^2.2.37), clsx (^2.1.1), react-textarea-autosize (^8.5.9)

### Technical notes

- openai@4.x + ai@2.x has type mismatch on OpenAIStream - fixed with `as any` cast
- All DB tables in `singulars` schema (not public)
- themes table additive only - no changes to performances/poems/votes
- themes.theme_slug matches poems.theme_slug by convention (no FK)

### Remaining for deployment

1. Run `migration-themes.sql` in Supabase SQL Editor
2. Add `OPENAI_API_KEY` to Vercel env vars
3. Deploy + visual verification
4. Delete absorbed folders after user confirmation:
   - versus, carnation-fr, carnation-eng, reinforcement, hard-exe
   - singulars-theme-voting, singulars-timer

## What Still Needs Doing

- [x] Add Supabase credentials to `.env.local` and Vercel env vars (done Feb 2026)
- [x] Seed database with `poems-from-pdf.json` (done Feb 2026 — 66 poems)
- [x] Clean up old placeholder poems from DB (done Feb 2026 — removed 18 placeholders)
- [x] Consolidate chat apps into /chat (done March 2026)
- [x] Port theme-voting to /theme-voting (done March 2026)
- [x] Port timer to /timer (done March 2026)
- [ ] Run migration-themes.sql in Supabase
- [ ] Add OPENAI_API_KEY to Vercel
- [ ] Deploy and verify all routes
- [ ] Delete absorbed standalone folders
- [ ] Verify human/machine assignments — Halim to review
- [ ] Identify non-Halim poets in versus.exe and update author_name
- [ ] Update performance metadata (locations, dates, model_link, huggingface_link) if placeholders
- [ ] Replace `seed-data.json` with real data from `poems-from-pdf.json`
