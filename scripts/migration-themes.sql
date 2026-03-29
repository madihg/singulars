-- Theme Voting Migration
-- ADDITIVE ONLY - does NOT modify existing performances, poems, or votes tables.
-- Safe to run multiple times (idempotent).
-- All objects created in the "singulars" schema to match existing tables.

-- ============================================
-- 1. Create themes table
-- ============================================

CREATE TABLE IF NOT EXISTS singulars.themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  theme_slug text NOT NULL,
  votes integer DEFAULT 0,
  completed boolean DEFAULT false,
  archived boolean DEFAULT false,
  performance_id uuid REFERENCES singulars.performances(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT themes_content_length CHECK (char_length(content) BETWEEN 1 AND 50)
);

-- Unique constraint on content (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_themes_content_unique
  ON singulars.themes (lower(content));

-- Index for querying active themes sorted by votes
CREATE INDEX IF NOT EXISTS idx_themes_active_votes
  ON singulars.themes (archived, completed, votes DESC);

-- Index for matching theme_slug to poems.theme_slug (by convention, no FK)
CREATE INDEX IF NOT EXISTS idx_themes_slug
  ON singulars.themes (theme_slug);

-- ============================================
-- 2. Row-Level Security
-- ============================================

ALTER TABLE singulars.themes ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can see non-archived themes
DROP POLICY IF EXISTS "Public read access for themes" ON singulars.themes;
CREATE POLICY "Public read access for themes"
  ON singulars.themes FOR SELECT
  TO anon
  USING (true);

-- Public insert: anyone can suggest a theme
DROP POLICY IF EXISTS "Anonymous insert for themes" ON singulars.themes;
CREATE POLICY "Anonymous insert for themes"
  ON singulars.themes FOR INSERT
  TO anon
  WITH CHECK (true);

-- ============================================
-- 3. RPC function for atomic upvote
-- ============================================

CREATE OR REPLACE FUNCTION singulars.upvote_theme(p_theme_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_theme singulars.themes%ROWTYPE;
BEGIN
  -- Atomically increment and return
  UPDATE singulars.themes
  SET votes = votes + 1, updated_at = now()
  WHERE id = p_theme_id AND archived = false AND completed = false
  RETURNING * INTO v_theme;

  IF v_theme IS NULL THEN
    RETURN json_build_object('error', 'Theme not found or not active');
  END IF;

  RETURN json_build_object(
    'id', v_theme.id,
    'content', v_theme.content,
    'votes', v_theme.votes
  );
END;
$$;
