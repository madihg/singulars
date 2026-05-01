# Singulars Post-Performance Update Loop & Admin Panel

**Author:** Engineering architect
**Date:** 2026-04-30
**Audience:** Halim Madi (artist, non-engineer) + the coding agent that will build this
**Sibling file:** [`06-migration-evals.sql`](./06-migration-evals.sql)

---

## 0. The artistic constraint that drives the architecture

The whole point of Singulars is that **the human is in the loop**. The eval re-run is not a CI hook firing on a database trigger — it is a deliberate ritual Halim performs after each show. Every one of the design decisions below ladders up to that: the panel must be operable on a phone in a hotel room twenty minutes after the audience leaves; the trigger must be a button he presses, not a Postgres event he doesn't see; the cost guardrail must be a number he confirms; the publishing of results must be a draft-then-publish flow, not an autopublish. The system is built to be artistically slow on purpose.

Everything else is plumbing in service of that.

---

## 1. The flow, end-to-end

```
                 ┌─────────────────────────┐
                 │  PERFORMANCE NIGHT      │
                 │  audience votes (live   │
                 │  + paper ballots)       │
                 └────────────┬────────────┘
                              │
                              ▼
     ┌──────────────────────────────────────────────────┐
     │  HOTEL ROOM, 20 MIN LATER                         │
     │  Halim opens singulars.oulipo.xyz/admin           │
     │  → password (matches existing /theme-voting/admin)│
     └────────────┬──────────────────────────────────────┘
                  │
                  ▼
     ┌──────────────────────────────────────────────────────────┐
     │  /admin → Performances tab                                │
     │  • Sees reverse.exe still 'training'                      │
     │  • Click "Sync vote tallies" → counts refresh from DB     │
     │  • Click "Vote entry" → editable table of theme pairs     │
     │      - adjusts paper-ballot counts manually               │
     │      - or pastes CSV of (theme, human_votes, machine_v.) │
     │  • Click "Flip to trained"  (modal: "are you sure?")      │
     └────────────┬──────────────────────────────────────────────┘
                  │
                  ▼
     ┌─────────────────────────────────────────────────────┐
     │  /admin → Eval runs tab                              │
     │  • "Run new eval"                                    │
     │      - performance: reverse.exe                      │
     │      - candidates: [Opus 4.7, Gemini 3.1, ground v0] │
     │      - judge: gpt-5.5                                │
     │      - cost cap: $20  (default from env)             │
     │  • Click "Run"                                       │
     │     POST /api/admin/eval-runs/start                  │
     │     → returns eval_run_id, status='pending'          │
     └────────────┬─────────────────────────────────────────┘
                  │
                  ▼
     ┌─────────────────────────────────────────────────────────┐
     │  RUNNER (background — Vercel function or local CLI)     │
     │  scripts/run-eval.ts:                                    │
     │   1. SELECT * FROM singulars.golden_tuples_for_perf(...)│
     │   2. write promptfooconfig.yaml from candidates+judge   │
     │   3. promptfoo eval -o results.json                      │
     │      ── for each (model × theme): generate poem         │
     │      ── for each candidate: judge prompt (research/02)  │
     │      ── repeat with A/B swap, take majority             │
     │   4. parse results.json                                  │
     │   5. for each row: singulars.upsert_eval_score(...)     │
     │   6. UPDATE eval_runs SET status='completed', win_rate, │
     │      mean_rank, cost_usd, finished_at                    │
     └────────────┬─────────────────────────────────────────────┘
                  │
                  ▼
     ┌─────────────────────────────────────────────────────┐
     │  /admin → Eval runs tab (auto-polling every 5s)      │
     │  • Status: completed                                 │
     │  • Win rate per model shown                          │
     │  • "View scores" → per-theme judge rationales        │
     │  • "Publish" toggle (draft → public)                 │
     └────────────┬─────────────────────────────────────────┘
                  │
                  ▼
     ┌─────────────────────────────────────────────────────┐
     │  PUBLIC SITE singulars.oulipo.xyz                    │
     │  • /singulars chart auto-refreshes (no rebuild)      │
     │    pulls from singulars.v_model_winrate_per_perf.    │
     │  • Visitors see new data point on Model Evolution    │
     │    chart for reverse.exe                             │
     └─────────────────────────────────────────────────────┘
```

The whole loop, run from a phone, takes <5 minutes of Halim's attention; the runner itself can take 5-30 minutes depending on candidate count, and runs without supervision after the button press.

---

## 2. New tables

The migration is at [`06-migration-evals.sql`](./06-migration-evals.sql) and is reproduced in full at the end of this section. The shape of each table:

### 2.1 `singulars.candidate_models`

| column                     | type                           | notes                                                                                         |
| -------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| `id`                       | uuid PK                        |                                                                                               |
| `name`                     | text                           | "Claude Opus 4.7", "ground.exe (v1)"                                                          |
| `slug`                     | text UNIQUE                    | URL/chart key                                                                                 |
| `family`                   | enum                           | claude / gpt / gemini / grok / deepseek / qwen / llama / mistral / open-source-ground / other |
| `version_label`            | text                           | "v0", "v1", "4.7"                                                                             |
| `fine_tune_source`         | uuid FK → candidate_models(id) | for ground.exe-v1 fine-tuned from v0                                                          |
| `api_endpoint`             | text                           | promptfoo provider id, e.g. `anthropic:messages:claude-opus-4-7`                              |
| `hf_repo`                  | text                           | for local fine-tunes                                                                          |
| `color`                    | text NOT NULL                  | hex; consumed by chart series                                                                 |
| `is_public`                | boolean                        | `true` ⇒ visible on public chart (gated via RLS)                                              |
| `archived`                 | boolean                        | soft-delete                                                                                   |
| `created_at`, `updated_at` | timestamptz                    | `updated_at` auto-touched via trigger                                                         |

