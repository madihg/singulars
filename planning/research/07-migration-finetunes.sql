-- ============================================================================
-- Singulars Fine-Tune Jobs Migration (US-122)
-- ----------------------------------------------------------------------------
-- File:    07-migration-finetunes.sql
-- Date:    2026-05-01
-- Purpose: Add fine_tune_jobs table that tracks every fine-tune kicked off
--          from the admin, plus enums and indexes for webhook processing.
--
-- Design:  ADDITIVE ONLY. Idempotent. Safe to re-run. Does not modify the
--          existing eval_runs / candidate_models tables (only adds an FK
--          target reference back into candidate_models for auto-registration).
--
-- Rollback (manual):
--   DROP TABLE IF EXISTS singulars.fine_tune_jobs CASCADE;
--   DROP TYPE  IF EXISTS singulars.finetune_status;
--   DROP TYPE  IF EXISTS singulars.finetune_format;
--   DROP TYPE  IF EXISTS singulars.finetune_provider;
-- ============================================================================

-- 1. Enums

DO $$ BEGIN
  CREATE TYPE singulars.finetune_provider AS ENUM (
    'openai', 'together', 'huggingface', 'replicate', 'modal', 'other'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE singulars.finetune_format AS ENUM ('sft', 'dpo');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE singulars.finetune_status AS ENUM (
    'queued', 'validating', 'running', 'succeeded', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. fine_tune_jobs

CREATE TABLE IF NOT EXISTS singulars.fine_tune_jobs (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider                      singulars.finetune_provider NOT NULL,
  base_model                    text NOT NULL,
  training_format               singulars.finetune_format NOT NULL,
  system_prompt                 text NOT NULL,
  source_performance_ids        uuid[] NOT NULL,
  holdout_performance_ids       uuid[] NOT NULL DEFAULT '{}',
  n_training_rows               integer,
  hyperparameters               jsonb,
  provider_job_id               text,
  provider_file_id              text,
  status                        singulars.finetune_status NOT NULL DEFAULT 'queued',
  output_model_id               text,
  auto_registered_candidate_id  uuid REFERENCES singulars.candidate_models(id) ON DELETE SET NULL,
  cost_usd                      numeric(10, 4),
  started_at                    timestamptz,
  finished_at                   timestamptz,
  duration_ms                   integer,
  error_message                 text,
  triggered_by_user             text,
  training_data_snapshot        jsonb,
  created_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fine_tune_jobs_provider_status
  ON singulars.fine_tune_jobs (provider, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fine_tune_jobs_provider_job_id
  ON singulars.fine_tune_jobs (provider_job_id)
  WHERE provider_job_id IS NOT NULL;

-- 3. RLS - admin-only via service role; no anon access.
ALTER TABLE singulars.fine_tune_jobs ENABLE ROW LEVEL SECURITY;
-- (no SELECT / INSERT / UPDATE policies for anon = anon cannot read or write)

COMMENT ON TABLE singulars.fine_tune_jobs IS
  'Provider-side fine-tune jobs. Webhook-driven status updates. Auto-registers a candidate_models row on success.';

-- END OF MIGRATION
