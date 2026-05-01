# Singulars Eval — Data Spec

This document specifies the JSON shapes the three visualization views consume, the SQL queries that produce them, and the API route shape under `/api/evals/results`. It assumes the eval-time tables proposed in `02-poetry-classifiers-and-eval-design.md` and the future `research/06-update-loop.md`: `candidate_models`, `eval_runs`, `eval_scores`. Where those tables don't exist yet, this spec is what they should look like.

---

## 1. Table proposals (additive — no changes to existing schema)

Existing tables (untouched): `singulars.performances`, `singulars.poems`, `singulars.votes`, `singulars.themes`.

New tables, all in the `singulars` schema:

```sql
-- Catalog of candidate models that participate in the eval
CREATE TABLE singulars.candidate_models (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,         -- "ground", "claude-opus", "gpt-5", "carnation"
  display_name  text NOT NULL,                -- "ground.exe", "Claude Opus 4.5"
  kind          text NOT NULL CHECK (kind IN ('candidate','frozen','baseline')),
  -- candidate = the live ground.exe lineage
  -- frozen    = previous fine-tunes (carnation, versus, reinforcement, hard, reverse)
  -- baseline  = closed-source comparators
  color         text,                          -- nullable; falls back to performance color in UI
  provider      text,                          -- "openai", "anthropic", "google", "self"
  model_id      text,                          -- API model id, e.g. "ft:gpt-4.1-nano-...:ground:Cabc"
  version       text,                          -- "v0.5", "checkpoint-3000", "2026-04-15"
  trained_after_perf_slug text REFERENCES singulars.performances(slug),
  -- For frozen fine-tunes: the performance whose votes were the last training input.
  -- For baselines: NULL.
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One row per eval run (a complete pass over the golden set)
CREATE TABLE singulars.eval_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_number      integer NOT NULL UNIQUE,     -- monotonic, human-readable
  judge_provider  text NOT NULL,               -- "openai", "anthropic", "google"
  judge_model_id  text NOT NULL,               -- "gpt-5-2026-04-15", "claude-opus-4-5"
  judge_human_kappa numeric,                   -- calibration result against human raters
  judge_human_agreement numeric,               -- raw agreement
  num_tuples      integer NOT NULL,            -- size of golden set used in this run
  num_models      integer NOT NULL,
  status          text NOT NULL CHECK (status IN ('queued','running','draft','published','discarded')),
  triggered_by    text,                        -- "halim" | "auto-flip:hard-exe"
  triggered_at    timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  published_at    timestamptz,
  -- Public-facing visibility filters chosen at publish time
  visible_model_slugs text[] NOT NULL DEFAULT '{}',
  visible_perf_slugs  text[] NOT NULL DEFAULT '{}',
  notes           text
);

-- Each individual (model x performance) score within a run.
-- Theme-level breakdowns live in eval_score_themes for drilldown.
CREATE TABLE singulars.eval_scores (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid NOT NULL REFERENCES singulars.eval_runs(id) ON DELETE CASCADE,
  model_slug        text NOT NULL REFERENCES singulars.candidate_models(slug),
  performance_slug  text NOT NULL REFERENCES singulars.performances(slug),
  win_rate          numeric NOT NULL CHECK (win_rate >= 0 AND win_rate <= 1),
  num_tuples        integer NOT NULL,           -- themes evaluated for this (model, perf)
  num_wins          integer NOT NULL,
  ci_low            numeric,                    -- bootstrap 5th pct
  ci_high           numeric,                    -- bootstrap 95th pct
  is_projected      boolean NOT NULL DEFAULT false, -- true for ground.exe x ground-exe (no themes yet)
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, model_slug, performance_slug)
);

-- Per-theme breakdown for matrix drilldown
CREATE TABLE singulars.eval_score_themes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid NOT NULL REFERENCES singulars.eval_runs(id) ON DELETE CASCADE,
  model_slug        text NOT NULL,
  performance_slug  text NOT NULL,
  theme_slug        text NOT NULL,
  candidate_text    text NOT NULL,
  audience_winner_poem_id uuid REFERENCES singulars.poems(id),
  judge_says_candidate_wins boolean NOT NULL,
  judge_confidence  text CHECK (judge_confidence IN ('low','medium','high')),
  judge_rationale   text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON singulars.eval_scores (run_id, model_slug);
CREATE INDEX ON singulars.eval_scores (run_id, performance_slug);
CREATE INDEX ON singulars.eval_score_themes (run_id, model_slug, performance_slug);
```

