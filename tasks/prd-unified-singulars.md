[PRD]

# PRD: Unified Singulars Platform

## 1. Overview

Consolidate five standalone AI poetry chat interfaces (carnation-fr, carnation-eng, versus, reinforcement, hard-exe), the theme-voting Express app, and the static timer page into the existing Singulars Next.js application. The result is a single deployable project at singulars.ulipo.xyz with three new routes:

- `/chat` - Unified model battle interface with persistent model selector
- `/theme-voting` - Theme suggestion and voting (converted from Express to Next.js)
- `/timer` - Performance countdown timer (converted from vanilla HTML to React)

This eliminates five separate Vercel deployments, unifies environment variables, and brings everything under one design system.

---

## 2. Goals

- Consolidate 7 separate projects into 1 deployable application
- Single `OPENAI_API_KEY` environment variable in Singulars' Vercel project serves all models
- Persistent sidebar/tab selector on `/chat` lets users switch between 5 fine-tuned models without leaving the page
- Each model retains its brand color and identity (colored dot, system prompt, model ID)
- Theme-voting and timer adopt Singulars' design system (Diatype Mono Variable, Terminal Grotesque, existing color palette)
- All existing Singulars functionality (voting, performances, about) remains untouched
- Dropdown/selector shows model colors as visual indicators
- Chat history clears on model switch (each model is a fresh conversation)

---

## 3. Quality Gates

These commands must pass for every user story:

- `npm run build` - Next.js production build succeeds with zero errors
- `npm run lint` - ESLint passes with zero errors
- Manual visual verification for UI stories (layout, colors, responsiveness)

---

## 4. Technical Context

### 4.1 Existing Singulars Stack

- **Framework**: Next.js 14.2.35 (App Router), React 18, TypeScript 5
- **Styling**: Tailwind CSS 3.4.1 + inline styles + CSS variables in globals.css
- **Database**: Supabase (PostgreSQL) via @supabase/supabase-js
- **Fonts**: Terminal Grotesque (display), Diatype Variable (headings), Diatype Mono Variable (mono), Standard (body) - all from type.cargo.site
- **Deployment**: Vercel, domain singulars.ulipo.xyz
- **Existing env vars**: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

### 4.2 Chat Apps (to absorb)

All five are clones of the same Next.js 13 template:

- **AI SDK**: Vercel AI SDK (`ai` package) with `useChat` hook + `OpenAIStream` + `StreamingTextResponse`
- **OpenAI**: `openai` package v4.2.0 for fine-tuned GPT-4.1-nano models
- **Runtime**: Edge runtime for streaming API routes
- **UI**: Tailwind + Courier monospace + clsx + react-textarea-autosize

### 4.3 Model Registry

| Order | Display Name       | Slug          | Color   | Model ID                                                      | Language | System Prompt Focus               |
| ----- | ------------------ | ------------- | ------- | ------------------------------------------------------------- | -------- | --------------------------------- |
| 1     | carnation.exe (FR) | carnation-fr  | #F6009B | ft:gpt-4.1-nano-2025-04-14:personal:carnation:BlXtlzbe        | French   | French contemporary poetry        |
| 2     | carnation.exe (EN) | carnation-eng | #F6009B | ft:gpt-4.1-nano-2025-04-14:personal:carnation-eng:BlYK5NGv    | English  | French poets, English output      |
| 3     | versus.exe         | versus        | #FEE005 | ft:gpt-4.1-nano-2025-04-14:personal:carnation-eng-v2:CaTS4oSe | English  | Contemporary English poetry       |
| 4     | reinforcement.exe  | reinforcement | #02F700 | ft:gpt-4.1-nano-2025-04-14:personal:reinforcement:CcaXQzct    | English  | Contemporary poetry               |
| 5     | hard.exe           | hard          | #2AA4DD | ft:gpt-4.1-nano-2025-04-14:personal:hard-eng:CjWCNdgI         | English  | Contemporary poetry, RLHF-refined |

### 4.4 Theme-Voting App (to absorb)

- **Current stack**: Express.js 4.18.2 + vanilla HTML/CSS/JS
- **Database**: Multi-backend (Edge Config, Vercel Postgres, Vercel KV, Turso, local SQLite)
- **Features**: Submit themes (max 50 chars), upvote, admin panel (token-auth), completed/archived states
- **Design**: Times New Roman serif, black/white, 800px max-width

### 4.5 Timer App (to absorb)

