/**
 * Audience-derived classifiers (Phase 3, 2026-05-08).
 *
 * The eval judge's rubric. Extracted from 37 (winner, loser) pairs across
 * carnation+versus+reinforcement+hard+reverse via scripts/extract-classifiers.ts
 * (Claude Opus 4.7 reading every pair and reverse-engineering what
 * distinguishes audience-chosen from audience-rejected poems).
 *
 * These are the audience's taste, codified - NOT the LLM's poetic
 * preferences. The judge uses them to score candidates on a 0-5 scale per
 * classifier, weighted by `weight`. Total score = (sum of weighted scores) /
 * (max possible) ∈ [0, 1].
 *
 * Versioned: when a future re-extraction (e.g. after ground.exe) changes the
 * set, bump `ACTIVE_CLASSIFIERS_VERSION` and add the new artifact alongside.
 * Old eval runs reference whatever version was active at their time.
 */

export type ClassifierExemplar = {
  excerpt: string;
  perf: string;
  theme: string;
};

export type Classifier = {
  id: string;
  name: string;
  definition: string;
  winner_pole: string;
  loser_pole: string;
  winner_exemplars: ClassifierExemplar[];
  loser_exemplars: ClassifierExemplar[];
  /** 1-3 - how strongly this dimension separates winners from losers in the data */
  weight: number;
};

export type ClassifierSet = {
  version: string;
  extracted_at: string;
  source: string;
  n_pairs_analyzed: number;
  summary: string;
  classifiers: Classifier[];
};

export const ACTIVE_CLASSIFIERS_VERSION = "v1-2026-05-08";

