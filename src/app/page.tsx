import Link from "next/link";
import { getServiceClient, getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
import MiniVoting from "@/components/MiniVoting";
import EvolutionThumbnail from "@/components/EvolutionThumbnail";
import Poets from "@/components/Poets";
import PerformancesView, {
  type PerformanceRow,
} from "@/components/PerformancesView";
import { heroImgSrc, HERO_IMAGES } from "@/lib/performance-descriptions";

/*
 * One-page Singulars (Saf session 2, Aug 31 2026):
 * - About folded in: the blurb lives in the first paragraphs, /about
 *   now redirects here. No "Learn more about it" click-out.
 * - Halim's bio near the top, with a "Start a conversation" CTA that
 *   points at the enquiry form (staging URL for now - flip to the
 *   production form at promotion).
 * - Tool chips on one line. Performances browsable as grid, carousel,
 *   or list. MiniVoting and Further Reading move to the bottom.
 * - "A project by Halim Madi" link removed: this page is moving under
 *   halimmadi.com, so it no longer needs to link back out.
 */

// Flip to the production form URL when the site moves under
// halimmadi.com/singulars.
const ENQUIRY_URL = "https://www.halimmadi.com/#enquire";

interface Performance extends PerformanceRow {
  num_poems: number;
  num_poets: number;
  model_link: string | null;
  huggingface_link: string | null;
  poets: string[];
  created_at: string;
}

async function getPerformances(): Promise<Performance[]> {
  const supabase = getServiceClient() || getSupabase();
  if (!supabase) return [];

  const { data: performances, error } = await supabase
    .from("performances")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching performances:", error);
    return [];
  }

  return performances || [];
}

const substackCards = [
  {
    title: "Lessons Learned Inside a Poetry Cage in Buenos Aires",
    subtitle:
      "Notes from a performance where an audience became the training loop.",
    url: "https://halimmadi.substack.com/p/what-i-learned-inside-a-poetry-cage",
  },
  {
    title: "Eat.exe",
    subtitle: "Drawing a Latent Future with Electric Lines of Desire",
    url: "https://secondvoice.substack.com/p/eatexe",
  },
];

const chipStyle: React.CSSProperties = {
  fontFamily: '"Diatype Mono Variable", monospace',
  fontSize: "0.85rem",
  color: "rgba(0,0,0,0.85)",
  padding: "0.5rem 1rem",
  border: "1px solid rgba(0,0,0,0.15)",
  borderRadius: "6px",
  textDecoration: "none",
  transition: "border-color 0.2s ease",
  whiteSpace: "nowrap",
};

