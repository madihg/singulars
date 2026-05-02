-- ============================================================================
-- Singulars Eval Loop Migration
-- ----------------------------------------------------------------------------
-- File:    06-migration-evals.sql
-- Date:    2026-04-30
-- Purpose: Add the post-performance eval pipeline tables (candidate_models,
--          eval_runs, eval_scores) plus admin-write / public-read RLS policies
--          and the SQL helper functions the runner & dashboard rely on.
--
-- Design:  ADDITIVE ONLY. Idempotent. Safe to run repeatedly. Does not modify
--          existing performances / poems / votes / themes tables. All objects
--          live in the singulars schema to match scripts/migration-themes.sql.
--
-- Run order:
--   1. scripts/schema.sql                           (already applied)
--   2. scripts/migration-themes.sql                 (already applied)
--   3. scripts/migration-2026-03-10.sql             (already applied)
--   4. THIS FILE                                    <-- new
--
-- Rollback (manual):
--   DROP TABLE IF EXISTS singulars.eval_scores CASCADE;
--   DROP TABLE IF EXISTS singulars.eval_runs CASCADE;
--   DROP TABLE IF EXISTS singulars.candidate_models CASCADE;
--   DROP FUNCTION IF EXISTS singulars.golden_tuples_for_performance(text);
--   DROP FUNCTION IF EXISTS singulars.upsert_eval_score(uuid, text, boolean, text, numeric);
--   DROP VIEW IF EXISTS singulars.v_model_winrate_per_performance;
--   DROP VIEW IF EXISTS singulars.v_latest_eval_run;
-- ============================================================================


-- ============================================
-- 1. Custom enum types
-- ============================================