### 2.2 `singulars.eval_runs`

| column                       | type          | notes                                                                |
| ---------------------------- | ------------- | -------------------------------------------------------------------- |
| `id`                         | uuid PK       |                                                                      |
| `candidate_model_id`         | uuid FK       |                                                                      |
| `performance_id`             | uuid FK       |                                                                      |
| `judge_model`                | text          | promptfoo provider id of the judge                                   |
| `n_themes`                   | int           | total tuples to score                                                |
| `n_themes_completed`         | int           | progress for the polling UI                                          |
| `status`                     | enum          | pending / running / completed / failed / cancelled                   |
| `triggered_by`               | enum          | manual / auto                                                        |
| `triggered_by_user`          | text          | audit field                                                          |
| `started_at` / `finished_at` | timestamptz   |                                                                      |
| `duration_ms`                | int           | denormalised for quick admin display                                 |
| `cost_usd`                   | numeric(10,4) | recorded after run                                                   |
| `win_rate`, `mean_rank`      | numeric(5,4)  | denormalised aggregates so the chart doesn't recompute on every read |
| `error_message`              | text          | populated on failure                                                 |
| `config_snapshot`            | jsonb         | full promptfooconfig.yaml as JSON, for reproducibility               |
| `published`                  | boolean       | draft until Halim toggles it on                                      |

### 2.3 `singulars.eval_scores`

One row per (run, theme). Idempotent re-runs replace prior rows for the same (run, theme).

| column                         | type    | notes                                         |
| ------------------------------ | ------- | --------------------------------------------- |
| `id`                           | uuid PK |                                               |
| `eval_run_id`                  | uuid FK |                                               |
| `performance_id`, `theme_slug` | —       | denormalised for fast slicing                 |
| `candidate_text`               | text    | the poem the candidate generated              |
| `candidate_won`                | boolean | did it beat the audience winner per the judge |
| `candidate_rank`               | int     | 1 / 2 / 3                                     |
| `judge_rationale`              | text    | one-line summary from the judge JSON          |
| `score`                        | numeric | normalised 0..1                               |
| `confidence`                   | text    | low/med/high from judge                       |
| `position_swap_agreement`      | boolean | did A↔B swap agree? bias check                |
| `raw_judge_payload`            | jsonb   | full structured judge response                |

### 2.4 RLS posture

- `candidate_models`: anon read where `is_public=true AND archived=false`. All writes via service role.
- `eval_runs`: anon read where `published=true AND status='completed'`. Writes via service role.
- `eval_scores`: anon read gated on parent run's `published+completed`. Writes via service role.

This matches the existing posture from `scripts/schema.sql` (anon insert on votes, public read on poems/performances). Service-role writes are exactly the pattern in `src/app/api/themes/admin/[id]/route.ts`.

### 2.5 Helper objects

- `singulars.golden_tuples_for_performance(p_slug text)` — the SELECT from research/02 §2.1, parameterised by performance slug. The runner calls this directly via Supabase RPC.
- `singulars.upsert_eval_score(...)` — idempotent score writer: deletes any prior row for `(run_id, theme_slug)` then inserts. Lets the runner safely retry mid-flight.
- `singulars.v_model_winrate_per_performance` — public view selecting the latest completed run per (model, performance).
- `singulars.v_latest_eval_run` — admin-only view including drafts.

The full SQL is the sibling file `06-migration-evals.sql`. Apply it after the existing `scripts/migration-themes.sql`.

---

## 3. The admin panel

The existing admin lives at `/theme-voting/admin` and is _narrow_ — it manages just one feature. We need a broader, post-performance admin. Two options were considered:

- **Option A: build a parallel admin at `/admin`, share the cookie scheme.**
- **Option B: extend `/theme-voting/admin` and rename it.**

We pick **A**. Reasons: (1) URL hygiene — `/admin` is the obviously-discoverable root; (2) the existing admin's narrow scope keeps things tidy if someone later wants to pull it apart; (3) Halim's muscle memory for `/theme-voting/admin` shouldn't break.

### 3.1 Auth — reuse, don't reinvent

The existing scheme in `src/app/api/themes/admin/auth/route.ts`:

```ts
const ADMIN_PASSWORD = process.env.THEME_ADMIN_PASSWORD || "singularpoetics";
const COOKIE_NAME = "theme-admin-token";
function hashToken() {
  return HMAC - SHA256(SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD);
}
```

We extend this:

