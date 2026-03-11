// Structured content for performance description pages
// Content scraped from halimmadi.com

type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "italic"; text: string }
  | { type: "image"; src: string; alt: string }
  | { type: "video"; hash: string; filename: string }
  | {
      type: "gallery";
      items: { src: string; alt: string }[];
    };

export interface PerformanceDescription {
  title: string;
  date: string;
  location: string;
  series: string;
  liveUrl: string;
  datasetUrl: string;
  content: ContentBlock[];
}

export interface HeroImage {
  alt: string;
  src: string;
}

export function heroImgSrc(image: HeroImage): string {
  return image.src;
}

function normalizePerformanceSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[._\s]+/g, "-");
}

/** Hero images for landing (below Singulars) and performance pages. Same aspect ratio for alignment. */
export const HERO_IMAGES: {
  landing: HeroImage;
  performance: Record<string, HeroImage>;
} = {
  landing: {
    src: "/images/reinforcement-exe/IGAC-exhibition-photography-049.jpg",
    alt: "Reinforcement.exe performance with poet writing inside the cube and audience voting on the wall",
  },
  performance: {
    "reinforcement-exe": {
      src: "/images/reinforcement-exe/_MG_5036.jpg",
      alt: "Printed poems with red and blue voting stickers from audience",
    },
    "versus-exe": {
      src: "/images/versus-exe/IMG_9920.JPG",
      alt: "Versus.exe performance at Mozilla AI Residency, San Francisco",
    },
    "carnation-exe": {
      src: "/images/carnation-exe/IMG_8458.JPG",
      alt: "Carnation.exe performance installation with printed poems displayed side by side",
    },
    "hard-exe": {
      src: "/images/hard-exe/IMG_0463.JPG",
      alt: "Audience examining printed poems with blue voting stickers at TIAT San Francisco",
    },
    "reverse-exe": {
      src: "/images/reverse-exe/IMG_2110.JPG",
      alt: "Printed poems with purple voting stickers at the Media Archaeology Lab",
    },
  },
};

/** Short card descriptions for the landing page grid. */
export const CARD_DESCRIPTIONS: Record<string, string> = {
  "ground-exe":
    "The duel moves to the desert. At the Currents New Media Festival, the poet and machine write under the light of Santa Fe.",
  "reverse-exe":
    "A live poetry duel at the Media Archaeology Lab. The poet writes among vintage machines while the model trains on the archive of past performances.",
  "hard-exe":
    "The machine learns in real time. Audience votes on each poem pair shape the model\u2019s next generation: artisanal RLHF performed live on stage.",
  "reinforcement-exe":
    "Inside an open cube, the poet writes a new poem every thirty minutes. Red and blue stickers pile up as the audience becomes the trainer.",
  "versus-exe":
    "Guest poets join the duel. The circle widens across languages (Arabic, French, English, Spanish) and the model absorbs every collision.",
  "carnation-exe":
    "The first Singulars performance. A pink dot beneath the poem that moved you most. The carnation, in English, means: I will never forget you.",
};

export function getCardDescription(slug: string): string | null {
  const exact = CARD_DESCRIPTIONS[slug];
  if (exact) return exact;
  const normalized = CARD_DESCRIPTIONS[normalizePerformanceSlug(slug)];
  return normalized ?? null;
}

export function getPerformanceHeroImage(slug: string): HeroImage | null {
  const exact = HERO_IMAGES.performance[slug];
  if (exact) return exact;
  const normalized = HERO_IMAGES.performance[normalizePerformanceSlug(slug)];
  return normalized ?? null;
}

