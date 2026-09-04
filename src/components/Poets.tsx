"use client";

/**
 * Participating Poets: short profiles of the humans who have written against
 * the machine. Data-driven (POETS) so the list grows as more poets take part.
 *
 * The window opens as a carousel - one snapping rail, Elise Liu first - with a
 * grid view a click away, the same two-view vocabulary the performances window
 * uses. The photographs are small square portraits, in colour, so the bios do
 * the work. A poet with no photo falls back to a monogram tile so the rail
 * stays even. Every bio is the poet's own words, unedited.
 */

import { useState } from "react";

type Poet = {
  name: string;
  role: string;
  bio: string;
  img: string | null;
  link?: { href: string; label: string };
};

const POETS: Poet[] = [
  {
    name: "Elise Liu",
    role: "poet, immersive artist, technologist",
    img: "/singulars/images/poets/elise-liu.jpg",
    link: { href: "https://eliseliu.com", label: "eliseliu.com" },
    bio: "Elise Liu is an immigrant third-culture kid poet, immersive artist, and technologist. Her work has appeared in Rattle, The Found Poetry Review, Thought Catalog, The Millions, and corporate digital trashcans around the world. She is the recipient of the 2023 Paper Moon Prize for fiction. She lives in San Francisco with two cats and is working on her first novel.",
  },
  {
    name: "Theory",
    role: "co-founder, Decentered Arts",
    img: "/singulars/images/poets/theory.webp",
    link: { href: "https://decentered.org", label: "decentered.org" },
    bio: "Theory leads the writing program and film of Decentered Arts. A former resident and volunteer at The Center SF and a recent MFA graduate from the University of San Francisco, he is publishing his first novel. Professionally he is a freelance video editor; in his free time he studies improv and comedy.",
  },
  {
    name: "Halim Madi",
    role: "poet, performer",
    img: "/singulars/images/poets/halim.png",
    link: { href: "https://www.halimmadi.com", label: "halimmadi.com" },
    bio: "Halim Madi is a poet and performer who works where language meets software. He created Singulars and is the human in each duel, writing against a machine trained on the poems the audience keeps choosing.",
  },
];

const VIEWS = ["carousel", "grid"] as const;
type ViewMode = (typeof VIEWS)[number];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function PoetCard({ poet }: { poet: Poet }) {
  return (
    <div className="sg-card sg-card--poet">
      <span className="sg-card__thumb sg-card__thumb--poet">
        {poet.img ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={poet.img}
            alt={poet.name}
            width={220}
            height={220}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span aria-label={poet.name} className="sg-card__mono">
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
  const [view, setView] = useState<ViewMode>("carousel");

  return (
    <section className="win" id="poets">
      <div className="win__bar">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        <h2 className="win__t">Participating Poets</h2>
        <span className="win__meta">{POETS.length} so far</span>
      </div>
      <div className="win__b">
        <p className="note" style={{ margin: "0 0 0.9rem" }}>
          The humans who have dueled the machine so far.
        </p>
        <div
          className="sg-row sg-row--tight"
          role="group"
          aria-label="view poets as"
          style={{ marginBottom: "1.1rem" }}
        >
          {VIEWS.map((mode) => (
            <button
              key={mode}
              type="button"
              className="btn"
              onClick={() => setView(mode)}
              aria-pressed={view === mode}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className={view === "carousel" ? "sg-rail sg-rail--poets" : "sg-cards"}>
          {POETS.map((poet) => (
            <PoetCard key={poet.name} poet={poet} />
          ))}
        </div>
      </div>
    </section>
  );
}
