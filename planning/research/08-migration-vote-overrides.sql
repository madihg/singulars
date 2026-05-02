-- ============================================================================
-- Singulars Vote-Override Audit Table (US §9.4 resolution)
-- ----------------------------------------------------------------------------
-- File:    08-migration-vote-overrides.sql
-- Date:    2026-05-02
-- Purpose: Add poem_vote_overrides table + apply_vote_override RPC so admin
--          paper-ballot entries are auditable AND coexist with live online
--          voting (cast_vote stays unchanged).
--
-- Design:  ADDITIVE ONLY. Idempotent. Does not modify performances/poems/votes
--          rows. cast_vote (scripts/schema.sql:119) remains untouched - the
--          invariant holds because each online vote increments both COUNT(votes)
--          AND poems.vote_count by 1, while the latest manual_delta is unchanged.
--
-- Rollback (manual):
--   DROP FUNCTION IF EXISTS singulars.apply_vote_override(uuid, int, text, text);
--   DROP TABLE IF EXISTS singulars.poem_vote_overrides CASCADE;
-- ============================================================================

-- 1. Table
CREATE TABLE IF NOT EXISTS singulars.poem_vote_overrides (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poem_id                     uuid NOT NULL REFERENCES singulars.poems(id) ON DELETE CASCADE,
  online_count_at_override    integer NOT NULL,
  manual_delta                integer NOT NULL,
  new_total                   integer GENERATED ALWAYS AS (online_count_at_override + manual_delta) STORED,
  reason                      text,
  by                          text,
  supercedes                  uuid REFERENCES singulars.poem_vote_overrides(id),
  active                      boolean NOT NULL DEFAULT true,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pvo_poem_active_recent
  ON singulars.poem_vote_overrides (poem_id, created_at DESC)
  WHERE active;

ALTER TABLE singulars.poem_vote_overrides ENABLE ROW LEVEL SECURITY;
-- Service-role bypasses RLS; anon/authenticated denied by default (no policies).

COMMENT ON TABLE singulars.poem_vote_overrides IS
  'Auditable manual paper-ballot entries. Replace-style: only the latest active row per poem is in effect. cast_vote does not touch this table.';

-- 2. RPC: atomic snapshot + supercede + insert + cache update
CREATE OR REPLACE FUNCTION singulars.apply_vote_override(
  p_poem_id   uuid,
  p_new_total integer,
  p_reason    text,
  p_by        text
)
RETURNS singulars.poem_vote_overrides
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_online integer;
  v_prev   uuid;
  v_row    singulars.poem_vote_overrides;
BEGIN
  SELECT COUNT(*) INTO v_online FROM singulars.votes WHERE poem_id = p_poem_id;

  -- Supercede prior active overrides for this poem.
  UPDATE singulars.poem_vote_overrides
    SET active = false
    WHERE poem_id = p_poem_id AND active
    RETURNING id INTO v_prev;

  INSERT INTO singulars.poem_vote_overrides
    (poem_id, online_count_at_override, manual_delta, reason, by, supercedes)
  VALUES
    (p_poem_id, v_online, p_new_total - v_online, p_reason, p_by, v_prev)
  RETURNING * INTO v_row;

  -- Sync the denormalised cache.
  UPDATE singulars.poems SET vote_count = p_new_total WHERE id = p_poem_id;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION singulars.apply_vote_override IS
  'Atomic paper-ballot override. Snapshots COUNT(votes), supercedes prior active overrides, inserts a new active row, syncs poems.vote_count. cast_vote remains unchanged - its (votes++ + vote_count+=1) invariant holds because the latest manual_delta is unaffected by online votes.';

-- 3. Helper: latest active manual_delta per poem (used by sync-tallies route)
CREATE OR REPLACE FUNCTION singulars.latest_override_delta(p_poem_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT manual_delta FROM singulars.poem_vote_overrides
      WHERE poem_id = p_poem_id AND active
      ORDER BY created_at DESC LIMIT 1),
    0
  );
$$;

-- END OF MIGRATION
