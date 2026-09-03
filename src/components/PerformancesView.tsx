"use client";

/**
 * Performances browser with three view modes: grid (default), carousel,
 * and list. Saf session 2 (Aug 31, 2026): with ~10 performances the
 * single grid was getting long - give visitors ways to browse.
 * Card markup moved here from app/page.tsx unchanged in spirit.
 */

import { useState } from "react";
import Link from "next/link";
import { accessibleTextColor, getStatusPillStyle } from "@/lib/color-utils";
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
    getPerformanceHeroImage(perf.slug) ?? reverseNameFallback ?? HERO_IMAGES.landing
  );
}

/** Wrap card content in the right link shell (detail page, external, or none). */
function CardShell({
  perf,
  children,
}: {
  perf: PerformanceRow;
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
          style={{ textDecoration: "none", color: "inherit" }}
        >
          {children}
        </a>
      );
    }
    return <div>{children}</div>;
  }
  return (
    <Link
      href={`/${perf.slug}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      {children}
    </Link>
  );
}

function Card({ perf }: { perf: PerformanceRow }) {
  const isUpcoming = perf.status === "upcoming";
  const perfA11yColor = accessibleTextColor(perf.color);
  const heroImg = heroFor(perf);
  const isLogoImage =
    heroImg.src.endsWith(".svg") || heroImg.src.includes("currents-logo");
  const pill = getStatusPillStyle(perf.status);
  const desc = getCardDescription(perf.slug);

  return (
    <div
      data-testid="performance-card"
      data-performance-name={perf.name}
      style={{
        borderTop: `4px solid ${perf.color}`,
        cursor:
          isUpcoming && !EXTERNAL_UPCOMING[perf.slug]
            ? "default"
            : `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><circle cx='10' cy='10' r='8' fill='${encodeURIComponent(perf.color)}'/></svg>") 10 10, pointer`,
        transition: "opacity 0.3s ease",
      }}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "16/9",
          marginBottom: "1rem",
          overflow: "hidden",
        }}
      >
        <img
          className="perf-card-img"
          src={heroImgSrc(heroImg)}
          alt={heroImg.alt}
          style={{
            width: "100%",
            height: "100%",
            objectFit: isLogoImage ? "contain" : "cover",
            display: "block",
            background: isLogoImage ? "#fff" : undefined,
            filter: isLogoImage
              ? "grayscale(100%) contrast(140%)"
              : "grayscale(100%)",
          }}
        />
      </div>
      <h3
        style={{
          fontSize: "1.1rem",
          fontWeight: 500,
          color: perfA11yColor,
          marginBottom: "0.5rem",
          lineHeight: 1.2,
        }}
      >
        {perf.name}
      </h3>
      <span
        style={{
          display: "inline-block",
          fontFamily: '"Diatype Mono Variable", monospace',
          fontSize: "0.7rem",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          padding: "0.25rem 0.7rem",
          borderRadius: "2px",
          border: `1px solid ${pill.border}`,
          backgroundColor: pill.background,
          color: pill.color,
          marginBottom: "0.75rem",
        }}
      >
        {perf.status}
      </span>
      {perf.location && (
        <p
          style={{
            fontSize: "0.9rem",
            color: "rgba(0,0,0,0.6)",
            marginBottom: "0.25rem",
          }}
        >
          {perf.location}
        </p>
      )}
      {perf.date && (
        <p
          style={{
            fontFamily: '"Diatype Mono Variable", monospace',
            fontSize: "0.85rem",
            color: "rgba(0,0,0,0.5)",
          }}
        >
          {formatDate(perf.date)}
        </p>
      )}
      {desc ? (
        <p
          style={{
            fontSize: "0.85rem",
            color: "rgba(0,0,0,0.55)",
            lineHeight: 1.5,
            marginTop: "0.5rem",
          }}
        >
          {desc}
        </p>
      ) : null}
    </div>
  );
}

const toggleButtonStyle = (active: boolean): React.CSSProperties => ({
  fontFamily: '"Diatype Mono Variable", monospace',
  fontSize: "0.75rem",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  padding: "0.35rem 0.8rem",
  border: active ? "1px solid rgba(0,0,0,0.75)" : "1px solid rgba(0,0,0,0.15)",
  background: active ? "#171717" : "#fff",
  color: active ? "#fff" : "rgba(0,0,0,0.7)",
  borderRadius: "4px",
  cursor: "pointer",
});

export default function PerformancesView({
  performances,
}: {
  performances: PerformanceRow[];
}) {
  const [view, setView] = useState<ViewMode>("grid");

  return (
    <section style={{ marginBottom: "3rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "2rem",
          flexWrap: "wrap",
        }}
      >
        <h2
          style={{
            fontFamily: '"Diatype Variable", sans-serif',
            fontSize: "2rem",
            fontWeight: 700,
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          Performances
        </h2>
        <div style={{ display: "flex", gap: "0.5rem" }} role="group" aria-label="View performances as">
          {(["grid", "carousel", "list"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              aria-pressed={view === mode}
              style={toggleButtonStyle(view === mode)}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {view === "grid" && (
        <div className="perf-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2rem" }}>
          {performances.map((perf) => (
            <CardShell key={perf.id} perf={perf}>
              <Card perf={perf} />
            </CardShell>
          ))}
        </div>
      )}

      {view === "carousel" && (
        <div
          style={{
            display: "flex",
            gap: "2rem",
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            paddingBottom: "0.5rem",
          }}
        >
          {performances.map((perf) => (
            <div
              key={perf.id}
              style={{ flex: "0 0 320px", scrollSnapAlign: "start" }}
            >
              <CardShell perf={perf}>
                <Card perf={perf} />
              </CardShell>
            </div>
          ))}
        </div>
      )}

      {view === "list" && (
        <div>
          {performances.map((perf) => (
            <CardShell key={perf.id} perf={perf}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "1rem",
                  padding: "1rem 0.25rem",
                  borderTop: "1px solid rgba(0,0,0,0.15)",
                  flexWrap: "wrap",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: perf.color,
                    alignSelf: "center",
                    flexShrink: 0,
                  }}
                />
                <strong style={{ fontSize: "1rem", fontWeight: 500 }}>
                  {perf.name}
                </strong>
                <span
                  style={{
                    fontFamily: '"Diatype Mono Variable", monospace',
                    fontSize: "0.7rem",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "rgba(0,0,0,0.5)",
                  }}
                >
                  {perf.status}
                </span>
                <span style={{ fontSize: "0.9rem", color: "rgba(0,0,0,0.6)" }}>
                  {perf.location}
                </span>
                <span
                  style={{
                    fontFamily: '"Diatype Mono Variable", monospace',
                    fontSize: "0.85rem",
                    color: "rgba(0,0,0,0.5)",
                    marginLeft: "auto",
                  }}
                >
                  {perf.date ? formatDate(perf.date) : ""}
                </span>
              </div>
            </CardShell>
          ))}
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 900px) {
              .perf-grid { grid-template-columns: repeat(2, 1fr) !important; }
            }
            @media (max-width: 600px) {
              .perf-grid { grid-template-columns: 1fr !important; }
            }
          `,
        }}
      />
    </section>
  );
}
