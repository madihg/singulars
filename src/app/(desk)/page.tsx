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
import { MenuBar, CONNECT_URL } from "@/components/desktop/Chrome";

/*
 * The Singulars landing desk.
 *
 * One page, arranged as windows on the dotted ground: what the series is, the
 * still, the tools, the performances, a duel you can vote in, the poets, the
 * reading, and the way to start a conversation. About is folded in here;
 * /about redirects.
 */

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

const TOOLS = [
  { href: "/chat", label: "chat with the models" },
  { href: "/evolution", label: "machine over time" },
  { href: "/theme-voting", label: "theme voting" },
  { href: "/timer", label: "performance timer" },
];

const MENU = [
  { href: "#about", label: "about" },
  { href: "#performances", label: "performances" },
  { href: "#duel", label: "duel" },
  { href: "#poets", label: "poets" },
  { href: "#reading", label: "reading" },
];

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

export default async function SingularsPage() {
  const performances = await getPerformances();

  return (
    <>
      <MenuBar menu={MENU} />
      <main className="desk">
        {/* the title window */}
        <section className="win w--seven" id="about">
          <div className="win__bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <h2 className="win__t">singulars.txt</h2>
          </div>
          <div className="win__b">
            <p className="k">machine poetry &middot; singulars</p>
            <h1 className="disp">Singulars</h1>
            <p className="sub">Human and machine poetry performances.</p>
            <div className="rule" />
            <p className="prose">
              Singulars is a series of live poetry performances where a human
              poet duels a machine. Each performance pits original human poems
              against machine-written counterparts on shared themes, and the
              audience votes to decide the winner. Those votes train the machine
              for the next performance.
            </p>
            <p className="prose">
              The question underneath is whether a language model can write like
              a poet, and whether a room can tell. Each show answers it in
              public. It is artisanal RLHF: a feedback loop between human taste
              and machine output.
            </p>
            <p className="prose">
              Halim Madi is a poet and performer who works where language meets
              software. He created Singulars and is the human in each duel,
              writing against a machine trained on the poems the audience keeps
              choosing.
            </p>
          </div>
        </section>

        {/* the still */}
        <section className="win w--five w--offset">
          <div className="win__bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <h2 className="win__t">reinforcement.jpg</h2>
          </div>
          <div className="win__b">
            <div className="sg-hero">
              <img
                src={heroImgSrc(HERO_IMAGES.landing)}
                alt={HERO_IMAGES.landing.alt}
                width={1600}
                height={900}
                /* the hero is the largest paint above the fold: never deferred */
                loading="eager"
                decoding="async"
              />
            </div>
            <p className="k" style={{ marginTop: "0.55rem" }}>
              reinforcement.exe &middot; buenos aires
            </p>
          </div>
        </section>

        {/* the tools */}
        <section className="win">
          <div className="win__bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <h2 className="win__t">tools/</h2>
            <span className="win__meta">{TOOLS.length} open</span>
          </div>
          <div className="win__b">
            <div className="sg-scroll">
              {TOOLS.map((tool) => (
                <Link key={tool.href} href={tool.href} className="btn">
                  {tool.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

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

        <MiniVoting />

        {/* the reading, beside the duel */}
        <section className="win w--five w--offset" id="reading">
          <div className="win__bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <h2 className="win__t">reading/</h2>
            <span className="win__meta">{substackCards.length} pieces</span>
          </div>
          <div className="win__b">
            {substackCards.map((card) => (
              <a
                key={card.url}
                href={card.url}
                target="_blank"
                rel="noopener noreferrer"
                className="sg-line sg-line--2"
              >
                <span className="sg-line__n">{card.title}</span>
                <span className="fr__d">read &#x2197;</span>
                <span className="fr__w">{card.subtitle}</span>
              </a>
            ))}
          </div>
        </section>

        <Poets />

        {/* the enquiry */}
        <section className="win w--five" id="enquire">
          <div className="win__bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <h2 className="win__t">enquire.txt</h2>
          </div>
          <div className="win__b">
            <p className="prose">
              Singulars travels. If you run a festival, a venue, a lab or a
              conference and want the duel in your room, write to me.
            </p>
            <a className="btn btn--send" href={CONNECT_URL}>
              start a conversation
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
