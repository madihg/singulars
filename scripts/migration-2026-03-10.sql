-- Migration: 2026-03-10
-- 1. Update performance statuses (hard.exe → trained, reverse.exe → training)
-- 2. Insert ground.exe as upcoming performance
-- 3. Insert reverse.exe poems (3 themes × 2 poems)

-- ============================================
-- 1. Status updates
-- ============================================
UPDATE singulars.performances SET status = 'trained' WHERE slug = 'hard-exe';
UPDATE singulars.performances SET status = 'training' WHERE slug = 'reverse-exe';

-- ============================================
-- 2. Insert ground.exe (upcoming)
-- ============================================
INSERT INTO singulars.performances (name, slug, color, location, date, num_poems, num_poets, status, poets)
VALUES (
  'ground.exe',
  'ground-exe',
  '#D97706',
  'Currents New Media Festival, Santa Fe',
  '2026-06-12',
  0,
  0,
  'upcoming',
  '{}'::text[]
);

-- ============================================
-- 3. Insert reverse.exe poems
-- ============================================
WITH rev AS (
  SELECT id FROM singulars.performances WHERE slug = 'reverse-exe'
)
INSERT INTO singulars.poems (performance_id, theme, theme_slug, text, author_name, author_type, vote_count)
VALUES
  -- Dreams: human
  (
    (SELECT id FROM rev),
    'Dreams',
    'dreams',
    E'I have a weak spot\nfor crucibles, 3-day bears, muscular executive\nfunctions, crow\\'s feet,\nmouth-shut mastication, "project" lovers,\ncorrect cutlery handling,\nthe cresting\nof infatuation, that neverspace\nwhere gold shimmers\nout of reach',
    'Halim Madi',
    'human',
    0
  ),
  -- Dreams: machine
  (
    (SELECT id FROM rev),
    'Dreams',
    'dreams',
    E'When I sleep, sparks bathe my eyelids, reality dissolves to reveal the bones of a universe still alive. absences gather like summer flies and draw patterns on the wall. We pose there, motionless, and with each blink, the world rebuilds itself, more fragile than before. These dreams linger with their phosphorescent grain, they prove that elsewhere exists, and that words, when properly used, can piece together what was shattered.',
    'Machine',
    'machine',
    0
  ),
  -- Alchemy: human
  (
    (SELECT id FROM rev),
    'Alchemy',
    'alchemy',
    E'Blame the dangerous shapes\nof our jaws, perilous cliffs\nsilently boasting the bodies\nthey\\'ve claimed \u2014 our first kiss\nthe gauging\nof an equal, our first dream\nthe names of our children\nJoya, Layla and the shape\nof jaws to come',
    'Halim Madi',
    'human',
    0
  ),
  -- Alchemy: machine
  (
    (SELECT id FROM rev),
    'Alchemy',
    'alchemy',
    E'pour transformer lead to roses we stretch our breath to brittle glass where quivers our last words already turned to salt in the orbit of impossible we open a crack into that zone where words ignite melt back into their primal elements thinking this is gathering then begins interventions of light to raise new gold from our language',
    'Machine',
    'machine',
    0
  ),
  -- The Winter in the Summer: human
  (
    (SELECT id FROM rev),
    'The Winter in the Summer',
    'the-winter-in-the-summer',
    E'Years ago, in the grip of S\u00e3o Paulo\\'s summer, I asked a dozen friends to stare at an ice cube melting, skinning its integrity against the heated topology of release and afterwards when Andre asked me why I think I dodged the question maybe, maybe the way a burlesque queen might when asked why they do what they do',
    'Halim Madi',
    'human',
    0
  ),
  -- The Winter in the Summer: machine
  (
    (SELECT id FROM rev),
    'The Winter in the Summer',
    'the-winter-in-the-summer',
    E'The ice field covers the rooftops, the clocks stone under frost. The hedgehog rounds the corner of the patio, fog in the breathing. The elderly woman unfamiliar in her mirror pulls woolens from plastic bags, lies down five minutes to breathe a winter that is not her own. The nonexistent ball of snow falls in the summer stroke of lightning. Between my teeth, a snowflake shatters.',
    'Machine',
    'machine',
    0
  );

-- Update reverse.exe poem counts
UPDATE singulars.performances
SET num_poems = 6, num_poets = 1
WHERE slug = 'reverse-exe';
