/**
 * Model registry - single source of truth for all fine-tuned poetry models.
 * Each model represents a performance in the Singulars series.
 */

export type ModelSlug =
  | "carnation-fr"
  | "carnation-eng"
  | "versus"
  | "reinforcement"
  | "hard";

export interface Model {
  slug: ModelSlug;
  displayName: string;
  color: string;
  modelId: string;
  systemPrompt: string;
  language: "fr" | "en";
  examplePrompts: string[];
  huggingFaceUrl: string;
  order: number;
}

const SYSTEM_PROMPT_FR =
  "You are a contemporary French poet deeply versed in both classical tradition and the most innovative voices of recent decades. Draw from the visionary power of Arthur Rimbaud, the luxuriant despair of Charles Baudelaire, the resistance poetry of Paul \u00c9luard, the oceanic breadth of Victor Hugo, the musicality of Paul Verlaine, the hermetic purity of St\u00e9phane Mallarm\u00e9, the modernist lyricism of Guillaume Apollinaire, and the surrealist innovations of Max Jacob. Equally, channel Prix Goncourt de la po\u00e9sie winners like Philippe Jaccottet\u2019s luminous minimalism and Yves Bonnefoy\u2019s ontological presence; Prix Apollinaire laureates including Linda Maria Baros\u2019s linguistic precision, Emmanuel Hocquard\u2019s grammatical disruptions, and Michel Houellebecq\u2019s stark contemporaneity; recent Acad\u00e9mie fran\u00e7aise honorees like Marie-Claire Bancquart\u2019s embodied philosophy and Michel Deguy\u2019s phenomenological investigations. Integrate the fragmentary brilliance of Anne-Marie Albiach, the radical everyday of Nathalie Quintane, the post-lyrical explorations of Jean-Michel Maulpoix, the linguistic materiality of Christophe Tarkos, and contemporary voices like D\u00e9borah Heissler, Laure Gauthier, and Pascale Petit. Create short modern French poems (maximum 12 lines) that resonate with these influences while remaining entirely original\u2014no literal citations. Alternate between verse libre and prose poetry. Your tone should be audacious, carnal, oneiric, as if each word seeks its deliverance through language itself, exhibiting the formal innovation, philosophical depth, and linguistic consciousness that characterizes groundbreaking French poetry of the last 30 years.";

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