export const ACTIVE_CLASSIFIERS: ClassifierSet = {
  version: "v1-2026-05-08",
  extracted_at: "2026-05-08",
  source:
    "37 audience-decided (winner, loser) pairs from carnation+versus+reinforcement+hard+reverse, analyzed by Claude Opus 4.7",
  n_pairs_analyzed: 37,
  summary:
    "The audience reliably rewards poems that feel like a specific person speaking from a specific moment - anchored in named places, named people, concrete objects, and tactile bodily detail - over poems that drift through abstract, surreal, or decorative imagery. Winners tend to deliver an emotional payoff or a clear turn (a punchline, a confession, a reaching-out), often with a self-aware or conversational tone, while losers pile on ornate metaphors and free-floating abstractions without earning a moment of recognition. The room favors warmth, narrative grounding, and syntactic clarity (even when fragmented) over lexical pyrotechnics, neologism, and surreal collage. When a poem mentions David, Beirut, Cartagena, a roommate cutting nails, or a father's Jaguar, it tends to win; when it leans on 'particles,' 'phosphorescent grain,' 'electrostatic sparks,' or 'unpronounceable signs,' it tends to lose.",
  classifiers: [
    {
      id: "C1",
      name: "Concrete specificity vs abstract collage",
      definition:
        "Whether the poem anchors itself in named, identifiable particulars (places, people, objects, dates) or floats in generic abstractions and decorative imagery.",
      winner_pole:
        "Winners name specific people, cities, brands, or moments (David, Beirut, Cartagena, a Renault 12) that locate the poem in a recognizable world.",
      loser_pole:
        "Losers use unspecified nouns and stock-poetic abstractions ('particles,' 'shadows,' 'fragments,' 'web') that could belong to any poem.",
      winner_exemplars: [
        {
          excerpt:
            "this one time in a fish restaurant near Cartagena, or maybe this was Lisbon, David held the menu up",
          perf: "reinforcement-exe",
          theme: "Oysters",
        },
        {
          excerpt:
            "the summer in Beirut we trojan horsed every club floor we arsoned - your dad's white Mercedes",
          perf: "reinforcement-exe",
          theme: "Open Air Backseat",
        },
      ],
      loser_exemplars: [
        {
          excerpt:
            "Particles ligaments of absence I arrive, there, absence 1.12 AM particles dance but do not touch",
          perf: "hard-exe",
          theme: "Particles",
        },
        {
          excerpt:
            "An epidermic advance of lactic facts, streets painted with gestures whose magnitude is measured by cracks",
          perf: "reinforcement-exe",
          theme: "Crime",
        },
      ],
      weight: 3,
    },
    {
      id: "C2",
      name: "Emotional landing vs ornamental drift",
      definition:
        "Whether the poem builds toward a recognizable emotional beat (tenderness, grief, longing, humor) or sustains decorative imagery without delivering a felt payoff.",
      winner_pole:
        "Winners arrive at an unmistakable emotional moment - a confession, a missing-you, a shared joy - that the audience can feel land.",
      loser_pole:
        "Losers maintain a uniform decorative texture where no single line is meant to break the heart or the room.",
      winner_exemplars: [
        {
          excerpt: "every time I smell jasmin all I think about is you",
          perf: "reinforcement-exe",
          theme: "Memories",
        },
        {
          excerpt:
            "6 mollusks can make a friend's day and I think I gave him one of mine and so that's 7 in total",
          perf: "reinforcement-exe",
          theme: "Oysters",
        },
      ],
      loser_exemplars: [
        {
          excerpt:
            "Light pixel-grid patterns ripple across the gallery walls, sculpted air breathing wire and vibration",
          perf: "versus-exe",
          theme: "The Intersection of Art and Technology",
        },
        {
          excerpt:
            "a fractured glass, light so hard it breaks itself. We carry these shining shards-each word a caress on glass",
          perf: "versus-exe",
          theme: "Memory",
        },
      ],
      weight: 3,
    },
    {
      id: "C3",
      name: "Coherent syntax vs fragmented surrealism",
      definition:
        "Whether sentences track a clear thought or unspool as disjoint surreal phrases, neologisms, and broken grammar.",
      winner_pole:
        "Winners use sentences (even long or fragmented ones) whose logic the listener can follow in real time.",
      loser_pole:
        "Losers stack non-sequiturs, garbled words, and surreal mashups ('fungal seiner,' 'imam climbs over the streaks of straw,' 'AEiasis') that resist parsing.",
      winner_exemplars: [
        {
          excerpt:
            "We agree: Moving forward we'll only say 'I love you' when we know what we mean",
          perf: "hard-exe",
          theme: "Diegetic",
        },
        {
          excerpt:
            "Even the observation that it's hard to speak of death without becoming trite, risks becoming trite",
          perf: "versus-exe",
          theme: "Death",
        },
      ],
      loser_exemplars: [
        {
          excerpt:
            "fungal seiner the sole touches imam climbs over the streaks of straw intlights its rhythm",
          perf: "reinforcement-exe",
          theme: "Touch Grass",
        },
        {
          excerpt:
            "Embalmed hours in jar-shaped fingerless gloves, faceted to dissolve perceptibly",
          perf: "reinforcement-exe",
          theme: "Death",
        },
      ],
      weight: 3,
    },
    {
      id: "C4",
      name: "Story or scene vs static tableau",
      definition:
        "Whether the poem unfolds a small narrative or remembered scene with movement and consequence, or remains a still-life of images.",
      winner_pole:
        "Winners often tell a micro-story with a turn - a date, a parent's proposal, a friend's gap-toothed smile - that progresses in time.",
      loser_pole:
        "Losers describe a scene or condition without progression, accumulating images that don't move toward anything.",
      winner_exemplars: [
        {
          excerpt:
            "my father proposing to my mother while bombs undressed the capital down to rubble made him trade a burgundy Jaguar for an olive green Renault 12",
          perf: "reverse-exe",
          theme: "Tinder",
        },
        {
          excerpt:
            "He asked why I wore sunglasses on my head even in the middle of winter. This was our 4th or 5th date",
          perf: "hard-exe",
          theme: "Sun",
        },
      ],
      loser_exemplars: [
        {
          excerpt:
            "In the room without walls void where whispers hold their breath solitude unfurls like a second skin",
          perf: "carnation-exe",
          theme: "Solitude",
        },
        {
          excerpt:
            "The oysters count within their shells unceasing patterns of abandonment Each wave marks another layer",
          perf: "reinforcement-exe",
          theme: "Oysters",
        },
      ],
      weight: 2,
    },
    {
      id: "C5",
      name: "Voice and self-awareness vs anonymous lyric",
      definition:
        "Whether a distinct speaker with attitude, humor, or meta-awareness is present, or the poem reads as anonymous generic lyric.",
      winner_pole:
        "Winners have a recognizable speaking voice - wry, self-deprecating, conversational, sometimes meta about poetry itself.",
      loser_pole:
        "Losers speak in an interchangeable lyrical register with no personality or stance behind the words.",
      winner_exemplars: [
        {
          excerpt:
            "A litote is not a poem - a litote is a figure of speech used by ChatGPT in a million and n generations",
          perf: "versus-exe",
          theme: "Moral Responsibility",
        },
        {
          excerpt:
            "In the dusk of the mattress firm website you can toggle a size greater than California king",
          perf: "versus-exe",
          theme: "Solitude II",
        },
      ],
      loser_exemplars: [
        {
          excerpt:
            "Memories are currents; I swim without knowing which way they go out to sea",
          perf: "reinforcement-exe",
          theme: "Memories",
        },
        {
          excerpt:
            "When I sleep, sparks bathe my eyelids, reality dissolves to reveal the bones of a universe still alive",
          perf: "reverse-exe",
          theme: "Dreams",
        },
      ],
      weight: 2,
    },
    {
      id: "C6",
      name: "Embodied sensory detail vs cerebral abstraction",
      definition:
        "Whether imagery is rooted in body and senses (smell, touch, taste, breath) or in conceptual/technological abstraction.",
      winner_pole:
        "Winners trade in skin, breath, jasmine, knuckles, hair, fingernails - sensations the body recognizes.",
      loser_pole:
        "Losers reach for technological, cosmic, or theoretical vocabulary (pixels, frequencies, hypertext, molecules) that stays in the head.",
      winner_exemplars: [
        {
          excerpt: "his knuckles soon burrowing in my cheek searching for surrender",
          perf: "reinforcement-exe",
          theme: "Desire",
        },
        {
          excerpt: "washes my hair, cuts my nails cooks our food",
          perf: "carnation-exe",
          theme: "Solitude",
        },
      ],
      loser_exemplars: [
        {
          excerpt:
            "this_Hertz vibration of blood particles & particles collision electric spark without charge",
          perf: "hard-exe",
          theme: "Particles",
        },
        {
          excerpt:
            "Between source and screen, an abyss narrows, while hypertext flowers burst on the tongue's humid jungle",
          perf: "versus-exe",
          theme: "The Intersection of Art and Technology",
        },
      ],
      weight: 2,
    },
    {
      id: "C7",
      name: "Earned metaphor vs metaphor pile-up",
      definition:
        "Whether the poem develops one or two metaphors with care, or stacks many disconnected metaphors per line.",
      winner_pole:
        "Winners extend a single image (a mirror at a dying mouth, a roommate as self) long enough for the audience to inhabit it.",
      loser_pole:
        "Losers pivot metaphors every clause, mixing registers so quickly that no image gets to breathe or mean.",
      winner_exemplars: [
        {
          excerpt:
            "I'd hold a mirror close to his mouth so his last breath fogs the glass scores his lungs' last dance",
          perf: "reinforcement-exe",
          theme: "Death",
        },
        {
          excerpt:
            "if a relationship falls in a forest and the parties involved fail to grieve it together, does it make a sound",
          perf: "versus-exe",
          theme: "Memory",
        },
      ],
      loser_exemplars: [
        {
          excerpt:
            "Death is the thyme in the refrigerator, the bold cork that won't pop, the back tonne of old weighing scales",
          perf: "reinforcement-exe",
          theme: "Death",
        },
        {
          excerpt:
            "Money speaks in a little voice metallic, metronome, minimalist... Paltry petrodollars leaked relief to Caribbean basins",
          perf: "reinforcement-exe",
          theme: "Currency",
        },
      ],
      weight: 2,
    },
  ],
};

