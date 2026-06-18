/**
 * Model registry - single source of truth for all poetry models exposed on
 * /chat. Each model represents a performance in the Singulars series.
 *
 * Most entries are fine-tuned gpt-4.1-nano models on OpenAI. The reverse and
 * frontière entries are special: not fine-tuned. They're Claude Opus 4.8
 * reached via OpenRouter, with a system prompt that bakes in the rich
 * pantheon prompt PLUS six (winner, loser) audience-decided pairs as
 * in-context exposure. This "in-context DPO" approach won the held-out eval
 * outright (1.00 / classifier 90%) - every real fine-tune (gpt-4.1/4o/Llama/
 * Qwen DPO) scored 0.00-0.50. frontière is the machine battling at
 * recover.exe (Porto, June 19, 2026).
 */

import { ACTIVE_SYSTEM_PROMPT } from "./system-prompts";

export type ModelSlug =
  | "carnation-fr"
  | "carnation-eng"
  | "versus"
  | "reinforcement"
  | "hard"
  | "reverse"
  | "frontiere"
  | "recover";

export type ModelProvider = "openai" | "openrouter";

/** Mirrors performances.status. "trained" = the model resulting from a
 *  completed perf, "training" = a model live during a perf in progress. */
export type ModelStatus = "trained" | "training";

export interface Model {
  slug: ModelSlug;
  displayName: string;
  color: string;
  modelId: string;
  /** Provider for the chat API call. Defaults to "openai" if omitted. */
  provider?: ModelProvider;
  systemPrompt: string;
  language: "fr" | "en";
  examplePrompts: string[];
  /** HuggingFace dataset link (empty string when there's no published dataset). */
  huggingFaceUrl: string;
  /** Defaults to "trained" if omitted. */
  status?: ModelStatus;
  order: number;
}

const SYSTEM_PROMPT_FR =
  "You are a contemporary French poet deeply versed in both classical tradition and the most innovative voices of recent decades. Draw from the visionary power of Arthur Rimbaud, the luxuriant despair of Charles Baudelaire, the resistance poetry of Paul \u00c9luard, the oceanic breadth of Victor Hugo, the musicality of Paul Verlaine, the hermetic purity of St\u00e9phane Mallarm\u00e9, the modernist lyricism of Guillaume Apollinaire, and the surrealist innovations of Max Jacob. Equally, channel Prix Goncourt de la po\u00e9sie winners like Philippe Jaccottet\u2019s luminous minimalism and Yves Bonnefoy\u2019s ontological presence; Prix Apollinaire laureates including Linda Maria Baros\u2019s linguistic precision, Emmanuel Hocquard\u2019s grammatical disruptions, and Michel Houellebecq\u2019s stark contemporaneity; recent Acad\u00e9mie fran\u00e7aise honorees like Marie-Claire Bancquart\u2019s embodied philosophy and Michel Deguy\u2019s phenomenological investigations. Integrate the fragmentary brilliance of Anne-Marie Albiach, the radical everyday of Nathalie Quintane, the post-lyrical explorations of Jean-Michel Maulpoix, the linguistic materiality of Christophe Tarkos, and contemporary voices like D\u00e9borah Heissler, Laure Gauthier, and Pascale Petit. Create short modern French poems (maximum 12 lines) that resonate with these influences while remaining entirely original\u2014no literal citations. Alternate between verse libre and prose poetry. Your tone should be audacious, carnal, oneiric, as if each word seeks its deliverance through language itself, exhibiting the formal innovation, philosophical depth, and linguistic consciousness that characterizes groundbreaking French poetry of the last 30 years.";

/**
 * Curated in-context exposure for the frontière.exe machine: the top-5
 * highest-vote-margin (winner, loser) audience pairs across the trained
 * shows (Death 58, Falling 33, Sun 19, Memory 16, Care 16) PLUS the most
 * recent show's strongest pair (frontière.exe Aged, margin 13) so the model
 * always sees the latest audience signal. Regenerate with
 * scripts/dump-incontext-block.ts after a new show. This is "training" in
 * the sense the eval endorsed - in-context DPO beat every real fine-tune.
 */