- **Current stack**: Single static HTML file (764 lines), vanilla JS
- **Features**: 30-minute countdown, theme display, model name input, break mode, light/dark toggle, QR code, browser notifications
- **Design**: Courier New monospace, black background, large Georgia timer (420px)

### 4.6 New Environment Variables Required

```
OPENAI_API_KEY=<OpenAI API key for all fine-tuned models>
```

Add to Singulars' Vercel project alongside existing Supabase vars.

### 4.7 New Dependencies Required

```
openai (^4.2.0)          - OpenAI API client
ai (^2.2.10)             - Vercel AI SDK (useChat, OpenAIStream, StreamingTextResponse)
clsx (^2.0.0)            - Conditional classnames (may already exist via Tailwind)
react-textarea-autosize   - Auto-expanding textarea for chat input
```

---

## 5. User Stories

### PHASE 1: Chat Infrastructure

#### US-001: Create model registry configuration

**Description:** As a developer, I want a single source of truth for all model configurations so that adding or modifying models requires changing only one file.

**Acceptance Criteria:**

- [ ] File created at `src/lib/models.ts` exporting a `MODELS` array
- [ ] Each model entry contains: slug, displayName, color, modelId, systemPrompt, language, examplePrompts, huggingFaceUrl, order
- [ ] Models ordered: carnation-fr (1), carnation-eng (2), versus (3), reinforcement (4), hard (5)
- [ ] System prompts copied verbatim from each project's `app/api/chat/route.ts`
- [ ] Example prompts copied from each project's `app/page.tsx` (French for carnation-fr, English for others)
- [ ] TypeScript types exported: `Model`, `ModelSlug`
- [ ] Helper functions: `getModelBySlug(slug)`, `getDefaultModel()` (returns first model)

**Key source files to extract from:**

- `/Users/halim/Documents/carnation-fr/app/api/chat/route.ts` (system prompt + model ID)
- `/Users/halim/Documents/carnation-eng/app/api/chat/route.ts` (system prompt + model ID)
- `/Users/halim/Documents/versus/app/api/chat/route.ts` (system prompt + model ID)
- `/Users/halim/Documents/reinforcement/app/api/chat/route.ts` (system prompt + model ID)
- `/Users/halim/Documents/hard-exe/app/api/chat/route.ts` (system prompt + model ID)
- Each project's `app/page.tsx` for example prompts

---

#### US-002: Create chat API route with model switching

**Description:** As a user, I want the chat API to accept a model slug parameter so that switching models in the UI calls the correct fine-tuned model.

**Acceptance Criteria:**

- [ ] API route created at `src/app/chat/api/route.ts` (or `src/app/api/chat/route.ts`)
- [ ] POST handler accepts `{ messages, modelSlug }` in request body
- [ ] Validates `modelSlug` against known slugs from model registry; returns 400 if invalid
- [ ] Looks up model config (modelId, systemPrompt) from registry
- [ ] Calls OpenAI with the correct fine-tuned model ID and system prompt
- [ ] Uses edge runtime (`export const runtime = 'edge'`)
- [ ] Returns `StreamingTextResponse` for real-time token streaming
- [ ] `OPENAI_API_KEY` read from `process.env.OPENAI_API_KEY` with graceful error if missing
- [ ] Rate limit handling: returns 429 if OpenAI returns 429

---

#### US-003: Install required dependencies

**Description:** As a developer, I want the necessary AI/chat packages installed so that the chat feature can be built.

**Acceptance Criteria:**

- [ ] `openai` package added to dependencies in `package.json`
- [ ] `ai` (Vercel AI SDK) package added to dependencies
- [ ] `react-textarea-autosize` package added to dependencies
- [ ] `clsx` package added to dependencies
- [ ] `package-lock.json` updated
- [ ] `npm run build` passes after installation
- [ ] `.env.local.example` updated to include `OPENAI_API_KEY=your-openai-key-here`

---

### PHASE 2: Chat UI

#### US-004: Create chat page layout with persistent model sidebar

**Description:** As a user, I want to see a persistent model selector alongside the chat area so that I can switch between poetry models at any time.

**Acceptance Criteria:**