DO $$ BEGIN
  CREATE TYPE singulars.eval_run_status AS ENUM (
    'pending', 'running', 'completed', 'failed', 'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE singulars.eval_trigger AS ENUM ('manual', 'auto');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE singulars.candidate_family AS ENUM (
    'claude', 'gpt', 'gemini', 'grok', 'deepseek', 'qwen', 'llama',
    'mistral', 'open-source-ground', 'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;


-- ============================================
-- 2. candidate_models
-- ============================================

CREATE TABLE IF NOT EXISTS singulars.candidate_models (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,                 -- "Claude Opus 4.7"
  slug              text NOT NULL UNIQUE,          -- "claude-opus-4-7"
  family            singulars.candidate_family NOT NULL,
  version_label     text,                          -- "4.7", "v0", "v1"
  fine_tune_source  uuid REFERENCES singulars.candidate_models(id) ON DELETE SET NULL,
  api_endpoint      text,                          -- promptfoo provider id (e.g. "anthropic:messages:claude-opus-4-7")
  hf_repo           text,                          -- "halim/ground-exe-v1"
  color             text NOT NULL DEFAULT '#888',  -- hex for chart series
  notes             text,
  is_public         boolean NOT NULL DEFAULT false,
  archived          boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_models_public
  ON singulars.candidate_models (is_public, archived);

CREATE INDEX IF NOT EXISTS idx_candidate_models_family
  ON singulars.candidate_models (family);


-- ============================================
-- 3. eval_runs
-- ============================================

CREATE TABLE IF NOT EXISTS singulars.eval_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_model_id  uuid NOT NULL REFERENCES singulars.candidate_models(id) ON DELETE CASCADE,
  performance_id      uuid NOT NULL REFERENCES singulars.performances(id)    ON DELETE CASCADE,
  judge_model         text NOT NULL,                  -- e.g. "anthropic:messages:claude-opus-4-7"
  n_themes            integer NOT NULL DEFAULT 0,
  n_themes_completed  integer NOT NULL DEFAULT 0,
  status              singulars.eval_run_status NOT NULL DEFAULT 'pending',
  triggered_by        singulars.eval_trigger    NOT NULL DEFAULT 'manual',
  triggered_by_user   text,                           -- email/note for audit
  started_at          timestamptz,
  finished_at         timestamptz,
  duration_ms         integer,
  cost_usd            numeric(10, 4),
  win_rate            numeric(5, 4),                  -- denormalised aggregate
  mean_rank           numeric(5, 4),
  error_message       text,
  config_snapshot     jsonb,                          -- full promptfooconfig.yaml as parsed JSON
  published           boolean NOT NULL DEFAULT false, -- draft until Halim says so
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- One run per (model, performance) is the canonical state. Re-running replaces
-- the prior latest one (we don't enforce uniqueness — history is useful — but
-- we index for "latest per pair" lookups).
CREATE INDEX IF NOT EXISTS idx_eval_runs_model_perf
  ON singulars.eval_runs (candidate_model_id, performance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_eval_runs_status
  ON singulars.eval_runs (status);

CREATE INDEX IF NOT EXISTS idx_eval_runs_published
  ON singulars.eval_runs (published, performance_id);


-- ============================================
-- 4. eval_scores  (per-tuple judge verdicts)
-- ============================================

CREATE TABLE IF NOT EXISTS singulars.eval_scores (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eval_run_id       uuid NOT NULL REFERENCES singulars.eval_runs(id) ON DELETE CASCADE,
  performance_id    uuid NOT NULL REFERENCES singulars.performances(id) ON DELETE CASCADE,
  theme_slug        text NOT NULL,
  candidate_text    text NOT NULL,
  candidate_won     boolean NOT NULL,            -- did candidate beat the audience winner?
  candidate_rank    integer,                      -- 1 / 2 / 3 (1 best)
  judge_rationale   text,
  score             numeric(5, 4),                -- normalized 0..1 (e.g. agreement-weighted)
  confidence        text,                         -- "low" | "medium" | "high"
  position_swap_agreement boolean,                -- did A/B swap agree? (bias check)
  raw_judge_payload jsonb,                        -- full JSON the judge returned
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eval_scores_run
  ON singulars.eval_scores (eval_run_id);

CREATE INDEX IF NOT EXISTS idx_eval_scores_perf_theme
  ON singulars.eval_scores (performance_id, theme_slug);


-- ============================================
-- 5. updated_at touch trigger for candidate_models
-- ============================================

CREATE OR REPLACE FUNCTION singulars.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_candidate_models_touch ON singulars.candidate_models;
CREATE TRIGGER trg_candidate_models_touch
  BEFORE UPDATE ON singulars.candidate_models
  FOR EACH ROW
  EXECUTE FUNCTION singulars.touch_updated_at();


-- ============================================
-- 6. Row-Level Security
-- ============================================

ALTER TABLE singulars.candidate_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE singulars.eval_runs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE singulars.eval_scores      ENABLE ROW LEVEL SECURITY;

-- Public read: only public, non-archived candidate models are visible to anon.
DROP POLICY IF EXISTS "Public read public candidate_models" ON singulars.candidate_models;
CREATE POLICY "Public read public candidate_models"
  ON singulars.candidate_models FOR SELECT
  TO anon
  USING (is_public = true AND archived = false);

-- Public read: only published, completed eval_runs are visible to anon.
DROP POLICY IF EXISTS "Public read published eval_runs" ON singulars.eval_runs;
CREATE POLICY "Public read published eval_runs"
  ON singulars.eval_runs FOR SELECT
  TO anon
  USING (published = true AND status = 'completed');

-- Public read: scores tied to a published completed run.
DROP POLICY IF EXISTS "Public read published eval_scores" ON singulars.eval_scores;
CREATE POLICY "Public read published eval_scores"
  ON singulars.eval_scores FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM singulars.eval_runs r
      WHERE r.id = eval_scores.eval_run_id
        AND r.published = true
        AND r.status = 'completed'
    )
  );

-- All writes go through the service role key (bypasses RLS) — exactly the
-- pattern in src/app/api/themes/admin/[id]/route.ts.


-- ============================================
-- 7. Helper SQL: golden-tuple loader (used by the runner)
--    Mirrors the SELECT in research/02 §2.1 but parameterised by performance.
-- ============================================

CREATE OR REPLACE FUNCTION singulars.golden_tuples_for_performance(p_slug text)
RETURNS TABLE (
  performance_slug   text,
  performance_name   text,
  performance_date   date,
  theme              text,
  theme_slug         text,
  winner_text        text,
  winner_author      text,
  winner_type        text,
  winner_votes       integer,
  loser_text         text,
  loser_author       text,
  loser_type         text,
  loser_votes        integer,
  total_votes        integer,
  vote_margin        integer
)
LANGUAGE sql
STABLE
AS $$
  WITH theme_pairs AS (
    SELECT
      perf.slug   AS performance_slug,
      perf.name   AS performance_name,
      perf.date   AS performance_date,
      p.theme,
      p.theme_slug,
      MAX(CASE WHEN p.author_type = 'human'   THEN p.text         END) AS human_text,
      MAX(CASE WHEN p.author_type = 'human'   THEN p.author_name  END) AS human_author,
      MAX(CASE WHEN p.author_type = 'human'   THEN p.vote_count   END) AS human_votes,
      MAX(CASE WHEN p.author_type = 'machine' THEN p.text         END) AS machine_text,
      MAX(CASE WHEN p.author_type = 'machine' THEN p.author_name  END) AS machine_author,
      MAX(CASE WHEN p.author_type = 'machine' THEN p.vote_count   END) AS machine_votes
    FROM singulars.performances perf
    JOIN singulars.poems p ON p.performance_id = perf.id
    WHERE perf.slug = p_slug
      AND perf.status = 'trained'
    GROUP BY perf.slug, perf.name, perf.date, p.theme, p.theme_slug
  )
  SELECT
    performance_slug,
    performance_name,
    performance_date,
    theme,
    theme_slug,
    CASE WHEN human_votes >= machine_votes THEN human_text   ELSE machine_text   END,
    CASE WHEN human_votes >= machine_votes THEN human_author ELSE machine_author END,
    CASE WHEN human_votes >= machine_votes THEN 'human'      ELSE 'machine'      END,
    CASE WHEN human_votes >= machine_votes THEN human_votes  ELSE machine_votes  END,
    CASE WHEN human_votes >= machine_votes THEN machine_text   ELSE human_text   END,
    CASE WHEN human_votes >= machine_votes THEN machine_author ELSE human_author END,
    CASE WHEN human_votes >= machine_votes THEN 'machine'      ELSE 'human'      END,
    CASE WHEN human_votes >= machine_votes THEN machine_votes  ELSE human_votes  END,
    COALESCE(human_votes, 0) + COALESCE(machine_votes, 0),
    ABS(COALESCE(human_votes, 0) - COALESCE(machine_votes, 0))
  FROM theme_pairs
  WHERE human_text IS NOT NULL AND machine_text IS NOT NULL;
$$;


-- ============================================
-- 8. Helper SQL: upsert one eval score (used by the runner per row)
-- ============================================

CREATE OR REPLACE FUNCTION singulars.upsert_eval_score(
  p_run_id          uuid,
  p_theme_slug      text,
  p_candidate_won   boolean,
  p_rationale       text,
  p_score           numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id   uuid;
  v_perf uuid;
BEGIN
  SELECT performance_id INTO v_perf FROM singulars.eval_runs WHERE id = p_run_id;
  IF v_perf IS NULL THEN
    RAISE EXCEPTION 'eval_run % not found', p_run_id;
  END IF;

  -- Idempotent within the run: replace any prior score for this (run, theme).
  DELETE FROM singulars.eval_scores
  WHERE eval_run_id = p_run_id AND theme_slug = p_theme_slug;

  INSERT INTO singulars.eval_scores
    (eval_run_id, performance_id, theme_slug, candidate_text,
     candidate_won, judge_rationale, score)
  VALUES
    (p_run_id, v_perf, p_theme_slug, '',
     p_candidate_won, p_rationale, p_score)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


-- ============================================
-- 9. Public read views (for the dashboard chart)
-- ============================================

-- View 1: per-model win rate per performance, ordered by performance date.
CREATE OR REPLACE VIEW singulars.v_model_winrate_per_performance AS
SELECT
  cm.id                AS model_id,
  cm.slug              AS model_slug,
  cm.name              AS model_name,
  cm.color             AS model_color,
  cm.family            AS model_family,
  perf.id              AS performance_id,
  perf.slug            AS performance_slug,
  perf.name            AS performance_name,
  perf.date            AS performance_date,
  r.id                 AS eval_run_id,
  r.judge_model,
  r.n_themes,
  r.win_rate,
  r.mean_rank,
  r.published,
  r.created_at         AS run_created_at
FROM singulars.eval_runs r
JOIN singulars.candidate_models cm ON cm.id = r.candidate_model_id
JOIN singulars.performances     perf ON perf.id = r.performance_id
WHERE r.status = 'completed'
  AND r.id = (
    SELECT r2.id
    FROM singulars.eval_runs r2
    WHERE r2.candidate_model_id = r.candidate_model_id
      AND r2.performance_id     = r.performance_id
      AND r2.status             = 'completed'
    ORDER BY r2.created_at DESC
    LIMIT 1
  )
ORDER BY perf.date ASC, cm.name ASC;

-- View 2: latest run per (model, performance) — admin sees draft + published.
CREATE OR REPLACE VIEW singulars.v_latest_eval_run AS
SELECT DISTINCT ON (r.candidate_model_id, r.performance_id)
  r.id, r.candidate_model_id, r.performance_id,
  r.status, r.judge_model, r.n_themes, r.n_themes_completed,
  r.win_rate, r.mean_rank, r.cost_usd, r.duration_ms,
  r.published, r.error_message, r.created_at, r.finished_at
FROM singulars.eval_runs r
ORDER BY r.candidate_model_id, r.performance_id, r.created_at DESC;


-- ============================================
-- 10. Seed a placeholder ground.exe candidate (idempotent)
-- ============================================

INSERT INTO singulars.candidate_models (name, slug, family, version_label, color, is_public, notes)
VALUES (
  'ground.exe (v0)',
  'ground-exe-v0',
  'open-source-ground',
  'v0',
  '#D97706',
  false,
  'Placeholder for the locally-fine-tuned ground.exe model. Update api_endpoint / hf_repo once weights ship.'
)
ON CONFLICT (slug) DO NOTHING;

-- Frontier benchmarks recommended by research/03 (Shortlist A) — start as private.
INSERT INTO singulars.candidate_models (name, slug, family, version_label, api_endpoint, color, is_public, notes)
VALUES
  ('Claude Opus 4.7',    'claude-opus-4-7',    'claude',   '4.7',  'anthropic:messages:claude-opus-4-7',     '#C77B6B', false, 'Frontier benchmark — EQ-Bench champion'),
  ('Gemini 3.1 Pro',     'gemini-3-1-pro',     'gemini',   '3.1',  'openrouter:google/gemini-3.1-pro',       '#4285F4', false, 'Frontier benchmark — LMArena CW champion'),
  ('DeepSeek R1',        'deepseek-r1',        'deepseek', 'r1',   'openrouter:deepseek/deepseek-r1',        '#5E548E', false, 'Open-source spoiler — EQ-Bench anchor')
ON CONFLICT (slug) DO NOTHING;


-- ============================================
-- 11. Sanity comments
-- ============================================
COMMENT ON TABLE singulars.candidate_models IS 'Models entered into the Singulars eval (frontier benchmarks + ground.exe versions).';
COMMENT ON TABLE singulars.eval_runs        IS 'One row per (model x performance x re-run). Status machine: pending -> running -> completed/failed.';
COMMENT ON TABLE singulars.eval_scores      IS 'Per-tuple judge verdict; idempotent on (run, theme).';
COMMENT ON VIEW  singulars.v_model_winrate_per_performance IS 'Public chart source — only the latest completed run per (model, performance), gated by RLS-applicable published flag at the eval_runs level.';
COMMENT ON VIEW  singulars.v_latest_eval_run               IS 'Admin preview — latest run including drafts; service-role read only.';

-- END OF MIGRATION
