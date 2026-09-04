/**
 * The poets window: short profiles of the humans who have written against the
 * machine. Data-driven (POETS) so the list grows as more poets take part.
 *
 * Photos live in /public/images/poets and stay grayscale until hover, the way
 * every other still on this surface behaves. A poet with no photo falls back to
 * a monogram tile so the grid stays even.
 */

type Poet = {
  name: string;
  role: string;
  bio: string;
  img: string | null;
  link?: { href: string; label: string };
};

const POETS: Poet[] = [
  {
    name: "Theory",
    role: "co-founder, Decentered Arts",
    img: "/singulars/images/poets/theory.webp",
    link: { href: "https://decentered.org", label: "decentered.org" },
    bio: "Theory leads the writing program and film of Decentered Arts. A former resident and volunteer at The Center SF and a recent MFA graduate from the University of San Francisco, he is publishing his first novel. Professionally he is a freelance video editor; in his free time he studies improv and comedy.",
  },
  {
    name: "Elise Liu",
    role: "poet, immersive artist, technologist",
    img: "/singulars/images/poets/elise-liu.jpg",
    link: { href: "https://eliseliu.com", label: "eliseliu.com" },
    bio: "Elise Liu is an immigrant third-culture kid poet, immersive artist, and technologist. Her work has appeared in Rattle, The Found Poetry Review, Thought Catalog, The Millions, and corporate digital trashcans around the world. She is the recipient of the 2023 Paper Moon Prize for fiction. She lives in San Francisco with two cats and is working on her first novel.",
  },
  {
    name: "Halim Madi",
    role: "poet, performer",
    img: "/singulars/images/poets/halim.png",
    link: { href: "https://www.halimmadi.com", label: "halimmadi.com" },
    bio: "Halim Madi is a poet and performer who works where language meets software. He created Singulars and is the human in each duel, writing against a machine trained on the poems the audience keeps choosing.",
  },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function PoetCard({ poet }: { poet: Poet }) {
  return (
    <div className="sg-card">
      <span className="sg-card__thumb" style={{ aspectRatio: "1 / 1" }}>
        {poet.img ? (
          <img
            src={poet.img}
            alt={poet.name}
            width={520}
            height={520}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span
            aria-label={poet.name}
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-display)",
              fontSize: "3rem",
              color: "var(--ink-40)",
            }}
          >
            {initials(poet.name)}
          </span>
        )}
      </span>
      <h3 className="sg-card__t">{poet.name}</h3>
      <span className="k">{poet.role}</span>
      <p className="sg-card__w">{poet.bio}</p>
      {poet.link && (
        <a
          className="btn"
          href={poet.link.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ marginTop: "0.6rem" }}
        >
          {poet.link.label} &rarr;
        </a>
      )}
    </div>
  );
}

export default function Poets() {
  return (
    <section className="win" id="poets">
      <div className="win__bar">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        <h2 className="win__t">poets/</h2>
        <span className="win__meta">{POETS.length} so far</span>
      </div>
      <div className="win__b">
        <p className="note" style={{ margin: "0 0 1.1rem" }}>
          The humans who have dueled the machine so far.
        </p>
        <div className="sg-cards">
          {POETS.map((poet) => (
            <PoetCard key={poet.name} poet={poet} />
          ))}
        </div>
      </div>
    </section>
  );
}