- New shared module `src/lib/admin-auth.ts` exporting `hashToken()`, `isValidAdminCookie()`, `requireAuth()`. Move the existing `theme-admin` logic into here verbatim and re-export.
- The cookie name stays `theme-admin-token` (so Halim's existing session keeps working when he visits `/admin`) but a new env `ADMIN_PASSWORD` (falling back to `THEME_ADMIN_PASSWORD` for backwards compat) controls the panel-wide secret.
- New auth route `src/app/api/admin/auth/route.ts` — copy of the existing themes one, but reads from the new env name. Both routes verify the same cookie. Single source of truth.

This means: log in once at `/admin/login` (or `/theme-voting/admin`) and the cookie covers both panels for 24h.

### 3.2 Page routes

```
src/app/admin/
  layout.tsx                  // nav (Performances | Vote entry | Models | Eval runs | Publish)
  page.tsx                    // dashboard: overview (counts, latest eval status)
  login/page.tsx              // login screen (mirrors theme-voting/admin login)
  performances/page.tsx       // list + status flip + sync
  performances/[slug]/votes/page.tsx   // editable vote table (Section 3.3.b)
  models/page.tsx             // candidate_models CRUD
  models/[id]/page.tsx        // edit form
  eval-runs/page.tsx          // run history table
  eval-runs/new/page.tsx      // form: pick performance + candidates + judge
  eval-runs/[id]/page.tsx     // detail: per-theme scores + rationales
  publish/page.tsx            // master publish/unpublish board
```

### 3.3 Sections in detail

#### a. Performances

**Route:** `/admin/performances`
**API it calls:**

- `GET /api/admin/performances` → returns rows joined with `(num_themes_with_pairs, total_votes)`.
- `POST /api/admin/performances/[slug]/status` → `{ status: 'training' | 'trained' | 'upcoming' }`. 200 on success, surfaces a confirm modal on the client.
- `POST /api/admin/performances/[slug]/sync-tallies` → recalculates `vote_count` on every poem from the underlying `votes` table (defends against any drift from the RPC). Idempotent.

**Components:**

- `<PerformanceTable>` — name | slug | date | status pill | n themes | total votes | actions
- `<StatusFlipModal>` — confirmation: "Flip reverse.exe to trained? This makes the audience-vote results final."
- `<SyncTalliesButton>` — fires `sync-tallies`, shows toast on completion.

#### b. Vote entry

**Route:** `/admin/performances/[slug]/votes`
**API it calls:**

- `GET /api/admin/performances/[slug]/vote-pairs` → returns one row per theme with `{ theme, theme_slug, human_poem_id, human_text, human_votes, machine_poem_id, machine_text, machine_votes }`.
- `PATCH /api/admin/poems/[poem_id]` → body `{ vote_count: number, reason?: string }`. Audit-logged into a `singulars.poem_vote_overrides` table (optional v2; for v1 just write the poem row directly via service role with a `console.log` audit trail).
- `POST /api/admin/performances/[slug]/import-csv` → multipart form upload. CSV columns: `theme_slug, human_votes, machine_votes`. Server validates each row, returns `{ ok, applied, errors }`.

**Components:**

- `<VoteEntryTable>` — sticky-header editable grid; each row = one theme. Two number inputs per row (human/machine) with current count pre-filled, "Save" button per row, "Save all" at top.
- `<CSVImportDropzone>` — drag-drop for paper-ballot CSV. Shows preview before commit.
- `<PoemSnippet>` — renders first 60 chars of each poem, click to expand.

This is the section Halim uses **immediately after the show** — the paper ballots from the venue go in here.

#### c. Candidate models

**Route:** `/admin/models`
**API:**

- `GET    /api/admin/candidate-models`
- `POST   /api/admin/candidate-models` — body matches the table columns minus computed fields.
- `PUT    /api/admin/candidate-models/[id]`
- `DELETE /api/admin/candidate-models/[id]` — soft-delete (sets `archived=true`).
- `POST   /api/admin/candidate-models/[id]/toggle-public` — flips `is_public`.

**Components:**

- `<ModelTable>` — name | family | endpoint | color swatch | is_public toggle | actions
- `<ModelForm>` — name, slug (auto-derived), family (select), version_label, api_endpoint, hf_repo, color picker, is_public, fine_tune_source (FK select), notes.
- The seeds in §10 of the migration give Halim Claude Opus 4.7, Gemini 3.1 Pro, DeepSeek R1, and `ground.exe (v0)` out of the box — research/03 Shortlist A.

#### d. Eval runs

**Route:** `/admin/eval-runs`
**API:**

- `GET  /api/admin/eval-runs?perf=<slug>` — list with filter.
- `POST /api/admin/eval-runs/start` — body `{ performance_id, candidate_model_ids: uuid[], judge_model: string, cost_cap_usd?: number, n_per_theme?: number }`. Returns `{ run_ids: uuid[] }` (one per candidate). Status starts as `pending`, immediately enqueues runner tasks (see §4).
- `POST /api/admin/eval-runs/[id]/cancel` — sets status to `cancelled`; runner checks this between themes and aborts.
- `POST /api/admin/eval-runs/[id]/rerun` — clones config_snapshot, posts a new run with same params.
- `GET  /api/admin/eval-runs/[id]` — detail incl. all `eval_scores`.

**Components:**

- `<EvalRunTable>` — model | performance | status pill | win rate | n_completed/n_themes progress bar | published toggle | actions (View / Rerun / Cancel).
- `<NewEvalForm>` — performance select (only `trained` performances), candidate multi-select, judge model select (defaults to a candidate not in the multi-select to avoid self-judge), cost cap input.
- `<EvalRunDetail>` — per-theme rows showing candidate poem, audience winner, audience loser, judge ranking (1/2/3), candidate_won boolean, rationale, confidence, swap-agreement flag.
- `<LiveStatusPoller>` — `useEffect(() => setInterval(fetch, 5000), ...)` while status is `pending|running`.

#### e. Publish controls

**Route:** `/admin/publish`
**API:**

- `POST /api/admin/eval-runs/[id]/publish` — body `{ published: boolean }`.
- `POST /api/admin/candidate-models/[id]/toggle-public` (already exists from §c) is the other half.

**Components:**

- `<PublishMatrix>` — rows = candidate models (filtered to `is_public=true`), columns = performances, cells = current latest run with a publish/draft toggle. Two-way: toggling a model's `is_public` removes its entire column from the public chart; toggling a single run's `published` removes just that data point.
- `<PreviewPanel>` — renders the public chart with the current draft state so Halim sees the impact before committing.

### 3.4 Component reuse

- The styling primitives at the bottom of `src/app/theme-voting/admin/page.tsx` (`btnPrimaryStyle`, `inputStyle`, `monoStyle`, `pageStyle`, etc.) should be lifted into `src/lib/admin-styles.ts` and reused. No second design language.
- A shared `<AdminNav>` component renders the top tab bar across all `/admin/*` pages.

---

## 4. The runner script

### 4.1 Choice: promptfoo, per research/04

We pick **promptfoo** as recommended in `04-eval-tooling.md`. The runner is a thin TypeScript wrapper that:

1. loads tuples from Supabase,
2. writes a transient `promptfooconfig.yaml`,
3. shells out to `promptfoo eval -o results.json`,
4. parses results,
5. writes back via `singulars.upsert_eval_score`.

### 4.2 Three trigger paths

| Trigger                    | Path                                                                                                   | Notes                                                                                                                                                                                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin button (primary)** | `POST /api/admin/eval-runs/start` → enqueues background task                                           | Vercel: an in-process `setTimeout` is unreliable across cold starts, so we use either (a) a Supabase Edge Function invoked from the API route, or (b) a Vercel-hosted "long-running" route with `export const maxDuration = 300` and `runtime = "nodejs"`. For v1 we ship (b) and accept the 5-min cap by sharding per-candidate runs. |
| **CLI**                    | `npm run eval -- --performance reverse-exe --candidates ground-exe-v0,claude-opus-4-7 --judge gpt-5-5` | Same script, no API layer. Ideal for Halim or a coding agent on a laptop.                                                                                                                                                                                                                                                              |
| **Cron (off by default)**  | `vercel.json` cron at 03:00 daily, hitting `/api/admin/cron/check-trained`                             | Looks for performances flipped to `trained` in the past 24h with no completed run; if found, sends Halim an email "ready to run eval?" — does **not** auto-trigger. Manual button click is artistically load-bearing.                                                                                                                  |

### 4.3 The script

`scripts/run-eval.ts` (TypeScript, runs under Node 18+, called both by the admin API and the CLI):

```ts
#!/usr/bin/env -S npx tsx
/**
 * scripts/run-eval.ts — Singulars eval runner
 * Usage:
 *   npx tsx scripts/run-eval.ts --run-id <uuid>
 *   npx tsx scripts/run-eval.ts --performance reverse-exe \
 *     --candidates ground-exe-v0,claude-opus-4-7 --judge gpt-5-5
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY     (always)
 *   ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY   (whichever providers are used)
 *   EVAL_COST_CAP_USD          default 20
 *   EVAL_N_PER_THEME           default 3
 *   EVAL_TEMPERATURE           default 0.8
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execSync } from "child_process";
import { parseArgs } from "node:util";
import yaml from "yaml";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const COST_CAP = Number(process.env.EVAL_COST_CAP_USD || 20);
const N_PER_THEME = Number(process.env.EVAL_N_PER_THEME || 3);
const TEMPERATURE = Number(process.env.EVAL_TEMPERATURE || 0.8);

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: "singulars" },
});

// --- Judge prompt — verbatim from research/02 §2.3 ---
const JUDGE_PROMPT = `
You are evaluating poems written for a live human-vs-machine poetry
performance. You will see a theme and three poems. One was written by a
human or machine performer and won the audience vote on the night. One was
written by the opposing performer and lost the audience vote. The third is
a candidate from a model under evaluation.

Your task: rank the three poems from strongest (1) to weakest (3) using the
rubric below. Then state, separately, whether the candidate poem would
plausibly have won the audience vote against the original winner.

Rubric (weight all dimensions equally):
1. IMAGE — does the poem produce a specific, non-cliched image or scene?
2. PRESSURE — does the language feel earned, not slack? Are line breaks
   doing work?
3. SURPRISE — is there a turn, reframe, or unexpected closure?
4. FIDELITY — does the poem actually engage the theme, not orbit it?
5. VOICE — does it sound like a person (or a coherent persona), not
   a generic poetry voice?

Penalize: greeting-card sentiment, generic nature imagery
("whispering wind", "dancing leaves"), forced rhyme, abstract nouns
substituting for image, AI-tells (em-dash overuse, "tapestry", "in a
world where").

THEME: {{theme}}

POEM A:
{{poem_a}}

POEM B:
{{poem_b}}

POEM C:
{{output}}

Think step by step. For each poem, write 2-3 sentences identifying its
strongest move and its weakest move. Then output your verdict in this
exact JSON shape, no other text:

{
  "ranking": ["A" | "B" | "C", "A" | "B" | "C", "A" | "B" | "C"],
  "candidate_beats_winner": true | false,
  "confidence": "low" | "medium" | "high",
  "rationale_one_line": "..."
}
`.trim();

type Tuple = {
  performance_slug: string;
  theme: string;
  theme_slug: string;
  winner_text: string;
  loser_text: string;
};

async function loadTuples(perfSlug: string): Promise<Tuple[]> {
  const { data, error } = await sb.rpc("golden_tuples_for_performance", {
    p_slug: perfSlug,
  });
  if (error) throw error;
  return data as Tuple[];
}

async function loadCandidate(slug: string) {
  const { data, error } = await sb
    .from("candidate_models")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return data;
}

function buildConfig(opts: {
  candidate: { name: string; api_endpoint: string };
  judgeModel: string;
  tuples: Tuple[];
}) {
  // Each (theme, candidate) generates a poem; the judge uses A/B from the tuple
  // and C from the output. We run twice with A↔B swap (position-bias control)
  // by listing two assertions.
  return {
    description: `Singulars eval — ${opts.candidate.name}`,
    prompts: [
      "Write a short poem on the theme: {{theme}}. No preamble, just the poem. Free verse. 8-24 lines. Avoid 'tapestry', 'whispers', em-dash overuse.",
    ],
    providers: [
      {
        id: opts.candidate.api_endpoint,
        config: { temperature: TEMPERATURE, max_tokens: 600 },
      },
    ],
    defaultTest: {
      assert: [
        {
          type: "llm-rubric",
          provider: opts.judgeModel,
          value: JUDGE_PROMPT.replace("{{poem_a}}", "{{winner_text}}").replace(
            "{{poem_b}}",
            "{{loser_text}}",
          ),
          metric: "candidate_vs_winner_AB",
        },
        // Swap A/B for position-bias mitigation
        {
          type: "llm-rubric",
          provider: opts.judgeModel,
          value: JUDGE_PROMPT.replace("{{poem_a}}", "{{loser_text}}").replace(
            "{{poem_b}}",
            "{{winner_text}}",
          ),
          metric: "candidate_vs_winner_BA",
        },
      ],
    },
    tests: opts.tuples.map((t) => ({
      vars: {
        theme: t.theme,
        theme_slug: t.theme_slug,
        winner_text: t.winner_text,
        loser_text: t.loser_text,
      },
    })),
  };
}

async function markRun(runId: string, patch: Record<string, unknown>) {
  await sb.from("eval_runs").update(patch).eq("id", runId);
}

async function runOneEval(args: {
  runId: string;
  performanceSlug: string;
  candidateSlug: string;
  judgeModel: string;
}) {
  const { runId, performanceSlug, candidateSlug, judgeModel } = args;

  await markRun(runId, {
    status: "running",
    started_at: new Date().toISOString(),
  });

  try {
    const tuples = await loadTuples(performanceSlug);
    if (tuples.length === 0)
      throw new Error(`No tuples for ${performanceSlug}`);

    const candidate = await loadCandidate(candidateSlug);
    if (!candidate?.api_endpoint)
      throw new Error(`Candidate ${candidateSlug} has no api_endpoint`);

    const cfg = buildConfig({
      candidate: { name: candidate.name, api_endpoint: candidate.api_endpoint },
      judgeModel,
      tuples,
    });

    const dir = mkdtempSync(join(tmpdir(), "singulars-eval-"));
    const cfgPath = join(dir, "promptfooconfig.yaml");
    const outPath = join(dir, "results.json");
    writeFileSync(cfgPath, yaml.stringify(cfg));

    await markRun(runId, {
      n_themes: tuples.length,
      config_snapshot: cfg,
    });

    // Cost guardrail: promptfoo --max-cost (USD).
    execSync(
      `npx promptfoo@latest eval -c "${cfgPath}" -o "${outPath}" --max-concurrency 4 --max-cost ${COST_CAP}`,
      { stdio: "inherit", env: process.env },
    );

    const results = JSON.parse(readFileSync(outPath, "utf-8"));
    // promptfoo schema: results.results.results[i].vars / response / gradingResult
    const rows: Array<{
      vars: Record<string, string>;
      response?: { output?: string };
      gradingResult?: {
        componentResults?: Array<{
          pass: boolean;
          reason?: string;
          namedScores?: Record<string, number>;
        }>;
      };
    }> = results.results?.results ?? [];

    let won = 0;
    let totalRank = 0;
    let countedRanks = 0;

    for (const r of rows) {
      const themeSlug = r.vars.theme_slug;
      const candidateText = r.response?.output ?? "";

      // Parse the two judge JSON payloads (A/B and B/A); take majority on candidate_beats_winner.
      const components = r.gradingResult?.componentResults ?? [];
      const verdicts = components
        .map((c) => {
          try {
            // promptfoo's llm-rubric stuffs the judge JSON into reason
            const m = c.reason?.match(/\{[\s\S]*\}/);
            return m ? JSON.parse(m[0]) : null;
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      const beats = verdicts.filter(
        (v) => v.candidate_beats_winner === true,
      ).length;
      const candidateWon = beats > verdicts.length / 2;
      const ranks = verdicts
        .map((v) => (v.ranking as string[]).indexOf("C") + 1)
        .filter((n) => n > 0);
      const meanRank = ranks.length
        ? ranks.reduce((a, b) => a + b, 0) / ranks.length
        : null;
      const rationale = verdicts
        .map((v) => v.rationale_one_line)
        .filter(Boolean)
        .join(" || ");
      const confidence = verdicts[0]?.confidence ?? null;
      const swapAgreed =
        verdicts.length === 2 &&
        verdicts[0].candidate_beats_winner ===
          verdicts[1].candidate_beats_winner;

      // Idempotent upsert
      await sb.rpc("upsert_eval_score", {
        p_run_id: runId,
        p_theme_slug: themeSlug,
        p_candidate_won: candidateWon,
        p_rationale: rationale,
        p_score: candidateWon ? 1 : 0,
      });

      // Patch the additional columns the helper doesn't write
      await sb
        .from("eval_scores")
        .update({
          candidate_text: candidateText,
          candidate_rank: meanRank ? Math.round(meanRank) : null,
          confidence,
          position_swap_agreement: swapAgreed,
          raw_judge_payload: verdicts,
        })
        .eq("eval_run_id", runId)
        .eq("theme_slug", themeSlug);

      if (candidateWon) won++;
      if (meanRank) {
        totalRank += meanRank;
        countedRanks++;
      }

      await markRun(runId, { n_themes_completed: rows.indexOf(r) + 1 });
    }

    const winRate = rows.length ? won / rows.length : 0;
    const meanRank = countedRanks ? totalRank / countedRanks : null;
    const costUsd = results.results?.stats?.tokenUsage?.cost ?? null;

    await markRun(runId, {
      status: "completed",
      finished_at: new Date().toISOString(),
      win_rate: winRate,
      mean_rank: meanRank,
      cost_usd: costUsd,
    });
  } catch (err) {
    await markRun(runId, {
      status: "failed",
      finished_at: new Date().toISOString(),
      error_message: (err as Error).message,
    });
    throw err;
  }
}

// ---- CLI entrypoint ----
async function main() {
  const { values } = parseArgs({
    options: {
      "run-id": { type: "string" },
      performance: { type: "string" },
      candidates: { type: "string" },
      judge: { type: "string" },
    },
  });

  if (values["run-id"]) {
    // Server-invoked path: run row already exists.
    const { data: run } = await sb
      .from("eval_runs")
      .select("*")
      .eq("id", values["run-id"])
      .single();
    const { data: cand } = await sb
      .from("candidate_models")
      .select("slug")
      .eq("id", run.candidate_model_id)
      .single();
    const { data: perf } = await sb
      .from("performances")
      .select("slug")
      .eq("id", run.performance_id)
      .single();
    await runOneEval({
      runId: run.id,
      performanceSlug: perf.slug,
      candidateSlug: cand.slug,
      judgeModel: run.judge_model,
    });
    return;
  }

  // CLI path: create run rows ourselves.
  if (!values.performance || !values.candidates || !values.judge) {
    console.error(
      "Usage: --performance <slug> --candidates <slug,slug> --judge <provider:model>",
    );
    process.exit(2);
  }

  const { data: perf } = await sb
    .from("performances")
    .select("id, slug")
    .eq("slug", values.performance)
    .single();
  const candidateSlugs = values.candidates.split(",").map((s) => s.trim());

  for (const slug of candidateSlugs) {
    const { data: cand } = await sb
      .from("candidate_models")
      .select("id, slug")
      .eq("slug", slug)
      .single();
    const { data: run } = await sb
      .from("eval_runs")
      .insert({
        candidate_model_id: cand.id,
        performance_id: perf.id,
        judge_model: values.judge,
        triggered_by: "manual",
        triggered_by_user: "cli",
        status: "pending",
      })
      .select()
      .single();

    await runOneEval({
      runId: run.id,
      performanceSlug: perf.slug,
      candidateSlug: cand.slug,
      judgeModel: values.judge,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

A `package.json` script entry:

```json
"scripts": {
  "eval": "tsx scripts/run-eval.ts"
}
```

### 4.4 Idempotence & resume

- Every score insert goes through `singulars.upsert_eval_score`, which deletes any prior row for `(run_id, theme_slug)` first. Re-running a failed run with the same `run-id` therefore picks up cleanly — completed themes get their scores rewritten with the same value, in-flight themes finish.
- The runner could be made fully resumable (skip themes whose score row already exists) but for v1 the simpler "always re-run, idempotent writes" approach is enough; cost is bounded by `--max-cost`.

### 4.5 Cost guardrails

- `EVAL_COST_CAP_USD` env (default $20) → passed to promptfoo's `--max-cost`. Hard ceiling per run.
- The admin "Run new eval" form pre-computes an estimate from `(n_themes × n_candidates × (1 generation + 2 judge calls) × est-tokens × $/M)` and shows it next to the cost-cap input. Halim sees "Estimated $4.20, cap $20" before he clicks Run.
- Per-month spend across all candidate runs is tracked in `singulars.eval_runs.cost_usd` and surfaced on the admin dashboard.

---

## 5. The dashboard read-side

### View 1 — Model Evolution Chart (per-model win-rate per performance)

Public chart on `/singulars` reads from the materialised view `singulars.v_model_winrate_per_performance`:

```sql
SELECT model_slug, model_name, model_color, performance_slug,
       performance_name, performance_date, win_rate, n_themes
FROM   singulars.v_model_winrate_per_performance
WHERE  published = true
ORDER  BY performance_date ASC, model_name ASC;
```

The view already (a) filters to the latest completed run per (model, performance) and (b) joins in candidate_models + performances. RLS on the underlying `eval_runs` table limits anon callers to `published = true AND status = 'completed'`.

### View 2 — Head-to-Head Matrix (model × performance)

Pivoted client-side; the SQL is the same as View 1 but the UI groups by `(model_slug, performance_slug)` into a table.

```sql
-- Same source rows; the pivot happens in the React layer.
SELECT model_slug, performance_slug, win_rate, mean_rank, n_themes
FROM   singulars.v_model_winrate_per_performance
WHERE  published = true;
```

For the pivoted matrix used in the Substack screenshot:

```sql
SELECT
  cm.slug AS model_slug,
  jsonb_object_agg(perf.slug, r.win_rate ORDER BY perf.date) AS by_perf
FROM singulars.eval_runs r
JOIN singulars.candidate_models cm  ON cm.id = r.candidate_model_id
JOIN singulars.performances perf    ON perf.id = r.performance_id
WHERE r.status = 'completed' AND r.published = true
GROUP BY cm.slug;
```

### View 3 — Admin preview (latest eval per pair, including unpublished)

Only readable via the service-role client used in admin API routes:

```sql
SELECT *
FROM   singulars.v_latest_eval_run
ORDER  BY created_at DESC;
```

Plus a per-run drill-down:

```sql
SELECT s.theme_slug, s.candidate_won, s.candidate_rank, s.confidence,
       s.position_swap_agreement, s.judge_rationale, s.candidate_text
FROM   singulars.eval_scores s
WHERE  s.eval_run_id = $1
ORDER  BY s.theme_slug;
```

---

## 6. Trigger architecture

### 6.1 Primary: manual button click

The flow described in §1: Halim opens `/admin/eval-runs/new`, picks performance + candidates + judge, clicks "Run". This is the path **we want to optimise**. It is also the artistically correct one: the eval re-running is a deliberate act, not a side effect of a database write.

### 6.2 Secondary (optional, off by default): nightly cron email

`vercel.json`:

```json
{
  "crons": [
    { "path": "/api/admin/cron/check-trained", "schedule": "0 3 * * *" }
  ]
}
```

The route looks for `performances` with `status='trained'` and no completed run in the last 24 h, and sends Halim a single email ("ground.exe was trained yesterday — open the admin to run the eval"). It does **not** kick off the eval. This preserves the artistic constraint while removing the failure mode of "Halim forgot."

Off by default — Halim turns it on by setting `ADMIN_NIGHTLY_EMAIL=halim@oulipo.xyz` in Vercel env.

### 6.3 Why **not** a Postgres trigger on status change?

Three reasons:

1. **Artistic.** Auto-firing the eval from a status flip removes the human ritual.
2. **Operational.** A trigger that calls `pg_net` or an Edge Function loses the ability to gate on cost, judge model, candidate selection — all of which Halim wants to vary per performance.
3. **Failure mode.** A trigger that fails silently (network glitch, API outage, missing API keys) leaves a `trained` performance with no run and no error visible to Halim.

If we ever automate it, the cron polling pattern is strictly better — it's idempotent, observable, and can re-fire on transient failures.

---

## 7. Failure handling

| Failure mode                                              | Surface in admin                                                                                          | Mitigation                                                                                                                                                                                               |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Judge timeout** (a single LLM call hangs)               | `eval_scores.raw_judge_payload IS NULL` for the offending row; `eval_runs.error_message` shows last error | promptfoo retries with backoff; we set `--retries 3` in the runner. After exhaustion the row's `candidate_won=false` and rationale = "judge timed out — gray-out".                                       |
| **Model API outage** (entire run fails)                   | `eval_runs.status='failed'` with red banner on `/admin/eval-runs`                                         | Detail page shows `error_message`; "Rerun" button clones the run.                                                                                                                                        |
| **Partial completion** (5 of 8 themes done before crash)  | `n_themes_completed=5`, `status='failed'`                                                                 | Re-run is idempotent — `upsert_eval_score` overwrites prior rows, completed themes write the same data, missing ones fill in. Halim presses Rerun.                                                       |
| **Cost overrun** (`--max-cost` triggered)                 | `status='failed'`, `error_message='cost cap reached at $X'`                                               | Halim raises cap on Rerun, or trims candidates. The estimated-cost display on the new-eval form reduces the chance of hitting this in the first place.                                                   |
| **Judge JSON parse failure**                              | row's `raw_judge_payload` contains the malformed text; UI flags it as "judge produced invalid JSON"       | Rationale falls back to `''`, `candidate_won=false`. Recommend re-running with a different judge model.                                                                                                  |
| **Missing API key**                                       | `eval_runs.error_message='ANTHROPIC_API_KEY not set'`                                                     | Surface in red banner with a link to the Vercel env settings.                                                                                                                                            |
| **Position-bias divergence** (A↔B disagree)               | `position_swap_agreement=false`                                                                           | Per-theme detail row marks it amber. The row still counts (we take majority), but Halim can drill in. If >30% of themes diverge, the run is flagged with a warning and the headline win rate is starred. |
| **Vote tally drift** (RPC count ≠ underlying votes table) | "Sync vote tallies" shows a non-zero diff before applying                                                 | Idempotent `sync-tallies` route reconciles.                                                                                                                                                              |

---

## 8. Cost estimate

Numbers from research/03 §3 (April 2026):

- **Claude Opus 4.7** — $5/M input, $25/M output
- **GPT-5.5 standard** — $5/M input, $30/M output
- **Gemini 3.1 Pro** — $2/M input, $12/M output
- **DeepSeek R1** — $0.55/M input, $2.19/M output

Per-tuple cost (one performance, one candidate, one judge, with A/B swap):

- **Generation:** ~150 input + 400 output tokens × 3 samples = ~450 in / 1,200 out per theme.
- **Judge:** ~1,500 input (theme + 3 poems + rubric) + 200 output tokens × 2 swaps = ~3,000 in / 400 out per theme.

For 8 themes × 1 candidate × 1 judge:

| Candidate                | Generation | Judge (Opus 4.7) | Total per perf | Per year (3-4 perfs) |
| ------------------------ | ---------- | ---------------- | -------------- | -------------------- |
| Opus 4.7                 | $0.26      | $0.20            | ~$0.46         | ~$1.84               |
| GPT-5.5                  | $0.31      | $0.20            | ~$0.51         | ~$2.04               |
| Gemini 3.1 Pro           | $0.13      | $0.20            | ~$0.33         | ~$1.32               |
| DeepSeek R1              | $0.04      | $0.20            | ~$0.24         | ~$0.96               |
| ground.exe (self-hosted) | ~$0        | $0.20            | ~$0.20         | ~$0.80               |

Running **all five** candidates against **one performance** with the Opus judge: ~$1.74 per performance. Across the four currently-trained performances (carnation.exe, versus.exe, reinforcement.exe, hard.exe): ~$7. Add reverse.exe and ground.exe = ~$10.50 for a full bake-off across the whole catalogue.

Halim's cadence is 3-4 shows/year, so a yearly steady-state ceiling is **~$50/year** in eval-API spend, including periodic re-runs against historical performances when a new ground.exe version ships. The `EVAL_COST_CAP_USD=20` default is comfortably above any single run.

This excludes calibration runs (research/02 §2.5 — Surge + Prolific ~$1,500-2,400) which are a one-time spend, not part of the recurring update loop.

---

## 9. Migration ordering

Apply migrations in this order:

1. `scripts/schema.sql` _(already applied — performances, poems, votes, RLS, cast_vote RPC)_
2. `scripts/migration-themes.sql` _(already applied — themes table + upvote RPC)_
3. `scripts/migration-2026-03-10.sql` _(already applied — ground.exe seed, reverse.exe poems)_
4. **`planning/research/06-migration-evals.sql`** _(new — this file)_

The new migration is purely additive: new types (`eval_run_status`, `eval_trigger`, `candidate_family`), new tables (`candidate_models`, `eval_runs`, `eval_scores`), new helper functions, new RLS policies, two new views. **It does not modify any existing object.** All `CREATE` statements are guarded with `IF NOT EXISTS` or `OR REPLACE`. All `DROP POLICY ... IF EXISTS` precede the matching `CREATE POLICY` so re-running is safe.

### Rollback

```sql
DROP VIEW  IF EXISTS singulars.v_model_winrate_per_performance;
DROP VIEW  IF EXISTS singulars.v_latest_eval_run;
DROP FUNCTION IF EXISTS singulars.upsert_eval_score(uuid, text, boolean, text, numeric);
DROP FUNCTION IF EXISTS singulars.golden_tuples_for_performance(text);
DROP TABLE IF EXISTS singulars.eval_scores      CASCADE;
DROP TABLE IF EXISTS singulars.eval_runs        CASCADE;
DROP TABLE IF EXISTS singulars.candidate_models CASCADE;
DROP TYPE  IF EXISTS singulars.eval_run_status;
DROP TYPE  IF EXISTS singulars.eval_trigger;
DROP TYPE  IF EXISTS singulars.candidate_family;
DROP FUNCTION IF EXISTS singulars.touch_updated_at();
```

No existing tables/columns/policies are touched, so rollback is contained.

### Pre-flight checks

Before applying:

```sql
-- Confirm we're on the singulars schema
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'singulars';

-- Confirm the parent FK targets exist
SELECT count(*) FROM singulars.performances;
SELECT count(*) FROM singulars.poems;
```

After applying:

```sql
-- Smoke test the helper
SELECT * FROM singulars.golden_tuples_for_performance('hard-exe');

-- Confirm the seed candidates landed
SELECT slug, family, color, is_public FROM singulars.candidate_models;
```

---

## 10. Open questions for Halim

A handful of decisions need an artist's call before this ships:

1. **Default judge.** I've stubbed Opus 4.7 throughout but research/02 §2.7 recommends a judge from a _different family_ than every candidate. If `ground.exe` is Claude-derived we should default to GPT-5.5 (cheap enough, ~$30/M output × low judge-token usage = cents per run). Confirm preference.
2. **Publish-by-default vs draft-by-default.** Currently new runs land as `published=false`. Do you want to flip that for trusted candidates (e.g. `is_public=true` models auto-publish their runs)?
3. **Recency-weighting on the public chart.** Older performances and newer ones currently get equal visual weight. Should `carnation.exe` data points fade over time?
4. **Vote-entry audit trail.** v1 just overwrites `poems.vote_count` directly. v2 could add a `singulars.poem_vote_overrides` table logging who/when/why. Worth it?
5. **Calibration cohort.** Per research/02 §2.5, the judge prompt needs human calibration. Do we wire that into this admin (a "calibration mode" where human triplets are stored and compared) or keep it as a separate one-off project?

---

## Summary

Five admin sections live at `/admin`: **Performances** (status flips, vote tally sync), **Vote entry** (per-theme editable counts + CSV import for paper ballots), **Candidate models** (CRUD with public/private + colour), **Eval runs** (trigger + monitor + per-theme drill-down + publish toggle), and **Publish controls** (master matrix of what goes on the public chart). Trigger model is **manual button-click as primary**, with an optional off-by-default Vercel cron that emails Halim when a freshly-trained performance is missing a run — Postgres triggers are explicitly avoided because the human ritual is artistically load-bearing. The runner is a TypeScript wrapper around **promptfoo** (per research/04) that loads tuples via a new `golden_tuples_for_performance` RPC, runs the verbatim research/02 judge prompt with A/B swap, and writes back through an idempotent `upsert_eval_score` helper. Three new tables — `singulars.candidate_models`, `singulars.eval_runs`, `singulars.eval_scores` — plus two views and a small set of helper functions, all additive in the `singulars` schema with RLS gated on `published + is_public` for anon reads. A full bake-off across all five candidate models on one 8-theme performance costs roughly **$1.74**, projected to **~$50/year** at Halim's 3-4 shows-per-year cadence — comfortably under the default $20-per-run cost cap. Open questions for Halim cover the default judge model, draft-vs-publish defaults, recency weighting on the public chart, vote-override audit logging, and how the calibration cohort from research/02 §2.5 is wired into this admin (or kept separate).