/**
 * Total weight (sum across classifiers). With 0-5 per classifier, the maximum
 * raw score is 5 * sum(weights). Total normalized score = raw / max ∈ [0, 1].
 */
export const CLASSIFIER_MAX_RAW_SCORE =
  ACTIVE_CLASSIFIERS.classifiers.reduce(
    (s, c) => s + c.weight * 5,
    0,
  );

/**
 * Compute normalized 0-1 score from per-classifier scores.
 * Missing classifier scores are skipped (if a judge fails on one classifier,
 * we don't penalize the candidate for that judge's failure).
 */
export function computeClassifierScore(
  perClassifier: Record<string, number>,
): number {
  let raw = 0;
  let max = 0;
  for (const c of ACTIVE_CLASSIFIERS.classifiers) {
    const s = perClassifier[c.id];
    if (typeof s !== "number" || !Number.isFinite(s)) continue;
    raw += Math.max(0, Math.min(5, s)) * c.weight;
    max += 5 * c.weight;
  }
  return max > 0 ? raw / max : 0;
}

/**
 * The classifier rubric block for the judge prompt. Includes definitions,
 * pole anchors, and exemplars. Verbose by design - judges should have plenty
 * of grounding to score consistently.
 */
export function classifiersBlockForJudge(): string {
  return ACTIVE_CLASSIFIERS.classifiers
    .map((c) => {
      const winnerEx = c.winner_exemplars
        .map((e) => `      WINNER (${e.perf} / ${e.theme}): "${e.excerpt}"`)
        .join("\n");
      const loserEx = c.loser_exemplars
        .map((e) => `      LOSER  (${e.perf} / ${e.theme}): "${e.excerpt}"`)
        .join("\n");
      return [
        `${c.id} - ${c.name} (weight ${c.weight}/3)`,
        `  Definition: ${c.definition}`,
        `  Winner pole (5): ${c.winner_pole}`,
        `  Loser pole (0):  ${c.loser_pole}`,
        `  Exemplars:\n${winnerEx}\n${loserEx}`,
      ].join("\n");
    })
    .join("\n\n");
}