The "golden set" SQL from `02-poetry-classifiers-and-eval-design.md §2.1` remains the source of truth for what each `(performance_slug, theme_slug)` tuple's audience-voted winner is. The eval pipeline materializes that view and stores the per-theme judgments in `eval_score_themes`; aggregates roll up into `eval_scores`.

---

## 2. The chart-feeding query (one round-trip)

For the public view, only the latest **published** run is shown, filtered by its visibility arrays. For the admin view, the latest run regardless of status.

### 2.1 Public chart payload (View 1 + View 2)

```sql
WITH r AS (
  SELECT *
  FROM singulars.eval_runs
  WHERE status = 'published'
  ORDER BY published_at DESC
  LIMIT 1
)
SELECT
  r.id           AS run_id,
  r.run_number,
  r.published_at,
  r.judge_provider,
  r.judge_model_id,
  r.judge_human_agreement,
  r.visible_model_slugs,
  r.visible_perf_slugs,
  -- All performances in display order (date asc), filtered to the run's visibility
  (
    SELECT json_agg(perf_row ORDER BY perf_row.date)
    FROM (
      SELECT
        p.slug, p.name, p.color, p.location, p.date, p.status
      FROM singulars.performances p
      WHERE p.slug = ANY(r.visible_perf_slugs)
    ) perf_row
  ) AS performances,
  -- All visible models with their per-performance scores
  (
    SELECT json_agg(model_row)
    FROM (
      SELECT
        cm.slug, cm.display_name AS name, cm.kind, cm.color,
        cm.trained_after_perf_slug,
        (
          SELECT json_agg(pt ORDER BY pt.perf_date)
          FROM (
            SELECT
              s.performance_slug AS perf,
              s.win_rate         AS rate,
              s.num_tuples       AS n,
              s.ci_low, s.ci_high,
              s.is_projected     AS projected,
              p.date             AS perf_date
            FROM singulars.eval_scores s
            JOIN singulars.performances p ON p.slug = s.performance_slug
            WHERE s.run_id = r.id
              AND s.model_slug = cm.slug
              AND s.performance_slug = ANY(r.visible_perf_slugs)
          ) pt
        ) AS series
      FROM singulars.candidate_models cm
      WHERE cm.slug = ANY(r.visible_model_slugs)
    ) model_row
  ) AS models
FROM r;
```

The query produces a single row that is the entire chart payload. One query, one network round-trip. Good for Vercel serverless cold-start economics.

### 2.2 Theme-drilldown query (View 2 cell tap)

Hit only when a user taps a matrix cell. Lazy-loads to keep the initial payload small.

```sql
SELECT
  est.theme_slug,
  t.theme_slug AS theme,            -- human-readable theme name from poems.theme
  p_winner.text AS audience_winner_text,
  p_winner.author_type AS audience_winner_type,
  est.candidate_text,
  est.judge_says_candidate_wins,
  est.judge_confidence,
  est.judge_rationale
FROM singulars.eval_score_themes est
LEFT JOIN singulars.poems p_winner ON p_winner.id = est.audience_winner_poem_id
LEFT JOIN (
  SELECT DISTINCT theme_slug, theme FROM singulars.poems
) t ON t.theme_slug = est.theme_slug
WHERE est.run_id = $1
  AND est.model_slug = $2
  AND est.performance_slug = $3
ORDER BY est.theme_slug;
```