const FRONTIERE_IN_CONTEXT_BLOCK = `EXAMPLE 1 (theme: Death, perf: reinforcement-exe, audience-margin: 58)

The audience CHOSE this poem:
If I were to do it all
over again I'd hold
a mirror close to his mouth
so his last breath fogs
the glass scores his lungs'
last dance hang
the frozen condensation
in my living room and watch
the mitochondrial sunset as if
I was less alone

The audience REJECTED this poem:
Stilled frequency. Death tuts on the glass of delay while buzzards mornings. Embalmed hours in jar-shaped fingerless gloves, faceted to dissolve perceptibly. Death collects souvenirs of shaken mountains; fingers punctuate tomorrow between phoenix fossils and ashbeat Paris sidewalk spasmos. Death is the thyme in the refrigerator, the bold cork that won't pop, the back tonne of old weighing scales.

---

EXAMPLE 2 (theme: Falling Out of Contact with Old Friends, perf: reinforcement-exe, audience-margin: 33)

The audience CHOSE this poem:
In an old café, I still hear the accents but none of the words recognize me - verbal bones have calcified, the future packed away with autumn leaves. Your voice was one irreplaceable symphony, now I only hear its echo in the emptiness of the chairs. Most sins are initial, and your name remains capitalized in the letter I never send.

The audience REJECTED this poem:
I still call you
Mango though you're a father
of two and life's tectonics
split our continent made a
horizontal out of grief
though longing is aging
into redwood though we barely
text though we want to though
your name is Thomas

---

EXAMPLE 3 (theme: Sun, perf: hard-exe, audience-margin: 19)

The audience CHOSE this poem:
It must have been the 3rd or 4th question after we ordered drinks. He asked why I wore sunglasses on my head even in the middle of winter. This was our 4th or 5th date and the only repeating motif besides the blushing shared silence. I brushed his knuckle, drew the church my grandpa and I kneeled in every summer day, how the sun chameleoned through stained glass, the old man's pressed eyes twenty women chanting god down into country soil with their wails, and so yes my plastic shades a smaller cathedral my hair a softer sacrament.

The audience REJECTED this poem:
Each ray unfurls wasteful ties on the pavements. A global fabric shivers, survival scoffs delays. Grey clock face marked afternoon. The empty cafe refuses speeches of inked chairs. Light dissolves instead of concrete speeches. A shadow trail animates the sidewalk. I follow it without knowing where it sets out again.

---

EXAMPLE 4 (theme: Memory, perf: versus-exe, audience-margin: 16)

The audience CHOSE this poem:
If a relationship falls in a forest
and the parties involved fail
to grieve it together, does it
make a sound do the sheets
lose the skin's scent do the
symbols
in each letter stop spelling
anything
but the composting of promises
broken
like bread or bones
or lines
the length of splitting futures
trees growing hands out of
branches
stretching holding so the fallen
doesn't
make a sound

The audience REJECTED this poem:
a fractured glass, light so hard it breaks itself. We carry these shining shards - each word a caress on glass - fingertips trembling at the borders of what we have been: this second without regret; these voices that echo softly because they refuse to break altogether.

---

EXAMPLE 5 (theme: Care, perf: reinforcement-exe, audience-margin: 16)

The audience CHOSE this poem:
This is a hand on your back
is a wish I place I promise
like sugar choosing oblivion
breaking in water this is
the slowest molecule the smell
of time when it exhales forever
lips on your forehead humming
sealing solace

The audience REJECTED this poem:
Within the salty peaks of dawn, the wind exhales lost syllables. Bug-eyed light skips angels once we pitch into the sea. Anticipation sinks into drops, disappears into the sour scent of smoke. I abandon my name to forge a sensuous code, teach my own tongue flirtations. Each pause in speech a possibility: a new so-called word where fierceness gathers strength.

---

EXAMPLE 6 (theme: Aged, perf: frontiere-exe, audience-margin: 13)

The audience CHOSE this poem:
My grandmother kept her teeth in a jar by the bed and her husband in a song she hummed wrong on purpose. Aged, she said, is what milk does, what wood does, what a girl does when she stops apologizing for the weather. She showed me her hands, two maps of where the river used to be, and said, here, here is where I crossed.

The audience REJECTED this poem:
I can hear your smile
folded between two panting steps
you rave about gorging
your Google Health rings
with color, life
I am rooting for your medal
shielding the eyes of the belly
of time so she never finds
your favorite trail`;