const descriptions: Record<string, PerformanceDescription> = {
  "hard-exe": {
    title: "Hard.exe",
    date: "Nov '24",
    location: "TIAT, San Francisco",
    series: "Part IV of Singulars",
    liveUrl: "",
    datasetUrl: "",
    content: [
      {
        type: "image",
        src: "/images/hard-exe/IMG_0463.JPG",
        alt: "Audience examining printed poems with blue voting stickers at TIAT San Francisco",
      },
      {
        type: "paragraph",
        text: "Hard.exe is the fourth installment in the Singulars series, an ongoing duel between poet and machine. The poet writes a poem for 30 minutes on a theme proposed by the audience. The model, trained on an anthology of English poetry and past iterations of this performance, responds almost instantly with one of its own. Both poems are printed, hung, and kept anonymous. The audience votes. When the human wins, the machine is retrained on an updated dataset. When the machine wins, the poet adjusts.",
      },
      {
        type: "paragraph",
        text: "This is reinforcement learning using human feedback, a popular machine learning technique, made tangible. What emerges is a different narrative for the human and AI encounter. Not a fight but a mutual reinforcement. Not a contest but a feedback ecology where readers become trainers and taste becomes the tuning function. A reinforced model, both human and artificial, trained not to win, but to listen.",
      },
      {
        type: "gallery",
        items: [
          {
            src: "/images/hard-exe/IMG_0464.JPG",
            alt: "Audience member placing blue voting stickers on printed poems",
          },
          {
            src: "/images/hard-exe/IMG_0465.JPG",
            alt: "Two printed poems side by side with blue voting stickers",
          },
        ],
      },
      {
        type: "paragraph",
        text: "The usual question is whether a machine can appear human enough. In this work the pressure runs in the other direction. Sitting behind a panel with a timer running, the poet is the one who has to prove their humanity. If the poem does not resonate, if the dots gather on the other page, it feels less like losing a game and more like failing to be adequately human in public. To win you cannot rely on tricks alone. You have to connect to something true, to tap into experiences that feel specific enough, embodied enough, that an audience of strangers feels it in their own lives.",
      },
      {
        type: "paragraph",
        text: "This format is also an intense study of attention. Once attention becomes the prize you can feel how quickly it bends the work into certain shapes. The model rarely goes very far into the conceptual. Where the poet tends to win is in the adjacent zones of shock, surprise, and situational awareness, the small receding edges of context that models are currently unable to inhabit. Paradoxically, this is also what rediscovers what matters in poetry. If you aim only for cheap attention, the poem wins but you lose. The goal becomes cultivating a particular quality of experience in the room, even if that means losing a round.",
      },
      {
        type: "gallery",
        items: [
          {
            src: "/images/hard-exe/IMG_0466.JPG",
            alt: "Printed poems covered in blue voting stickers",
          },
          {
            src: "/images/hard-exe/IMG_0476.JPG",
            alt: "Poems lined up along a wooden ledge with blue stickers accumulating",
          },
        ],
      },
      {
        type: "paragraph",
        text: "The model writes in an instant. The poet takes thirty minutes. At first that feels like a handicap. Over time it becomes clear that the delay changes the poet. It takes thirty minutes to become the poem. The writing rewires you a little each round. There is also a surprisingly tender material side to the work. You learn how to tear and fold paper tape efficiently, how to arrange the wall so that the poems look held rather than slapped on. You get familiar with the printer, how it always struggles with the first page of the day, the faint burnt smell of its effort.",
      },
      {
        type: "paragraph",
        text: "Emotionally, the work is intense. At the beginning, when the machine wins, there is a strange pride. It means you have trained a strong model. Later, when the machine starts winning on nights where you have tried your best, it means what you wrote has not connected. That is a very raw feeling. At the same time this rivalry clearly makes for a better poet. The sense of line, structure, and timing sharpens. The tolerance for cliches goes down. You can feel when a poem is sliding into what might be called machine obviousness and pull it back toward something stranger and more human.",
      },
      {
        type: "italic",
        text: "It reminded me of a mother whose body changes through the act of feeding a child. The one who nourishes is transformed by the process of nourishment.",
      },
      {
        type: "paragraph",
        text: "The experiment does not only rewire the poet and the model. It also changes the corpus itself. Other poets were brought in. Their work was metabolized into the model's training data. This diffused the style, shifted it away from a narrow imitation of one voice, and created a richer, more plural texture. It felt like inviting a small ghostly council of poets into the system. Dataset creation is never one way. The residency made it very clear that the project is not only about better models. It is about using the pressure of a reverse Turing test to discover what kind of humans we still have the chance to become.",
      },
    ],
  },

  "reverse-exe": {
    title: "Reverse.exe",
    date: "Mar '26",
    location: "Media Archaeology Lab, University of Colorado Boulder",
    series: "Part V of Singulars",
    liveUrl: "",
    datasetUrl: "",
    content: [
      {
        type: "image",
        src: "/images/reverse-exe/IMG_2110.JPG",
        alt: "Printed poems with purple voting stickers at the Media Archaeology Lab",
      },
      {
        type: "paragraph",
        text: "Reverse.exe unfolds at the Media Archaeology Lab, surrounded by vintage computers, printers, and media artifacts that hold the memory of computing's early eras. The poet writes a poem for 30 minutes on a theme proposed by the audience. The model, trained on an anthology of English poetry and past iterations of this performance, responds almost instantly with one of its own. Both poems are printed, hung, and kept anonymous. The audience votes. When the human wins, the machine is retrained on an updated dataset. When the machine wins, the poet adjusts.",
      },
      {
        type: "paragraph",
        text: "This is reinforcement learning using human feedback, a popular machine learning technique, made tangible. What emerges is a different narrative for the human and AI encounter. Not a fight but a mutual reinforcement. Not a contest but a feedback ecology where readers become trainers and taste becomes the tuning function. A reinforced model, both human and artificial, trained not to win, but to listen.",
      },
      {
        type: "gallery",
        items: [
          {
            src: "/images/reverse-exe/IMG_2125.JPG",
            alt: "The poet writing among vintage machines at the Media Archaeology Lab",
          },
          {
            src: "/images/reverse-exe/IMG_2131.JPG",
            alt: "The poet writing with a rainbow flag and lab equipment in the background",
          },
        ],
      },
      {
        type: "paragraph",
        text: "This is the fourth installment of Singulars. By now the feedback loop has tightened. The model carries forward the traces of Carnation, Versus, and Reinforcement in its weights. The poet carries them in memory. Each new performance reverses the flow. What was learned becomes the ground for what comes next.",
      },
      {
        type: "gallery",
        items: [
          {
            src: "/images/reverse-exe/IMG_2132.JPG",
            alt: "A hand placing a purple voting sticker on printed poems",
          },
          {
            src: "/images/reverse-exe/IMG_2133.JPG",
            alt: "Printed poems accumulating with purple voting stickers at the lab",
          },
        ],
      },
      {
        type: "paragraph",
        text: "The title points backward. Reverse as in rewind, as in undo, as in the opposite direction. The lab itself is a place where technologies go to be remembered rather than discarded. Writing poetry among these machines asks what endures. The printer still prints. The stickers still stick. The audience still chooses. The loop continues.",
      },
      {
        type: "image",
        src: "/images/reverse-exe/IMG_2124.JPG",
        alt: "The poet smiling at the Media Archaeology Lab with poems and stickers on the wall behind",
      },
      {
        type: "paragraph",
        text: "What emerges is reinforcement learning made tangible. Not a fight but a mutual adjustment. Not a contest but a feedback ecology where readers become trainers and taste becomes the tuning function. A model, both human and artificial, trained not to win but to listen.",
      },
    ],
  },

  "carnation-exe": {
    title: "Carnation.exe",
    date: "May '25",
    location: "European Artist Program, Paris, Barcelona",
    series: "Part I of Singulars",
    liveUrl: "https://carnation-eng.vercel.app/",
    datasetUrl: "https://huggingface.co/datasets/madihalim/carnation-fr",
    content: [
      {
        type: "image",
        src: "/images/carnation-exe/IMG_8458.JPG",
        alt: "Carnation.exe performance installation with printed poems displayed side by side",
      },
      {
        type: "paragraph",
        text: "Carnation.exe begins with the story of AlphaGo and Lee Sedol. In that match, creativity didn\u2019t come from mastery alone but from confrontation. Sedol\u2019s \u201cGod move\u201d unmoored the machine, and AlphaGo\u2019s reply revealed something alien. This is the heart of the work: poetry born not in solitude but in encounter. Rivalry as intimacy. Losing as memory. Each exchange a gift.",
      },
      {
        type: "paragraph",
        text: "In the performance, a human poet and a language model trained only on poetry face one another. Each day a theme (loss, longing, arrival) is chosen. The poet has thirty minutes. The model responds in seconds. Both poems are printed and placed side by side. Visitors read and vote by placing a pink dot beneath the piece that moved them most. The pink carnation, in English, means: I will never forget you.",
      },
      {
        type: "gallery",
        items: [
          {
            src: "/images/carnation-exe/IMG_8498.JPG",
            alt: "Close-up of printed poems with pink voting dots",
          },
          {
            src: "/images/carnation-exe/IMG_8497.JPG",
            alt: "Audience reading printed poems during the performance",
          },
          {
            src: "/images/carnation-exe/IMG_8478.JPG",
            alt: "Poems displayed on the wall with visitor votes",
          },
        ],
      },
      {
        type: "italic",
        text: "The essence of sports is not winning, but losing. Losing as a gift. The loser says to the winner, I will never forget you. And the winner, in turn, devours the memory of the loser, metabolizes them, carries them forward.",
      },
      {
        type: "gallery",
        items: [
          {
            src: "/images/carnation-exe/IMG_8470.JPG",
            alt: "Performance documentation showing the poet writing",
          },
          {
            src: "/images/carnation-exe/IMG_8474.JPG",
            alt: "Printed poems being placed for audience viewing",
          },
          {
            src: "/images/carnation-exe/IMG_8490.JPG",
            alt: "Audience interacting with the installation",
          },
        ],
      },
      {
        type: "paragraph",
        text: "Votes decide not just a winner but the next stage of learning. If the poet wins, their words are added to the training corpus. If the machine wins, the poet studies its work, borrowing from its strangeness. The cycle repeats. Over time, both evolve, shaped by each other, and by the audience who becomes the hidden trainer.",
      },
      {
        type: "gallery",
        items: [
          {
            src: "/images/carnation-exe/IMG_8481.JPG",
            alt: "Detail of pink voting stickers on printed poems",
          },
          {
            src: "/images/carnation-exe/IMG_8488.JPG",
            alt: "Overview of the Carnation.exe installation space",
          },
          {
            src: "/images/carnation-exe/IMG_8494.JPG",
            alt: "Close-up of handwritten and machine-generated poems",
          },
        ],
      },
      {
        type: "paragraph",
        text: "Carnation.exe is not about proving superiority. It stages an ecology of feedback, a ritual of exchange, a flower passed between mouths. A duel that is also a dance. Whether human or machine \u201cwins,\u201d what endures is the trace: the memory of the poem, the pink mark of attention, the vow not to forget.",
      },
    ],
  },

  "versus-exe": {
    title: "Versus.exe",
    date: "Nov 25",
    location: "Mozilla AI Residency, San Francisco",
    series: "Part II of Singulars",
    liveUrl: "https://versus-eta.vercel.app/",
    datasetUrl: "https://huggingface.co/datasets/madihalim/v2-versus-eng",
    content: [
      {
        type: "paragraph",
        text: "Versus.exe grows out of the same soil where Carnation.exe first took root. In that earlier match, the poet and the model circled each other like two creatures sensing a future they did not yet know how to share.",
      },
      {
        type: "paragraph",
        text: "The performance begins with a prompt: arrival, anger, joy, shame, or solitude. The model responds immediately; the poet takes thirty minutes. Two poems are printed side-by-side. Visitors vote with colored markers, their choices becoming \u201cselection pressure\u201d that influences both the poet\u2019s and model\u2019s future iterations.",
      },
      {
        type: "paragraph",
        text: "There is a soft humiliation in losing to the machine. The poet spends half an hour crafting each piece while the model generates its response in seconds. But this dynamic is the medium itself. Fine tuning as craft. Iteration as sculpture. The work investigates how judgment transforms into learning, learning into taste, and taste into evolution.",
      },
      {
        type: "image",
        src: "/images/versus-exe/IMG_9920.JPG",
        alt: "Versus.exe performance at Mozilla AI Residency, San Francisco",
      },
      {
        type: "paragraph",
        text: "In some sessions, the circle widens. Guest poets including Elise Liu and Theory have participated, introducing varied linguistic and emotional registers that shift audience response patterns across different languages: Arabic, French, English, Spanish.",
      },
      {
        type: "gallery",
        items: [
          {
            src: "/images/versus-exe/2831d8c8-b769-4e0d-ba6c-c1c838b4d131.JPG",
            alt: "Audience voting during the Versus.exe performance",
          },
          {
            src: "/images/versus-exe/IMG_1738.JPG",
            alt: "Printed poems displayed for audience reading",
          },
          {
            src: "/images/versus-exe/IMG_1718.JPG",
            alt: "Close-up of voting stickers on poems",
          },
        ],
      },
      {
        type: "paragraph",
        text: "Rather than collaboration, Versus.exe represents fine tuning as craft and iteration as sculpture. Behind the scenes, dashboards track votes, themes, and decision patterns within the model\u2019s probability distributions. Each audience vote influences future iterations. Winning human poems enter the training corpus, while successful model outputs become lessons for the poet.",
      },
      {
        type: "gallery",
        items: [
          {
            src: "/images/versus-exe/IMG_1714.JPG",
            alt: "Performance documentation",
          },
          {
            src: "/images/versus-exe/IMG_1700.JPG",
            alt: "Poet writing during the performance",
          },
          {
            src: "/images/versus-exe/IMG_1694.JPG",
            alt: "Audience engaging with printed poems",
          },
          {
            src: "/images/versus-exe/IMG_1685.JPG",
            alt: "Installation overview",
          },
          {
            src: "/images/versus-exe/IMG_9911.JPG",
            alt: "Detail of poems on display",
          },
        ],
      },
      {
        type: "paragraph",
        text: "Human participants experience what the artist calls \u201csoft humiliation\u201d when losing to the machine, spending hours crafting poetry only to be outpaced by automated generation, yet recognizing this technological dynamic as the medium itself.",
      },
      {
        type: "gallery",
        items: [
          {
            src: "/images/versus-exe/IMG_9912.JPG",
            alt: "Printed poem sheets with audience votes",
          },
          {
            src: "/images/versus-exe/IMG_9913.JPG",
            alt: "Voting stickers close-up",
          },
          {
            src: "/images/versus-exe/IMG_9915.JPG",
            alt: "Poems displayed on the wall",
          },
          {
            src: "/images/versus-exe/IMG_9916.JPG",
            alt: "Performance space overview",
          },
          {
            src: "/images/versus-exe/IMG_9917.JPG",
            alt: "Audience reading poems",
          },
        ],
      },
      {
        type: "italic",
        text: "Human and machine become altered through their encounter, much like a mother altered by the milk she gives.",
      },
      {
        type: "gallery",
        items: [
          {
            src: "/images/versus-exe/IMG_9921.jpg",
            alt: "Final installation view",
          },
          {
            src: "/images/versus-exe/IMG_9940.jpg",
            alt: "Documentation of the performance series",
          },
          {
            src: "/images/versus-exe/IMG_9925.jpg",
            alt: "Close-up of the performance materials",
          },
        ],
      },
    ],
  },

  "reinforcement-exe": {
    title: "Reinforcement.exe",
    date: "Nov 25",
    location: "ARG Ethereum Scholar Program, DevConnect Buenos Aires",
    series: "Part III of Singulars",
    liveUrl: "https://reinforcement-lime.vercel.app/",
    datasetUrl:
      "https://huggingface.co/datasets/madihalim/v3-reinforcement-eng",
    content: [
      {
        type: "paragraph",
        text: "Reinforcement.exe takes place inside an open cube. The poet enters as if stepping into a small world carved out of time. For two hours each day, they write a new poem every thirty minutes. No breaks. No drift. A metronome of attention. A ritual of effort. The machine waits beside them, training on the growing archive of their voice.",
      },
      {
        type: "image",
        src: "/images/reinforcement-exe/_MG_5037.jpg",
        alt: "The open cube installation where the poet writes during Reinforcement.exe",
      },
      {
        type: "paragraph",
        text: "Each cycle begins with a blank page. The poet writes. The model generates its answer. Two texts emerge from the same seed. Both are printed on warm paper and placed before the audience like offerings. Red stickers mark the machine. Blue stickers mark the human. The votes pile up in patterns that feel almost biological. A cluster of red. A cluster of blue. A cluster of confusion where the votes intermingle.",
      },
      {
        type: "image",
        src: "/images/reinforcement-exe/_MG_5036.jpg",
        alt: "Printed poems with red and blue voting stickers from audience",
      },
      {
        type: "paragraph",
        text: "These stickers are not decoration. They are reinforcement. They sculpt the machine by telling it what pleases. They sculpt the poet by telling them where their craft falters. The loop tightens each day. The model evolves through gradients of approval. The poet evolves through gradients of shame and surprise. A small crowd becomes the unseen trainer of both.",
      },
      {
        type: "image",
        src: "/images/reinforcement-exe/DSC01755.jpg",
        alt: "Audience voting with colored stickers during the performance",
      },
      {
        type: "paragraph",
        text: "Reinforcement.exe is part of the ARG Ethereum Scholar Program. It unfolds in Buenos Aires during DevConnect, surrounded by technologists, coders, cryptographers, dreamers, skeptics, and the hum of a city that treats invention as a kind of hunger. The project remains ongoing, a continuous experiment in living feedback. A performance that refuses to end at the level of spectacle. The cube becomes a workshop, a pressure chamber, a small factory where taste is forged in public.",
      },
      {
        type: "image",
        src: "/images/landing/IGAC-exhibition-photography-048.jpg",
        alt: "The performance cube at DevConnect Buenos Aires",
      },
      {
        type: "paragraph",
        text: "Inside the cube, something subtle breaks open. The poet begins to see their own gestures reflected back at them in strange distortions. A line they wrote four days earlier returns in the mouth of the model wearing a new mood. A metaphor they abandoned resurfaces sharpened. Sometimes the machine writes the better poem. Sometimes the human does. The point is not victory. The point is the slow emergence of a third voice produced by collision.",
      },
      {
        type: "gallery",
        items: [
          {
            src: "/images/reinforcement-exe/Untitled-2-01.jpg",
            alt: "Performance detail",
          },
          {
            src: "/images/reinforcement-exe/Untitled-2-02.jpg",
            alt: "Performance detail",
          },
          {
            src: "/images/reinforcement-exe/Untitled-2-03.jpg",
            alt: "Performance detail",
          },
          {
            src: "/images/reinforcement-exe/Untitled-2-04.jpg",
            alt: "Performance detail",
          },
          {
            src: "/images/reinforcement-exe/Untitled-2-05.jpg",
            alt: "Performance detail",
          },
          {
            src: "/images/reinforcement-exe/Untitled-2-06.jpg",
            alt: "Performance detail",
          },
          {
            src: "/images/reinforcement-exe/Untitled-2-07.jpg",
            alt: "Performance detail",
          },
          {
            src: "/images/reinforcement-exe/Untitled-2-08.jpg",
            alt: "Performance detail",
          },
        ],
      },
      {
        type: "paragraph",
        text: "There are moments of humiliation. The poet writes for half an hour and the model generates something cleaner. Something colder. Something that hits the room with unexpected force. The poet wonders why they keep doing this. Why they spend hours feeding a system that keeps learning faster than they can. Then the answer arrives. This is the medium. Fine tuning as composition. Reinforcement as choreography. A poem built through many acts of judgment.",
      },
      {
        type: "paragraph",
        text: "The work becomes even stranger when the poet tries to push the model beyond politeness. They learn to tune it into states of trembling. They whisper prompts that ask it to go wild, to seek salvation in the lexicons of the poets it once skimmed, to reject citation, to stand on its own voice. The softmax shifts. The temperature climbs. Something new arrives on the page that feels half metal and half breath.",
      },
      {
        type: "image",
        src: "/images/reinforcement-exe/IGAC-exhibition-photography-049.jpg",
        alt: "Close-up of printed poems accumulating during the performance",
      },
      {
        type: "paragraph",
        text: "Printed poems pile up. Sheets accumulate like sedimentary layers of a psychological dig. A dashboard records the votes. The losses. The brief victories. The micro oscillations of style. Once in a while the poet stops and sees the stack of poems the machine has absorbed. A clone growing in real time. Not money laundering for copyrighted text but a form of explicit self replication. The poet teaches the machine to sound more like them. Then the machine teaches the poet to sound more like someone who can survive the future.",
      },
      {
        type: "paragraph",
        text: "Reinforcement.exe belongs to the same lineage as Carnation.exe and Versus.exe. Together they form Singulars, a long inquiry into what it means for a human and a machine to share a craft. Each installment approaches the question from a different angle. Confrontation. Comparison. Training. Each reveals how influence flows in both directions. The human is not replaced. The machine is not crowned. Instead there is a slow emergence of a hybrid aesthetic shaped by contact.",
      },
      {
        type: "paragraph",
        text: "There is a line the poet returns to often. Half flesh half metal. Half iron half heart. It feels like the secret skeleton of Reinforcement.exe. A reminder that the point is not to prove who writes better. The point is to witness how two intelligences can change one another when placed in a loop of attention. What endures is the trace of each vote. The warmth of each printed page. And the slow awakening of a style held between two minds.",
      },
      {
        type: "gallery",
        items: [
          {
            src: "/images/reinforcement-exe/L1002255.jpg",
            alt: "Final installation view at DevConnect Buenos Aires",
          },
          {
            src: "/images/reinforcement-exe/L1001674.jpg",
            alt: "Documentation of the Reinforcement.exe performance",
          },
          {
            src: "/images/reinforcement-exe/L1002259.jpg",
            alt: "Overview of the performance space",
          },
        ],
      },
    ],
  },
};

export function getPerformanceDescription(
  slug: string,
): PerformanceDescription | null {
  return descriptions[slug] || null;
}

export function hasDescription(slug: string): boolean {
  return slug in descriptions;
}