### 2.3 Admin run-list query (View 3 changelog)

```sql
SELECT
  run_number, status, triggered_at, published_at, triggered_by,
  judge_provider, judge_human_agreement,
  num_models, num_tuples,
  (
    SELECT win_rate FROM singulars.eval_scores
    WHERE run_id = er.id
      AND model_slug = 'ground'
      AND performance_slug = 'ground-exe'
  ) AS ground_projected_win_rate,
  notes
FROM singulars.eval_runs er
ORDER BY triggered_at DESC
LIMIT 25;
```

---

## 3. JSON contract — what the API returns

Both `view-1-evolution.html` and `view-2-matrix.html` consume the same payload. The matrix simply pivots the same data client-side (rows=models, cols=performances).

### 3.1 `GET /api/evals/results` — public chart payload

```jsonc
{
  "run": {
    "id": "uuid",
    "run_number": 13,
    "published_at": "2026-04-12T09:11:14Z",
    "judge": {
      "provider": "openai",
      "model_id": "gpt-5-2026-04-15",
      "human_agreement": 0.82,
      "kappa": 0.64,
    },
  },
  "performances": [
    {
      "slug": "carnation-exe",
      "name": "carnation.exe",
      "color": "#F6009B",
      "location": "Paris",
      "date": "2024-06-22",
      "status": "trained",
    },
    // ...one per visible perf, ordered earliest -> latest
  ],
  "models": [
    {
      "slug": "ground",
      "name": "ground.exe",
      "kind": "candidate", // "candidate" | "frozen" | "baseline"
      "color": "#D97706",
      "trained_after_perf_slug": null,
      "series": [
        {
          "perf": "carnation-exe",
          "rate": 0.41,
          "n": 9,
          "ci_low": 0.34,
          "ci_high": 0.49,
          "projected": false,
        },
        {
          "perf": "ground-exe",
          "rate": 0.73,
          "n": 0,
          "ci_low": null,
          "ci_high": null,
          "projected": true,
        },
      ],
    },
    // ...one per visible model
  ],
}
```

Notes on the contract:

