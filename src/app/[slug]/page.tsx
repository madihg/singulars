import Link from "next/link";
import { getServiceClient, getSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { accessibleTextColor, getStatusPillStyle } from "@/lib/color-utils";
import {
  hasDescription,
  getPerformanceDescription,
  heroImgSrc,
  HERO_IMAGES,
  getPerformanceHeroImage,
} from "@/lib/performance-descriptions";
import CollapsibleDescription from "@/components/CollapsibleDescription";
import VotingPoemPair from "./[themeSlug]/VotingPoemPair";

export const dynamic = "force-dynamic";

/** The currently-live (training) performance, for the "vote on the live one"
 *  note shown when previewing a closed/trained performance. */
async function getLiveTrainingSlug(): Promise<string | null> {
  const supabase = getServiceClient() || getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from("performances")
    .select("slug")
    .eq("status", "training")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.slug ?? null;
}

interface Poem {
  id: string;
  performance_id: string;
  theme: string;
  theme_slug: string;
  text: string;
  author_name: string;
  author_type: "human" | "machine";
  vote_count: number;
  created_at: string;
}

interface Performance {
  id: string;
  name: string;
  slug: string;
  color: string;
  location: string;
  date: string;
  num_poems: number;
  num_poets: number;
  model_link: string | null;
  huggingface_link: string | null;
  status: "upcoming" | "training" | "trained";
  poets: string[];
  created_at: string;
  poems: Poem[];
}

interface ThemeGroup {
  theme: string;
  theme_slug: string;
  poems: Poem[];
}

async function getPerformance(slug: string): Promise<Performance | null> {
  const supabase = getServiceClient() || getSupabase();
  if (!supabase) return null;

  const { data: performance, error: perfError } = await supabase
    .from("performances")
    .select("*")
    .eq("slug", slug)
    .single();

  if (perfError || !performance) return null;

  const { data: poems, error: poemsError } = await supabase
    .from("poems")
    .select("*")
    .eq("performance_id", performance.id)
    .order("theme_slug", { ascending: true });

  if (poemsError) return null;

  return { ...performance, poems: poems || [] };
}

function groupByTheme(poems: Poem[]): ThemeGroup[] {
  const themeMap = new Map<string, ThemeGroup>();
  for (const poem of poems) {
    if (!themeMap.has(poem.theme_slug)) {
      themeMap.set(poem.theme_slug, {
        theme: poem.theme,
        theme_slug: poem.theme_slug,
        poems: [],
      });
    }
    themeMap.get(poem.theme_slug)!.poems.push(poem);
  }
  return Array.from(themeMap.values());
}

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

export default async function PerformancePage({
  params,
}: {
  params: { slug: string };
}) {
  const [performance, liveTrainingSlug] = await Promise.all([
    getPerformance(params.slug),
    getLiveTrainingSlug(),
  ]);

  if (!performance) {
    notFound();
  }

  const themes = groupByTheme(performance.poems);
  const a11yColor = accessibleTextColor(performance.color);

  const cssVars = {
    "--performance-color": performance.color,
    "--performance-color-light": performance.color + "20",
    "--performance-color-a11y": a11yColor,
  } as React.CSSProperties;

  // Upcoming performances
  if (performance.status === "upcoming") {
    return (
      <main
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          padding: "4rem 2rem",
          cursor: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><circle cx='10' cy='10' r='8' fill='${encodeURIComponent(performance.color)}'/></svg>") 10 10, auto`,
          ...cssVars,
        }}
        data-performance-color={performance.color}
        data-status="upcoming"
      >
        <nav style={{ marginBottom: "2rem" }}>
          <Link
            href="/"
            style={{
              color: "rgba(0,0,0,0.6)",
              fontSize: "0.9rem",
            }}
          >
            &larr; Back to Singulars
          </Link>
        </nav>

        <div style={{ textAlign: "center", padding: "4rem 0" }}>
          <h1
            style={{
              fontFamily: '"Terminal Grotesque", sans-serif',
              fontSize: "4rem",
              lineHeight: 0.9,
              marginBottom: "1.5rem",
              fontWeight: 400,
              color: a11yColor,
            }}
          >
            {performance.name}
          </h1>

          <span
            style={{
              display: "inline-block",
              fontFamily: '"Diatype Mono Variable", monospace',
              fontSize: "0.7rem",
              letterSpacing: "0.03em",
              padding: "0.2rem 0.6rem",
              border: "1px solid rgba(0,0,0,0.25)",
              color: "rgba(0,0,0,0.5)",
              marginBottom: "2rem",
            }}
          >
            upcoming
          </span>

          {performance.location && (
            <p
              style={{
                fontSize: "1rem",
                color: "rgba(0,0,0,0.6)",
                marginBottom: "0.5rem",
              }}
            >
              {performance.location}
            </p>
          )}

          <p
            style={{
              fontFamily: '"Diatype Mono Variable", monospace',
              fontSize: "0.9rem",
              color: "rgba(0,0,0,0.5)",
              marginBottom: "2rem",
            }}
          >
            {formatDate(performance.date)}
          </p>

          <p
            style={{
              fontSize: "1rem",
              color: "rgba(0,0,0,0.5)",
              lineHeight: 1.4,
              maxWidth: "500px",
              margin: "0 auto",
            }}
          >
            This performance has not taken place yet. Check back after the event
            for poems and voting.
          </p>
        </div>
      </main>
    );
  }

  const heroImg =
    getPerformanceHeroImage(performance.slug) ?? HERO_IMAGES.landing;
  const isHeroLogo =
    heroImg.src.endsWith(".svg") || heroImg.src.includes("currents-logo");

  return (
    <main
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "4rem 2rem",
        cursor: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><circle cx='10' cy='10' r='8' fill='${encodeURIComponent(performance.color)}'/></svg>") 10 10, auto`,
        ...cssVars,
      }}
      data-performance-color={performance.color}
    >
      <nav style={{ marginBottom: "2rem" }}>
        <Link
          href="/"
          style={{
            color: "rgba(0,0,0,0.6)",
            fontSize: "0.9rem",
          }}
        >
          &larr; Back to Singulars
        </Link>
      </nav>

      {/* Hero image - same aspect ratio as landing for alignment */}
      <div
        style={{
          width: "100%",
          aspectRatio: "16/9",
          marginBottom: "2rem",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <img
          src={heroImgSrc(heroImg)}
          alt={heroImg.alt}
          style={{
            width: "100%",
            height: "100%",
            objectFit: isHeroLogo ? "contain" : "cover",
            display: "block",
            background: isHeroLogo ? "#fff" : undefined,
          }}
        />
      </div>

      {/* Performance header */}
      <header style={{ marginBottom: "3rem" }}>
        <h1
          style={{
            fontFamily: '"Terminal Grotesque", sans-serif',
            fontSize: "4rem",
            lineHeight: 0.9,
            marginBottom: "1rem",
            fontWeight: 400,
            color: a11yColor,
          }}
        >
          {performance.name}
        </h1>
        <p
          style={{
            fontSize: "1rem",
            color: "rgba(0,0,0,0.6)",
            marginBottom: "0.25rem",
          }}
        >
          {performance.location}
        </p>
        <p
          style={{
            fontFamily: '"Diatype Mono Variable", monospace',
            fontSize: "0.9rem",
            color: "rgba(0,0,0,0.5)",
            marginBottom: "1rem",
          }}
        >
          {formatDate(performance.date)}
        </p>

        {/* Status pill */}
        {(() => {
          const pill = getStatusPillStyle(performance.status);
          return (
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
                marginBottom: "1rem",
              }}
            >
              {performance.status}
            </span>
          );
        })()}

        {/* Stats */}
        {themes.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: "1.5rem",
              fontFamily: '"Diatype Mono Variable", monospace',
              fontSize: "0.85rem",
              color: "rgba(0,0,0,0.5)",
              marginBottom: "1rem",
            }}
          >
            <span>{performance.poems.length} poems (training data)</span>
            <span>
              {themes.reduce(
                (sum, t) =>
                  sum + t.poems.reduce((s, p) => s + (p.vote_count ?? 0), 0),
                0,
              )}{" "}
              total votes
            </span>
          </div>
        )}

        {/* Links */}
        {(performance.model_link || performance.huggingface_link) && (
          <div style={{ display: "flex", gap: "1.5rem" }}>
            {performance.model_link && (
              <a
                href={performance.model_link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "rgba(0,0,0,0.6)", fontSize: "0.9rem" }}
              >
                Duelling Model
              </a>
            )}
            {performance.huggingface_link && (
              <a
                href={performance.huggingface_link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "rgba(0,0,0,0.6)", fontSize: "0.9rem" }}
              >
                Training Data (HuggingFace)
              </a>
            )}
          </div>
        )}

        {hasDescription(performance.slug) && (
          <div
            style={{
              marginTop: "1.25rem",
              display: "flex",
              gap: "1.25rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <a
              href="#themes"
              style={{
                fontFamily: '"Diatype Mono Variable", monospace',
                fontSize: "0.85rem",
                color: a11yColor,
                textDecoration: "none",
                padding: "0.45rem 0.9rem",
                border: `1px solid ${performance.color}`,
                background: "transparent",
                letterSpacing: "0.03em",
              }}
            >
              read the poems ↓
            </a>
          </div>
        )}
      </header>

      <hr />

      {/* Scraped content (images, paragraphs, galleries) — collapsible.
          Default expanded for SEO/a11y; returning visitors can collapse to
          skip past it. Jump anchor above scrolls directly to #themes. */}
      {hasDescription(performance.slug) &&
        (() => {
          const desc = getPerformanceDescription(performance.slug);
          return desc ? (
            <CollapsibleDescription
              content={desc.content}
              performanceColor={performance.color}
              a11yColor={a11yColor}
              defaultOpen={false}
              id="about"
            />
          ) : null;
        })()}

      {hasDescription(performance.slug) && <hr />}

      {/* Theme cards with poems */}
      <section id="themes" style={{ scrollMarginTop: "1.5rem" }}>
        <h2
          style={{
            fontFamily: '"Diatype Variable", sans-serif',
            fontSize: "2rem",
            fontWeight: 700,
            marginBottom: "2rem",
            lineHeight: 1.2,
          }}
        >
          Themes
        </h2>
        {themes.map((themeGroup) => (
          <div
            key={themeGroup.theme_slug}
            style={{
              marginBottom: "3rem",
              borderLeft: `2px solid ${performance.color}`,
              paddingLeft: "1.5rem",
            }}
          >
            <h3
              style={{
                fontSize: "1.3rem",
                fontWeight: 500,
                marginBottom: "1.5rem",
                lineHeight: 1.2,
                color: a11yColor,
              }}
            >
              {themeGroup.theme}
            </h3>

            {/* Vote right here on the performance page (the QR target). The
                pair total shows before voting; the split + undo after. */}
            <VotingPoemPair
              poems={themeGroup.poems}
              performanceColor={performance.color}
              performanceStatus={performance.status}
              aboutHref={hasDescription(performance.slug) ? "#about" : `/${performance.slug}`}
              livePerfSlug={liveTrainingSlug}
            />
          </div>
        ))}
      </section>
    </main>
  );
}