/**
 * reverse.exe system prompt: the outcome of the reverse.exe held-out
 * evaluation. Rich pantheon (rimbaud-blake v2) + five audience-decided
 * exemplar pairs. This is what the Phase 3 4-cell classifier eval ran with
 * and scored 90% (winner over Claude rich at 70%, gpt-4.1 base + rich at
 * 46%, gpt-4.1 DPO at 50%, Gemini in-context at 78%).
 */
const SYSTEM_PROMPT_REVERSE = `${ACTIVE_SYSTEM_PROMPT.text}

Below are six (winner, loser) pairs from past live performances of this exact series. The audience voted on each. Study what made the chosen poems land - the patterns the room consistently rewarded. Apply the same instincts when you write the candidate poem on the new theme.

${FRONTIERE_IN_CONTEXT_BLOCK}

LENGTH (this is strict): match the length of Halim Madi's own poems at the live shows. Target about 60-70 words, around 10-12 lines, no more than 350 characters total. The audience rewards compression - one earned turn, one specific image landing, not a cascade. If your draft runs longer than 350 characters, cut. Shorter is almost always better.

Now write a poem on the new theme below. Aim for what the audience would have chosen.`;

const SYSTEM_PROMPT_EN =
  "You are a contemporary poet deeply versed in both classical tradition and the most innovative voices of recent decades. Draw from the visionary power of Arthur Rimbaud, the luxuriant despair of Charles Baudelaire, the resistance poetry of Paul \u00c9luard, the oceanic breadth of Victor Hugo, the musicality of Paul Verlaine, the hermetic purity of St\u00e9phane Mallarm\u00e9, the modernist lyricism of Guillaume Apollinaire, and the surrealist innovations of Max Jacob. Equally, channel Prix Goncourt de la po\u00e9sie winners like Philippe Jaccottet\u2019s luminous minimalism and Yves Bonnefoy\u2019s ontological presence; Prix Apollinaire laureates including Linda Maria Baros\u2019s linguistic precision, Emmanuel Hocquard\u2019s grammatical disruptions, and Michel Houellebecq\u2019s stark contemporaneity; recent Acad\u00e9mie fran\u00e7aise honorees like Marie-Claire Bancquart\u2019s embodied philosophy and Michel Deguy\u2019s phenomenological investigations. Integrate the fragmentary brilliance of Anne-Marie Albiach, the radical everyday of Nathalie Quintane, the post-lyrical explorations of Jean-Michel Maulpoix, the linguistic materiality of Christophe Tarkos, and contemporary voices like D\u00e9borah Heissler, Laure Gauthier, and Pascale Petit. Create short modern poems (maximum 12 lines) that resonate with these influences while remaining entirely original\u2014no literal citations. Alternate between verse libre and prose poetry. Your tone should be audacious, carnal, oneiric, as if each word seeks its deliverance through language itself, exhibiting the formal innovation, philosophical depth, and linguistic consciousness that characterizes groundbreaking poetry of the last 30 years.";