- `kind: "frozen"` models have a `series` shorter than the performance list — they only have rows for performances that existed at or before their training boundary. The chart and matrix render gaps as empty / hatched cells.
- `projected: true` means the model has a forward-looking score (e.g. ground.exe's score on its own upcoming performance). UI renders it as a dashed segment / faded cell. Backend invariant: `projected = true` always implies `n = 0` and `ci_low = ci_high = NULL`.
- All hex colors are stored in `performances.color` and (optionally) `candidate_models.color`. The UI uses `accessibleTextColor()` from `src/lib/color-utils.ts` whenever a color lands on text.
- The payload is small enough to ship without compression: ~8 models × 6 performances × ~80 bytes/point ≈ 4 KB JSON.

### 3.2 `GET /api/evals/themes?run_id=:id&model=:slug&perf=:slug` — drilldown

```jsonc
{
  "run_id": "uuid",
  "model_slug": "ground",
  "performance_slug": "hard-exe",
  "themes": [
    {
      "theme_slug": "salt",
      "theme": "salt",
      "audience_winner_text": "Salt on the rim of the morning…",
      "audience_winner_type": "human",
      "candidate_text": "I taste the salt in your absence…",
      "judge_says_candidate_wins": true,
      "judge_confidence": "high",
      "judge_rationale": "Candidate's image is more specific; original closes on a cliché.",
    },
  ],
}
```

### 3.3 `GET /api/evals/admin/runs` — admin run list (auth required)

Returns the changelog feeding the admin view's run-history section. Same shape as the SQL in §2.3.

### 3.4 `POST /api/evals/admin/runs/:id/publish` — promote to public

```jsonc
// Request
{
  "visible_model_slugs": ["ground", "hard", "claude-opus", "gpt-5", "gemini-2-5"],
  "visible_perf_slugs": ["carnation-exe", "versus-exe", "reinforcement-exe", "hard-exe", "reverse-exe", "ground-exe"]
}
// Response
{
  "ok": true,
  "run_number": 14,
  "published_at": "2026-04-30T15:14:02Z"
}
```

Behavior: sets `status = 'published'`, sets `published_at = now()`, persists the visibility arrays, and **demotes the previously-published run to status `'draft'`**. There is exactly one published run at a time; the public chart always reads the latest published.

### 3.5 `POST /api/evals/admin/runs` — kick off a new run

```jsonc
// Request
{
  "judge_provider": "openai",
  "judge_model_id": "gpt-5-2026-04-15",
  "candidate_model_slugs": ["ground", "claude-opus", "gpt-5", "gemini-2-5"],
  "performance_slugs": ["carnation-exe", "versus-exe", "reinforcement-exe", "hard-exe", "reverse-exe"],
  "n_generations_per_theme": 5,
  "temperature": 0.8,
  "triggered_by": "halim"
}
// Response (immediate — actual eval runs async)
{
  "run_id": "uuid",
  "run_number": 15,
  "status": "queued",
  "estimated_completion": "2026-04-30T15:32:00Z"
}
```

### 3.6 Auth

The admin routes (`/api/evals/admin/*`) reuse the existing cookie pattern in `src/app/api/themes/admin/auth/route.ts`. Same `singulars-admin` cookie, same password (or its successor). All public eval routes are anonymous.

---

## 4. Caching and update strategy

- Public `GET /api/evals/results` is cached at the edge for 5 minutes (`Cache-Control: s-maxage=300, stale-while-revalidate=86400`). Publishing a new run busts the cache via Vercel's revalidation API or by tagging the response with the run id.
- The chart never streams. Re-renders happen only on full page load. This matches the "page from a printed essay" tone in the design brief.
- The drilldown endpoint is uncached because the request space is already small (model × performance) and the response is gated on a user click — no benefit to pre-warming.

## 5. What's deliberately NOT in the spec

- **No streaming eval scores.** The eval is computed asynchronously, written to `eval_scores`, and surfaced only after the admin publishes. The public chart never shows a half-finished run.
- **No A/B comparison endpoints.** Only the latest published run is exposed publicly. Past runs are visible to the admin in the changelog only.
- **No raw judge logs in the public payload.** `judge_rationale` is exposed in the drilldown only — the chart itself never carries free-form text. This keeps the public surface auditable but small.
- **No real-time vote count fields.** Vote counts come from the existing `poems.vote_count` column; the eval payload purposefully does not duplicate them. The chart audience cares about the _evaluator's_ judgment, not the underlying vote tally.

---

## 6. Mapping back to the codebase

- `src/lib/supabase.ts` — already has `getServiceClient()` and `getSupabase()`. Use the service client for admin write paths, the anon client for the public read.
- `src/lib/color-utils.ts` — `accessibleTextColor()` and `accessibleUIColor()` are already the right helpers for any color that lands on text vs. UI dot fills.
- `src/lib/models.ts` — the `MODELS` registry can seed the `candidate_models` table for the five `frozen` rows and one `candidate` row. Baselines (Claude, GPT-5, Gemini) are inserted manually as part of the eval pipeline setup.
- `src/app/api/themes/admin/auth/route.ts` — copy the cookie pattern verbatim for the eval admin routes.
- New routes: `src/app/api/evals/results/route.ts`, `src/app/api/evals/themes/route.ts`, `src/app/api/evals/admin/runs/route.ts`, `src/app/api/evals/admin/runs/[id]/publish/route.ts`.
- New pages: `src/app/evolution/page.tsx` (or `src/app/about/evolution/page.tsx`), `src/app/admin/evals/page.tsx`.