- [ ] Page created at `src/app/chat/page.tsx`
- [ ] Layout has two regions: sidebar (left) and chat area (right)
- [ ] Sidebar displays all 5 models in order (carnation-fr, carnation-eng, versus, reinforcement, hard)
- [ ] Each model entry in sidebar shows: colored dot (model's brand color) + model display name
- [ ] Active model is visually highlighted (e.g., bold text, border-left in model color, or background change)
- [ ] Clicking a model in sidebar switches the active model
- [ ] On mobile (< 768px), sidebar collapses to a horizontal selector or dropdown at the top
- [ ] Page uses Singulars design system: Diatype Mono Variable for labels, Terminal Grotesque for page title if any
- [ ] Background is white, text is rgba(0,0,0,0.85) - matching Singulars' existing color scheme
- [ ] Page title/metadata: "Chat | Singulars"

---

#### US-005: Build chat interface component

**Description:** As a user, I want a streaming chat interface so that I can converse with the selected poetry model in real time.

**Acceptance Criteria:**

- [ ] Chat component created (client component with `"use client"`)
- [ ] Uses `useChat` hook from `ai/react` with custom `api` endpoint pointing to the chat API route
- [ ] Passes `modelSlug` in request body via `useChat`'s `body` option
- [ ] Messages display in a vertical stream: user messages and assistant messages visually differentiated
- [ ] Assistant messages stream in real-time (token by token)
- [ ] Input area at bottom with auto-expanding textarea (`react-textarea-autosize`)
- [ ] Enter submits, Shift+Enter inserts newline
- [ ] Send button disabled when input is empty or response is loading
- [ ] Loading state shows animated indicator while model responds
- [ ] When model is switched (via sidebar), chat history clears and component resets
- [ ] Rate limit (429) shows user-friendly message (not window.alert - use inline error)
- [ ] Font for chat messages: Diatype Mono Variable (monospace, matching Singulars)
- [ ] Custom cursor: colored dot in active model's color when hovering over interactive elements

---

#### US-006: Build welcome state with example prompts

**Description:** As a new user arriving at `/chat`, I want to see a welcome screen with the active model's identity and example prompts so that I understand what this is and how to start.

**Acceptance Criteria:**

- [ ] Welcome state shown when no messages exist in current conversation
- [ ] Displays model name (e.g., "carnation.exe") with colored dot
- [ ] Shows model description: "I am the rival of Halim Madi." + language-specific subtitle
- [ ] Shows 3 example prompts as clickable buttons (pulled from model registry)
- [ ] Clicking an example prompt fills the input and auto-submits
- [ ] Links to HuggingFace dataset for the active model
- [ ] Welcome state re-appears when switching models (since chat clears)
- [ ] Styling matches Singulars design system (not the old Courier monospace from standalone apps)

---

#### US-007: Add chat page to site navigation

**Description:** As a user navigating the Singulars site, I want to find the chat page easily.

**Acceptance Criteria:**

- [ ] Landing page (`src/app/page.tsx`) includes a visible link/button to `/chat`
- [ ] Link text: "Chat with the Models" or similar - fits Singulars' voice
- [ ] Link is positioned prominently (e.g., near the "Duel the Machine" button or in the header area)
- [ ] Chat page includes a back-link to the Singulars landing page (`/`)
- [ ] No changes to existing performance pages, voting, or about pages

---

### PHASE 3: Theme-Voting Integration

#### US-008: Create theme-voting database schema in Supabase

**Description:** As a developer, I want theme-voting data stored in Supabase (same DB as the rest of Singulars) so that we eliminate the separate database dependency. The new table must coexist safely with the existing `performances`, `poems`, and `votes` tables without modifying them in any way.

**CRITICAL CONSTRAINT:** Do NOT alter, add columns to, add foreign keys to, or modify RLS policies on the existing `performances`, `poems`, or `votes` tables. Do NOT modify the existing `cast_vote` RPC function. The new `themes` table is additive only.

**Acceptance Criteria:**

- [ ] SQL migration created in `scripts/migration-themes.sql` (separate file, never modifies existing schema)
- [ ] New `themes` table created with columns:
  - `id` (uuid, primary key, default gen_random_uuid())
  - `content` (text, unique, not null) - the theme suggestion text
  - `theme_slug` (text, not null) - auto-generated slugified version of content (lowercase, hyphens)
  - `votes` (integer, default 0) - upvote count
  - `completed` (boolean, default false) - marked done when used in a performance
  - `archived` (boolean, default false) - soft delete
  - `performance_id` (uuid, nullable, references performances(id)) - optional link to the performance that used this theme (set when completed)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())