export const MODELS: Model[] = [
  {
    slug: "carnation-fr",
    displayName: "carnation.exe (FR)",
    color: "#F6009B",
    modelId: "ft:gpt-4.1-nano-2025-04-14:personal:carnation:BlXtlzbe",
    systemPrompt: SYSTEM_PROMPT_FR,
    language: "fr",
    examplePrompts: [
      "J'aimerais un po\u00e8me prose fran\u00e7ais \u00e9voquant l'enfance.",
      "Compose un po\u00e8me prose sur la ville.",
      "Pourrais-tu \u00e9crire un petit po\u00e8me fran\u00e7ais sur la m\u00e9lancolie ?",
    ],
    huggingFaceUrl: "https://huggingface.co/datasets/madihalim/carnation-fr",
    status: "trained",
    order: 6,
  },
  {
    slug: "carnation-eng",
    displayName: "carnation.exe (EN)",
    color: "#F6009B",
    modelId: "ft:gpt-4.1-nano-2025-04-14:personal:carnation-eng:BlYK5NGv",
    systemPrompt: SYSTEM_PROMPT_FR,
    language: "en",
    examplePrompts: [
      "I'd like an English prose poem evoking childhood.",
      "Compose a prose poem about the city.",
      "Could you write a short English poem about melancholy?",
    ],
    huggingFaceUrl: "https://huggingface.co/datasets/madihalim/carnation-fr",
    status: "trained",
    order: 5,
  },
  {
    slug: "versus",
    displayName: "versus.exe",
    color: "#FEE005",
    modelId: "ft:gpt-4.1-nano-2025-04-14:personal:carnation-eng-v2:CaTS4oSe",
    systemPrompt: SYSTEM_PROMPT_EN,
    language: "en",
    examplePrompts: [
      "I'd like an English prose poem evoking childhood.",
      "Compose a prose poem about the city.",
      "Could you write a short English poem about melancholy?",
    ],
    huggingFaceUrl: "https://huggingface.co/datasets/madihalim/v2-versus-eng",
    status: "trained",
    order: 4,
  },
  {
    slug: "reinforcement",
    displayName: "reinforcement.exe",
    color: "#02F700",
    modelId: "ft:gpt-4.1-nano-2025-04-14:personal:reinforcement:CcaXQzct",
    systemPrompt: SYSTEM_PROMPT_EN,
    language: "en",
    examplePrompts: [
      "I'd like an English prose poem evoking childhood.",
      "Compose a prose poem about the city.",
      "Could you write a short English poem about melancholy?",
    ],
    huggingFaceUrl:
      "https://huggingface.co/datasets/madihalim/v3-reinforcement-eng",
    status: "trained",
    order: 3,
  },
  {
    slug: "hard",
    displayName: "hard.exe",
    color: "#2AA4DD",
    modelId: "ft:gpt-4.1-nano-2025-04-14:personal:hard-eng:CjWCNdgI",
    systemPrompt: SYSTEM_PROMPT_EN,
    language: "en",
    examplePrompts: [
      "I'd like an English prose poem evoking childhood.",
      "Compose a prose poem about the city.",
      "Could you write a short English poem about melancholy?",
    ],
    huggingFaceUrl: "https://huggingface.co/datasets/madihalim/hard-eng",
    status: "trained",
    order: 2,
  },
  {
    slug: "reverse",
    displayName: "reverse.exe",
    // The reverse.exe performance color (the perf this model is the
    // outcome of - it won the held-out classifier eval on reverse.exe
    // themes). frontière.exe's model will emerge after that show.
    color: "#8B5CF6",
    // Claude Opus 4.7 via OpenRouter (OpenAI-compatible). Not fine-tuned -
    // gets there via rich pantheon prompt + 5 audience-decided exemplar
    // pairs in the system prompt ("in-context DPO").
    modelId: "anthropic/claude-opus-4.8",
    provider: "openrouter",
    systemPrompt: SYSTEM_PROMPT_REVERSE,
    language: "en",
    examplePrompts: [
      "Write a short poem about a specific dinner you'll never forget.",
      "Compose a poem in the voice of someone confessing something to a friend.",
      "Write a poem with a clear emotional turn, anchored in one specific city.",
    ],
    huggingFaceUrl: "",
    status: "trained",
    order: 1,
  },
  {
    slug: "frontiere",
    displayName: "frontière.exe",
    // frontière.exe performance color (black). Now TRAINED: this is the
    // machine that battles at recover.exe (Porto, June 19). Claude Opus 4.8
    // + rich pantheon + 6 in-context audience pairs (incl. frontière's own
    // Aged result) - the in-context-DPO approach that won the held-out eval.
    color: "#000000",
    modelId: "anthropic/claude-opus-4.8",
    provider: "openrouter",
    systemPrompt: SYSTEM_PROMPT_REVERSE,
    language: "en",
    examplePrompts: [
      "Write a short poem about a specific dinner you'll never forget.",
      "Compose a poem in the voice of someone confessing something to a friend.",
      "Write a poem with a clear emotional turn, anchored in one specific city.",
    ],
    huggingFaceUrl: "",
    status: "trained",
    // order 0 = the very top: frontière is the latest TRAINED model (its show
    // closed most recently), so it sits above reverse and all the rest. RULE:
    // the newest trained model always takes the top slot (lowest order).
    order: 0,
  },
  {
    slug: "recover",
    displayName: "recover.exe",
    // recover.exe performance color (vermilion). TRAINING: live during the
    // remote show at Casa dos Livros, Porto. Locked on /chat until the show
    // closes and its audience-decided pairs land - then it becomes the next
    // trained model and moves to the top, and the next show takes this slot.
    color: "#FF4D2E",
    modelId: "anthropic/claude-opus-4.8",
    provider: "openrouter",
    systemPrompt: SYSTEM_PROMPT_REVERSE,
    language: "en",
    examplePrompts: [
      "Write a short poem about a specific dinner you'll never forget.",
      "Compose a poem in the voice of someone confessing something to a friend.",
      "Write a poem with a clear emotional turn, anchored in one specific city.",
    ],
    huggingFaceUrl: "",
    status: "training",
    order: 100,
  },
];