export default async function SingularsPage() {
  const performances = await getPerformances();

  return (
    <main style={{ maxWidth: "800px", margin: "0 auto", padding: "4rem 2rem" }}>
      {/* Header */}
      <h1
        style={{
          fontFamily: '"Terminal Grotesque", sans-serif',
          fontSize: "7rem",
          lineHeight: 0.9,
          marginBottom: "1rem",
          fontWeight: 400,
        }}
      >
        Singulars
      </h1>
      <p
        style={{
          fontFamily: '"Diatype Mono Variable", monospace',
          fontSize: "1rem",
          color: "rgba(0,0,0,0.6)",
          marginBottom: "1.5rem",
          lineHeight: 1.4,
        }}
      >
        Human vs Machine Poetry Performances
      </p>

      {/* Intro - the About blurb, folded in. Everything on one page. */}
      <section
        style={{
          fontSize: "1rem",
          color: "rgba(0,0,0,0.85)",
          lineHeight: 1.5,
          marginBottom: "1.5rem",
        }}
      >
        <p style={{ marginBottom: "1rem" }}>
          Singulars is a series of live poetry performances where a human poet
          duels a machine. Each performance pits original human poems against
          AI-generated counterparts on shared themes, and the audience votes to
          decide the winner. Those votes train the machine for the next
          performance.
        </p>
        <p style={{ marginBottom: "1rem" }}>
          The project explores the boundary between human creativity and
          machine generation. Can a language model capture the nuance, emotion,
          and craft of a human poet? Can an audience tell the difference?
          Singulars puts these questions to the test in a live, participatory
          format - a form of artisanal RLHF, a feedback loop between human
          taste and machine output.
        </p>
        <p style={{ marginBottom: 0 }}>
          Halim Madi is a poet and performer who works where language meets
          software. He created Singulars and is the human in each duel, writing
          against a machine trained on the poems the audience keeps choosing.
        </p>
      </section>

      {/* CTA - the desk is one click away, high on the page. */}
      <p style={{ marginBottom: "2rem" }}>
        <a
          href={ENQUIRY_URL}
          style={{
            fontFamily: '"Diatype Mono Variable", monospace',
            fontSize: "0.85rem",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "#1C39E8",
            textDecoration: "none",
            borderBottom: "1px solid #1C39E8",
            paddingBottom: "2px",
          }}
        >
          Start a conversation &rarr;
        </a>
      </p>

      {/* Tool chips - one line, scrolls sideways on small screens. */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "2rem",
          flexWrap: "nowrap",
          overflowX: "auto",
          paddingBottom: "0.25rem",
        }}
      >
        <Link href="/chat" style={chipStyle}>
          Chat with the Models &rarr;
        </Link>
        <Link href="/evolution" style={chipStyle}>
          Machine vs Me Over Time &rarr;
        </Link>
        <Link href="/theme-voting" style={chipStyle}>
          Theme Voting &rarr;
        </Link>
        <Link href="/timer" style={chipStyle}>
          Performance Timer &rarr;
        </Link>
      </div>

      {/* Hero image - B&W by default, color + green cursor on hover */}
      <div
        className="hero-image-container"
        style={{
          width: "100%",
          aspectRatio: "16/9",
          marginBottom: "2rem",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <img
          src={heroImgSrc(HERO_IMAGES.landing)}
          alt={HERO_IMAGES.landing.alt}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>

      {/* Performances - up top, browsable three ways. */}
      <PerformancesView
        performances={performances.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          color: p.color,
          location: p.location,
          date: p.date,
          status: p.status,
        }))}
      />

      {/* Optional evolution thumbnail (US-118). Renders nothing unless
         NEXT_PUBLIC_SHOW_EVOLUTION_ON_LANDING=true. */}
      <EvolutionThumbnail />

      <hr
        style={{
          border: "none",
          borderTop: "2px solid #171717",
          margin: "3rem 0",
        }}
      />

      {/* Mini-voting - try the duel for yourself, near the bottom. */}
      <MiniVoting />

      <hr
        style={{
          border: "none",
          borderTop: "2px solid #171717",
          margin: "3rem 0",
        }}
      />

      {/* Participating poets - the humans who have dueled the machine. */}
      <Poets />

      <hr
        style={{
          border: "none",
          borderTop: "2px solid #171717",
          margin: "3rem 0",
        }}
      />

      {/* Further reading - from the old About page, now folded in. */}
      <section>
        <h2
          style={{
            fontFamily: '"Diatype Variable", sans-serif',
            fontSize: "2rem",
            fontWeight: 700,
            marginBottom: "2rem",
            lineHeight: 1.2,
          }}
        >
          Further Reading
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          {substackCards.map((card) => (
            <a
              key={card.url}
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                padding: "1.5rem 0",
                borderTop: "1px solid rgba(0,0,0,0.75)",
                color: "inherit",
                transition: "opacity 0.3s ease",
              }}
            >
              <h3
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 500,
                  marginBottom: "0.25rem",
                  lineHeight: 1.2,
                }}
              >
                {card.title}
              </h3>
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "rgba(0,0,0,0.6)",
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                {card.subtitle}
              </p>
            </a>
          ))}
        </div>
      </section>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 600px) {
              main > h1 {
                font-size: 4.5rem !important;
              }
            }
          `,
        }}
      />
    </main>
  );
}