- [ ] `theme_slug` column enables future linkage: when a theme is selected for a performance, the slug can match `poems.theme_slug` in the existing schema (but NO foreign key is added to `poems`)
- [ ] `performance_id` is a nullable FK to `performances(id)` - this is a reference FROM themes TO performances, not the other direction. It is set only when a theme has been used in an actual performance
- [ ] Content column has CHECK constraint: `char_length(content) BETWEEN 1 AND 50`
- [ ] RPC function `upvote_theme(p_theme_id uuid)` that atomically increments the `votes` column and updates `updated_at`
- [ ] RLS policies on `themes` table only:
  - Public read (anon SELECT)
  - Public insert (anon INSERT, with content validation in API layer)
  - No public update/delete (only via RPC for vote increment, admin via service role)
- [ ] Migration file includes `IF NOT EXISTS` / `CREATE OR REPLACE` guards so it's safe to run multiple times
- [ ] Existing `schema.sql` is NOT modified
- [ ] Existing `cast_vote` function is NOT modified
- [ ] Verification: after running migration, `SELECT * FROM performances`, `SELECT * FROM poems`, `SELECT * FROM votes` all return unchanged data

---

#### US-009: Create theme-voting API routes

**Description:** As a user, I want API endpoints for theme submission and voting so that the theme-voting page can function.

**Acceptance Criteria:**

- [ ] `GET /api/themes` - Returns all non-archived themes sorted by votes (desc), then created_at (desc)
- [ ] `POST /api/themes` - Creates a new theme; validates: content required, 1-50 chars, unique; returns 400 with message if invalid
- [ ] `POST /api/themes/[id]/upvote` - Calls `upvote_theme` RPC; returns updated vote count
- [ ] All routes use Supabase client from `src/lib/supabase.ts`
- [ ] Rate limiting on POST routes: max 10 theme submissions per minute per IP (simple in-memory limiter, same pattern as existing vote route)
- [ ] Responses follow consistent JSON shape: `{ data, error }`
- [ ] Admin routes NOT included in this phase (admin can be added later if needed)

---

#### US-010: Build theme-voting page UI

**Description:** As a user, I want to suggest poetry themes and vote on others' suggestions at `/theme-voting`.

**Acceptance Criteria:**