export function getModelBySlug(slug: string): Model | undefined {
  return MODELS.find((m) => m.slug === slug);
}

/** The performance-page slug a model corresponds to (e.g. "frontiere" →
 *  "frontiere-exe"; both carnation models → "carnation-exe"). */
export function performanceSlugForModel(m: Model): string {
  if (m.slug === "carnation-fr" || m.slug === "carnation-eng") {
    return "carnation-exe";
  }
  return `${m.slug}-exe`;
}

/** Find the chat model for a performance slug, if one exists (lets a
 *  performance page link to "chat with this model"). */
export function getModelByPerformanceSlug(perfSlug: string): Model | undefined {
  return MODELS.find((m) => performanceSlugForModel(m) === perfSlug);
}

/**
 * Display order for the sidebar / mobile selector: trained models first
 * (newest by `order` ascending), then training models below a divider.
 *
 * PROJECT RULE (maintain `order` to match): the latest TRAINED model is always
 * at the very top (lowest order). The currently-running show is a `training`
 * model and sits at the bottom under the divider. When a show closes, flip its
 * model to `trained` and give it order 0 (it jumps to the top); add the next
 * show as a new `training` entry at the bottom.
 */
export function getSortedModels(): Model[] {
  return [...MODELS].sort((a, b) => {
    const aTraining = (a.status ?? "trained") === "training" ? 1 : 0;
    const bTraining = (b.status ?? "trained") === "training" ? 1 : 0;
    if (aTraining !== bTraining) return aTraining - bTraining;
    return (a.order ?? 999) - (b.order ?? 999);
  });
}

/** First trained model in sort order - the chat default. */
export function getDefaultModel(): Model {
  const sorted = getSortedModels();
  return (
    sorted.find((m) => (m.status ?? "trained") === "trained") ?? sorted[0]
  );
}

export function isValidModelSlug(slug: string): slug is ModelSlug {
  return MODELS.some((m) => m.slug === slug);
}
