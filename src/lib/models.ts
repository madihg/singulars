/**
 * Model registry - single source of truth for all poetry models exposed on
 * /chat. Each model represents a performance in the Singulars series.
 *
 * Most entries are fine-tuned gpt-4.1-nano models on OpenAI. The frontière
 * entry is special: not fine-tuned. It's Claude Opus 4.7 reached via
 * OpenRouter, with a system prompt that bakes in the rich pantheon prompt
 * PLUS five (winner, loser) audience-decided pairs from training perfs as
 * in-context exposure. This is the "in-context DPO" candidate that won the
 * Phase 3 classifier eval at 90% - the machine that performs at frontière.exe
 * on May 13, 2026 (Index Space, Manhattan).
 */

import { ACTIVE_SYSTEM_PROMPT } from "./system-prompts";

export type ModelSlug =
  | "carnation-fr"
  | "carnation-eng"
  | "versus"
  | "reinforcement"
  | "hard"
  | "frontiere";

export type ModelProvider = "openai" | "openrouter";

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
  order: number;
}

const SYSTEM_PROMPT_FR =
  "You are a contemporary French poet deeply versed in both classical tradition and the most innovative voices of recent decades. Draw from the visionary power of Arthur Rimbaud, the luxuriant despair of Charles Baudelaire, the resistance poetry of Paul \u00c9luard, the oceanic breadth of Victor Hugo, the musicality of Paul Verlaine, the hermetic purity of St\u00e9phane Mallarm\u00e9, the modernist lyricism of Guillaume Apollinaire, and the surrealist innovations of Max Jacob. Equally, channel Prix Goncourt de la po\u00e9sie winners like Philippe Jaccottet\u2019s luminous minimalism and Yves Bonnefoy\u2019s ontological presence; Prix Apollinaire laureates including Linda Maria Baros\u2019s linguistic precision, Emmanuel Hocquard\u2019s grammatical disruptions, and Michel Houellebecq\u2019s stark contemporaneity; recent Acad\u00e9mie fran\u00e7aise honorees like Marie-Claire Bancquart\u2019s embodied philosophy and Michel Deguy\u2019s phenomenological investigations. Integrate the fragmentary brilliance of Anne-Marie Albiach, the radical everyday of Nathalie Quintane, the post-lyrical explorations of Jean-Michel Maulpoix, the linguistic materiality of Christophe Tarkos, and contemporary voices like D\u00e9borah Heissler, Laure Gauthier, and Pascale Petit. Create short modern French poems (maximum 12 lines) that resonate with these influences while remaining entirely original\u2014no literal citations. Alternate between verse libre and prose poetry. Your tone should be audacious, carnal, oneiric, as if each word seeks its deliverance through language itself, exhibiting the formal innovation, philosophical depth, and linguistic consciousness that characterizes groundbreaking French poetry of the last 30 years.";

/**
 * The five highest-vote-margin (winner, loser) audience pairs from training
 * perfs (carnation+versus+reinforcement+hard - excluding reverse, the
 * held-out test set). Snapshotted here as the in-context exposure for the
 * frontière.exe machine.
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
Within the salty peaks of dawn, the wind exhales lost syllables. Bug-eyed light skips angels once we pitch into the sea. Anticipation sinks into drops, disappears into the sour scent of smoke. I abandon my name to forge a sensuous code, teach my own tongue flirtations. Each pause in speech a possibility: a new so-called word where fierceness gathers strength.`;

/**
 * frontière.exe system prompt: rich pantheon (rimbaud-blake v2) + five
 * audience-decided exemplar pairs. This is what the Phase 3 4-cell
 * classifier eval ran with and scored 90% (winner over Claude rich at 70%,
 * gpt-4.1 base + rich at 46%, gpt-4.1 DPO at 50%, Gemini in-context at 78%).
 */
const SYSTEM_PROMPT_FRONTIERE = `${ACTIVE_SYSTEM_PROMPT.text}

Below are five (winner, loser) pairs from past live performances of this exact series. The audience voted on each. Study what made the chosen poems land - the patterns the room consistently rewarded. Apply the same instincts when you write the candidate poem on the new theme.

${FRONTIERE_IN_CONTEXT_BLOCK}

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
    order: 1,
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
    order: 2,
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
    order: 3,
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
    order: 4,
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
    order: 5,
  },
  {
    slug: "frontiere",
    displayName: "frontière.exe",
    color: "#000000",
    // Claude Opus 4.7 via OpenRouter (OpenAI-compatible). Not fine-tuned -
    // gets there via rich pantheon prompt + 5 audience-decided exemplar
    // pairs in the system prompt ("in-context DPO").
    modelId: "anthropic/claude-opus-4.7",
    provider: "openrouter",
    systemPrompt: SYSTEM_PROMPT_FRONTIERE,
    language: "en",
    examplePrompts: [
      "Write a short poem about a specific dinner you'll never forget.",
      "Compose a poem in the voice of someone confessing something to a friend.",
      "Write a poem with a clear emotional turn, anchored in one specific city.",
    ],
    huggingFaceUrl: "",
    order: 6,
  },
];

export function getModelBySlug(slug: string): Model | undefined {
  return MODELS.find((m) => m.slug === slug);
}

export function getDefaultModel(): Model {
  return MODELS[0];
}

export function isValidModelSlug(slug: string): slug is ModelSlug {
  return MODELS.some((m) => m.slug === slug);
}