- [ ] Page created at `src/app/theme-voting/page.tsx`
- [ ] Page title: "Theme Voting" in Terminal Grotesque (matching Singulars' heading style)
- [ ] Theme submission form: text input (max 50 chars) + submit button
- [ ] Character count indicator shown below input (e.g., "12/50")
- [ ] Active themes listed below form, sorted by votes (highest first)
- [ ] Each theme card shows: theme text + vote count + upvote button
- [ ] Upvote button uses a small triangle or dot in a neutral color
- [ ] Clicking upvote increments count optimistically then confirms via API
- [ ] Completed themes shown in a collapsible "Completed" section at bottom
- [ ] Design system: Diatype Mono Variable for counts/metadata, Standard font for theme text, max-width 800px centered
- [ ] Colors: black text on white, borders rgba(0,0,0,0.12), consistent with Singulars
- [ ] Back link to Singulars landing page
- [ ] Page metadata: "Theme Voting | Singulars"
- [ ] Responsive: works on mobile (stacked layout)

---

### PHASE 4: Timer Integration

#### US-011: Build timer page

**Description:** As a performer, I want a countdown timer at `/timer` styled in the Singulars design system for use during live performances.

**Acceptance Criteria:**

- [ ] Page created at `src/app/timer/page.tsx` as a client component
- [ ] 30-minute countdown timer (starts at 30:00, counts to 00:00)
- [ ] Timer display uses large font (Terminal Grotesque or Diatype Variable, responsive sizing: ~300px desktop, ~150px mobile)
- [ ] START / PAUSE / RESET buttons below timer
- [ ] Editable "theme" text field (displays "Write about [theme]" during countdown)
- [ ] Editable "model" text field (displays model name during countdown)
- [ ] Break mode toggle: when enabled, shows break-specific messaging (e.g., "Break in progress")
- [ ] Light/dark theme toggle (default: dark background matching Singulars' aesthetic)
- [ ] Browser notification when timer reaches 00:00 (requests permission on start)
- [ ] Timer state managed with useState + useRef for interval
- [ ] Buttons disabled appropriately (e.g., can't start when running, can't reset when already at 30:00)
- [ ] Responsive layout: centered, full-viewport height
- [ ] Design system fonts: Diatype Mono Variable for labels/buttons, large display font for timer digits
- [ ] Colors: white on black (dark mode), black on white (light mode), smooth 0.3s transitions
- [ ] Page metadata: "Timer | Singulars"
- [ ] Optional: QR code display (bottom-right corner) - can reference existing `Yalla Halim QR.png` image moved to `public/images/`

---

### PHASE 5: Environment & Deployment

#### US-012: Configure environment variables and Vercel settings

**Description:** As a developer, I want all environment variables properly configured so that the unified app works in development and production.

**Acceptance Criteria:**

- [ ] `.env.local.example` updated with all required variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
- [ ] `OPENAI_API_KEY` added to Singulars' Vercel project (production + preview + development)
- [ ] If theme-voting uses a separate database backend, those env vars are documented too
- [ ] `npm run build` succeeds with all env vars set
- [ ] `npm run lint` passes
- [ ] Chat API route returns proper error (503) when `OPENAI_API_KEY` is missing (not a crash)

---

#### US-013: Verify full build and cross-route navigation

**Description:** As a developer, I want to verify the entire application builds and all routes work together.

**Acceptance Criteria:**

- [ ] `npm run build` completes successfully
- [ ] `npm run lint` passes with zero errors
- [ ] Landing page (`/`) loads and links to `/chat`, existing performance pages still work
- [ ] `/chat` loads, model sidebar renders, switching models works, chat streams responses
- [ ] `/theme-voting` loads, themes can be submitted and upvoted
- [ ] `/timer` loads, countdown works, start/pause/reset function correctly
- [ ] All existing routes unaffected: `/[slug]`, `/[slug]/[themeSlug]`, `/about`, all API routes
- [ ] No TypeScript errors in build output
- [ ] No console errors on any page in browser dev tools

---

### PHASE 6: Cleanup (Post-Verification)

#### US-014: Delete absorbed standalone project folders

**Description:** As a developer, after verifying all functionality works in the unified Singulars app, I want to remove the standalone project folders that have been fully integrated.

**CRITICAL: Only execute after full verification with the user. Do NOT delete before explicit user confirmation.**

**Folders to delete (after user approval):**

- `/Users/halim/Documents/versus/`
- `/Users/halim/Documents/carnation-fr/`
- `/Users/halim/Documents/carnation-eng/`
- `/Users/halim/Documents/reinforcement/`
- `/Users/halim/Documents/hard-exe/`
- `/Users/halim/Documents/singulars-theme-voting/`
- `/Users/halim/Documents/singulars-timer/`

**Acceptance Criteria:**

- [ ] All 5 chat models verified working at `/chat` (each streams responses correctly)
- [ ] Theme-voting verified working at `/theme-voting` (submit + upvote)
- [ ] Timer verified working at `/timer` (countdown + controls)
- [ ] All existing Singulars pages verified unchanged (landing, performances, voting, about)
- [ ] User explicitly confirms "go ahead and delete"
- [ ] Each folder deleted one at a time with confirmation
- [ ] Corresponding Vercel deployments noted for manual decommissioning by user (separate domains)

---

## 6. Functional Requirements

- **FR-1**: The system must serve all functionality from a single Next.js application deployed to Vercel
- **FR-2**: The `/chat` page must support real-time streaming of responses from 5 different fine-tuned OpenAI models
- **FR-3**: Model switching must clear the conversation and reinitialize with the new model's system prompt and identity
- **FR-4**: The model selector must be persistent (always visible) on desktop and accessible (collapsed) on mobile
- **FR-5**: Each model must display its brand color as a visual indicator in the selector
- **FR-6**: The chat API must validate model slugs and reject unknown values with a 400 response
- **FR-7**: The theme-voting system must prevent duplicate theme submissions (unique constraint on content)
- **FR-8**: Theme votes must be atomic (Supabase RPC, same pattern as poem voting)
- **FR-9**: The timer must count down from 30:00 with 1-second precision
- **FR-10**: The timer must support pause, resume, and reset operations
- **FR-11**: All new pages must use Singulars' design system (fonts, colors, spacing, max-width patterns)
- **FR-12**: All existing Singulars functionality must remain unmodified and functional
- **FR-13**: The application must gracefully handle missing `OPENAI_API_KEY` (503 response, not crash)
- **FR-14**: Chat streaming must use edge runtime for low latency

---

## 7. Non-Goals (Out of Scope)

- **No authentication**: Chat, theme-voting, and timer remain publicly accessible (no login)
- **No chat history persistence**: Conversations are session-only; switching models or refreshing clears history
- **No admin panel for theme-voting**: Admin features from the Express app are not ported in this phase
- **No fine-tuning pipeline**: The `scripts/fine-tune.ts` files from standalone projects are not migrated
- **No model training data**: The `.jsonl` training datasets stay in their original project folders
- **No changes to Supabase schema for existing tables**: poems, performances, votes tables untouched
- **No WebSocket/real-time subscriptions**: Theme-voting uses fetch-based updates, not live subscriptions
- **No multi-language i18n framework**: French/English handled per-model in system prompts, not via i18n
- **No deletion of original standalone projects**: They stay as-is; this PRD only adds to Singulars
- **No mobile app or PWA features**

---

## 8. Technical Considerations

### 8.1 Dependency Compatibility

- Singulars uses Next.js 14.2.35; the chat apps use Next.js 13.4.12. The Vercel AI SDK v2.2.10 and OpenAI v4.2.0 are compatible with Next.js 14. However, the `ai` package has had breaking changes - verify that `useChat` and `StreamingTextResponse` APIs work with the installed version. If `ai@2.2.10` is too old for Next.js 14, upgrade to latest stable.

### 8.2 Edge Runtime

- The chat API route must use edge runtime for streaming. Ensure no Node.js-only APIs are used in that route (no `fs`, no `path`, etc.).

### 8.3 Supabase Schema - DO NOT BREAK EXISTING TABLES

- The existing schema has three tables: `performances`, `poems`, `votes`, plus custom types (`performance_status`, `author_type`) and an RPC function (`cast_vote`). **None of these may be modified.**
- The new `themes` table is purely additive. It references `performances` via a nullable FK (`themes.performance_id -> performances.id`) but nothing in the existing schema references `themes`.
- The relationship between upvoted themes and poem themes is intentionally loose: `themes.theme_slug` can match `poems.theme_slug` by convention, but there is no foreign key between them. This is by design - themes are suggestions that may or may not become poem topics in future performances.
- The migration must be in a separate SQL file (`migration-themes.sql`), never appended to the existing `schema.sql`.
- Run the migration with `IF NOT EXISTS` guards so it's idempotent.

### 8.4 Font Loading

- Singulars loads fonts from `type.cargo.site` CDN via `@font-face` in `globals.css`. New pages automatically inherit these fonts. No additional font configuration needed.

### 8.5 Environment Variables

- `OPENAI_API_KEY` is a server-side secret. It must NOT be prefixed with `NEXT_PUBLIC_`. It's only accessed in the API route (server-side/edge).

### 8.6 File Organization

```
src/app/
  chat/
    page.tsx              # Chat page with sidebar + chat area
    api/
      route.ts            # Chat API (edge runtime, streaming)
    components/
      ChatInterface.tsx   # Chat UI (client component)
      ModelSidebar.tsx    # Model selector sidebar
      WelcomeScreen.tsx   # Welcome state with example prompts
  theme-voting/
    page.tsx              # Theme voting page
  timer/
    page.tsx              # Timer page (client component)
src/lib/
  models.ts               # Model registry (slugs, colors, prompts, model IDs)
```

### 8.7 Theme-Voting Database Migration

- The Express app supported multiple database backends. In the Singulars integration, only Supabase (PostgreSQL) is used. The multi-backend abstraction is not needed.
- If existing theme data needs to be migrated from the old backend, a separate migration script should be written (not in scope of this PRD but noted here).

---

## 9. Success Metrics

- All 5 models respond correctly when selected in the chat interface
- Model switching is instantaneous (no page reload, just state reset)
- Streaming latency is comparable to the standalone apps (< 1s to first token)
- Theme-voting page loads and accepts submissions without errors
- Timer counts down accurately with no drift (using `setInterval` with time-based correction)
- `npm run build && npm run lint` passes in CI
- Zero regressions on existing Singulars pages (voting, performances, about)

---

## 10. Open Questions

1. **Theme-voting data migration**: Should existing themes from the Express app's database be migrated to Supabase? If so, which backend was being used in production (Edge Config, Vercel Postgres, KV)?

2. **Admin panel**: The Express theme-voting app had an admin panel (token-auth). Should this be ported in a future phase, or is it no longer needed?

3. **QR code on timer**: The original timer has a `Yalla Halim QR.png`. Should this be included in the Singulars version, or is it performance-specific and changes each time?

4. **Carnation FR vs EN in selector**: Both share the same color (#F6009B). Should they have slightly different visual indicators (e.g., a small "FR"/"EN" label next to the dot)?

5. **Chat page header/branding**: Should the `/chat` page have a "Singulars" title or header linking back to the main site, or should it be a clean standalone experience?

6. **Vercel AI SDK version**: The standalone apps use `ai@2.2.10` which is quite old. Should we upgrade to the latest stable version of the AI SDK for Next.js 14 compatibility?

[/PRD]
