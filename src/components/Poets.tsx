/**
 * Landing "Poets" section - short profiles of the humans who have dueled the
 * machine. Rendered below Performances on the Singulars landing page.
 *
 * Data-driven (POETS array) so the list grows as more poets take part. Photos
 * live in /public/images/poets and render grayscale to match the monochrome
 * site treatment; a poet with no photo falls back to a monogram tile so the
 * grid stays even.
 *
 * The grid uses grid-template-columns inside <section> so it inherits the
 * landing's responsive rules (3 -> 2 -> 1 columns), defined in page.tsx.
 */

const MONO = '"Diatype Mono Variable", monospace';
const HEADING = '"Diatype Variable", sans-serif';
const DISPLAY = '"Terminal Grotesque", sans-serif';

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
    img: "/images/poets/theory.webp",
    link: { href: "https://decentered.org", label: "decentered.org" },
    bio: "Theory leads the writing program and film of Decentered Arts. A former resident and volunteer at The Center SF and a recent MFA graduate from the University of San Francisco, he is publishing his first novel. Professionally he is a freelance video editor; in his free time he studies improv and comedy.",
  },
  {
    name: "Elise Liu",
    role: "poet, immersive artist, technologist",
    img: "/images/poets/elise-liu.jpg",
    link: { href: "https://eliseliu.com", label: "eliseliu.com" },
    bio: "Elise Liu is an immigrant third-culture kid poet, immersive artist, and technologist. Her work has appeared in Rattle, The Found Poetry Review, Thought Catalog, The Millions, and corporate digital trashcans around the world. She is the recipient of the 2023 Paper Moon Prize for fiction. She lives in San Francisco with two cats and is working on her first novel.",
  },
  {
    name: "Halim Madi",
    role: "poet, performer",
    img: "/images/poets/halim.png",
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
    <div>
      <div
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          marginBottom: "1rem",
          overflow: "hidden",
          background: "#f1f1f1",
        }}
      >
        {poet.img ? (
          <img
            src={poet.img}
            alt={poet.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              filter: "grayscale(100%)",
            }}
          />
        ) : (
          <div
            aria-label={poet.name}
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: DISPLAY,
              fontSize: "3rem",
              color: "rgba(0,0,0,0.35)",
              letterSpacing: "0.05em",
            }}
          >
            {initials(poet.name)}
          </div>
        )}
      </div>

      <h3
        style={{
          fontFamily: HEADING,
          fontSize: "1.1rem",
          fontWeight: 600,
          margin: "0 0 0.25rem 0",
          lineHeight: 1.2,
        }}
      >
        {poet.name}
      </h3>
      <p
        style={{
          fontFamily: MONO,
          fontSize: "0.78rem",
          letterSpacing: "0.02em",
          color: "rgba(0,0,0,0.5)",
          margin: "0 0 0.75rem 0",
        }}
      >
        {poet.role}
      </p>
      <p
        style={{
          fontSize: "0.9rem",
          color: "rgba(0,0,0,0.7)",
          lineHeight: 1.55,
          margin: 0,
        }}
      >
        {poet.bio}
      </p>
      {poet.link && (
        <a
          href={poet.link.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            marginTop: "0.6rem",
            fontFamily: MONO,
            fontSize: "0.78rem",
            color: "rgba(0,0,0,0.85)",
            textDecoration: "none",
            borderBottom: "1px solid rgba(0,0,0,0.25)",
          }}
        >
          {poet.link.label} &rarr;
        </a>
      )}
    </div>
  );
}

export default function Poets() {
  return (
    <section style={{ marginBottom: "3rem" }}>
      <h2
        style={{
          fontFamily: HEADING,
          fontSize: "2rem",
          fontWeight: 700,
          marginBottom: "0.75rem",
          lineHeight: 1.2,
        }}
      >
        Poets
      </h2>
      <p
        style={{
          fontSize: "1rem",
          color: "rgba(0,0,0,0.6)",
          lineHeight: 1.5,
          marginBottom: "2rem",
        }}
      >
        The humans who have dueled the machine so far.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "2rem",
        }}
      >
        {POETS.map((poet) => (
          <PoetCard key={poet.name} poet={poet} />
        ))}
      </div>
    </section>
  );
}
