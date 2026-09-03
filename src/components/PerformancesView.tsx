"use client";

/**
 * The performances window: one window on the desk, three ways to read it.
 *
 * grid     - cards on a fluid grid
 * carousel - the same cards on a snapping rail
 * list     - the canon .file ledger, one row per performance
 *
 * The switcher is a row of .btn chips with aria-pressed, per the Desktop
 * language. Card colour survives as the small mark beside a name (.cdot); the
 * ground, the type and the rules come from the canon.
 */

import { useState } from "react";
import Link from "next/link";
import {
  heroImgSrc,
  HERO_IMAGES,
  getPerformanceHeroImage,
  getCardDescription,
} from "@/lib/performance-descriptions";

export interface PerformanceRow {
  id: string;
  name: string;
  slug: string;
  color: string;
  location: string;
  date: string;
  status: "upcoming" | "training" | "trained";
}

type ViewMode = "grid" | "carousel" | "list";

const EXTERNAL_UPCOMING: Record<string, string> = {
  "ground-exe": "https://currentsnewmedia.org/",
  "frontiere-exe": "https://www.instagram.com/bianjie.systems/",
  "tame-exe": "https://www.mozillafoundation.org/en/festival/",
};

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (year && month && day) {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${months[month - 1]} ${day}, ${year}`;
  }
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function heroFor(perf: PerformanceRow) {
  const reverseNameFallback =
    perf.name.trim().toLowerCase() === "reverse.exe"
      ? HERO_IMAGES.performance["reverse-exe"]
      : null;
  return (
    getPerformanceHeroImage(perf.slug) ??
    reverseNameFallback ??
    HERO_IMAGES.landing
  );
}

/** The right link shell for a row: detail page, external listing, or none. */
function CardShell({
  perf,
  className,
  children,
}: {
  perf: PerformanceRow;
  className?: string;
  children: React.ReactNode;
}) {
  if (perf.status === "upcoming") {
    const externalUrl = EXTERNAL_UPCOMING[perf.slug] ?? null;
    if (externalUrl) {
      return (
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
        >
          {children}
        </a>
      );
    }
    return <div className={className}>{children}</div>;
  }
  return (
    <Link href={`/${perf.slug}`} className={className}>
      {children}
    </Link>
  );
}

function Card({ perf }: { perf: PerformanceRow }) {
  const heroImg = heroFor(perf);
  const isLogoImage =
    heroImg.src.endsWith(".svg") || heroImg.src.includes("currents-logo");
  const desc = getCardDescription(perf.slug);

  return (
    <span
      data-testid="performance-card"
      data-performance-name={perf.name}
      style={{ display: "block", minWidth: 0 }}
    >
      <span className="sg-card__thumb">
        <img
          src={heroImgSrc(heroImg)}
          alt={heroImg.alt}
          width={640}
          height={400}
          loading="lazy"
          decoding="async"
          style={
            isLogoImage
              ? { objectFit: "contain", background: "var(--paper)" }
              : undefined
          }
        />
      </span>
      <span className="k" style={{ marginTop: "0.55rem" }}>
        {perf.status}
        {perf.location ? ` · ${perf.location}` : ""}
      </span>
      <span className="sg-card__t">
        <i className="cdot" style={{ ["--c" as string]: perf.color }} />{" "}
        {perf.name}
      </span>
      {perf.date ? <span className="k">{formatDate(perf.date)}</span> : null}
      {desc ? <span className="sg-card__w">{desc}</span> : null}
    </span>
  );
}

const VIEWS: ViewMode[] = ["grid", "carousel", "list"];

export default function PerformancesView({
  performances,
}: {
  performances: PerformanceRow[];
}) {
  const [view, setView] = useState<ViewMode>("grid");

  return (
    <section className="win" id="performances">
      <div className="win__bar">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        <h2 className="win__t">performances/</h2>
        <span className="win__meta">{performances.length} in the series</span>
      </div>
      <div className="win__b">
        <div
          className="sg-row sg-row--tight"
          role="group"
          aria-label="view performances as"
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

        {view === "grid" && (
          <div className="sg-cards">
            {performances.map((perf) => (
              <CardShell key={perf.id} perf={perf} className="sg-card">
                <Card perf={perf} />
              </CardShell>
            ))}
          </div>
        )}

        {view === "carousel" && (
          <div className="sg-rail">
            {performances.map((perf) => (
              <CardShell key={perf.id} perf={perf} className="sg-card">
                <Card perf={perf} />
              </CardShell>
            ))}
          </div>
        )}

        {view === "list" && (
          <div>
            <div className="hdr">
              <span className="k">performance</span>
              <span className="k">status</span>
              <span className="k">place</span>
              <span className="k">date</span>
            </div>
            {performances.map((perf) => (
              <CardShell
                key={perf.id}
                perf={perf}
                className="sg-line sg-line--4"
              >
                <span className="sg-line__n">
                  <i className="cdot" style={{ ["--c" as string]: perf.color }} />
                  {perf.name}
                </span>
                <span className="fr__s">{perf.status}</span>
                <span className="fr__w">{perf.location}</span>
                <span className="fr__d">
                  {perf.date ? formatDate(perf.date) : ""}
                </span>
              </CardShell>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
