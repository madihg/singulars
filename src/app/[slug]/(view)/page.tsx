import Link from "next/link";
import { getServiceClient, getSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import {
  hasDescription,
  getPerformanceDescription,
  heroImgSrc,
  HERO_IMAGES,
  getPerformanceHeroImage,
} from "@/lib/performance-descriptions";
import CollapsibleDescription from "@/components/CollapsibleDescription";
import ImageLightbox from "@/components/ImageLightbox";
import VotingPoemPair from "./[themeSlug]/VotingPoemPair";
import { getModelByPerformanceSlug } from "@/lib/models";
import { MenuBar } from "@/components/desktop/Chrome";

export const dynamic = "force-dynamic";

/*
 * One performance, as a desk: the title window, the still, the description,
 * and the poems as a ledger. Each theme is a .file row; opening it reveals the
 * duel and the vote. The performance's own colour survives as the small mark
 * (.cdot) beside its name and on the vote dots; everything else is the Desktop
 * accent.
 */

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
  const chatModel = getModelByPerformanceSlug(performance.slug);
  const totalVotes = themes.reduce(
    (sum, t) => sum + t.poems.reduce((s, p) => s + (p.vote_count ?? 0), 0),
    0,
  );

  const menu = [
    { href: "/singulars/", label: "singulars" },
    ...(hasDescription(performance.slug)
      ? [{ href: "#about", label: "about" }]
      : []),
    ...(performance.status === "upcoming"
      ? []
      : [{ href: "#themes", label: "poems" }]),
  ];

  // Upcoming performances: the title window and nothing to vote on yet.
  if (performance.status === "upcoming") {
    return (
      <>
        <MenuBar menu={menu} />
        <main className="desk" data-status="upcoming">
          <section className="win w--seven">
            <div className="win__bar">
              <span className="dots">
                <i />
                <i />
                <i />
              </span>
              <h2 className="win__t">{performance.slug}.txt</h2>
              <span className="win__meta">upcoming</span>
            </div>
            <div className="win__b">
              <p className="k">
                <i
                  className="cdot"
                  style={{ ["--c" as string]: performance.color }}
                />{" "}
                performance &middot; upcoming
              </p>
              <h1 className="disp">{performance.name}</h1>
              {performance.location && (
                <p className="sub">{performance.location}</p>
              )}
              <p className="sg-meta">
                <span>{formatDate(performance.date)}</span>
              </p>
              <div className="rule" />
              <p className="prose">
                This performance has not taken place yet. Poems and voting
                appear here after the event.
              </p>
            </div>
          </section>
        </main>
      </>
    );
  }

  const heroImg =
    getPerformanceHeroImage(performance.slug) ?? HERO_IMAGES.landing;
  const isHeroLogo =
    heroImg.src.endsWith(".svg") || heroImg.src.includes("currents-logo");

  return (
    <>
      <MenuBar menu={menu} />
      <main className="desk" data-performance-color={performance.color}>
        {/* the title window */}
        <section className="win w--seven">
          <div className="win__bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <h2 className="win__t">{performance.slug}.txt</h2>
            <span className="win__meta">{performance.status}</span>
          </div>
          <div className="win__b">
            <p className="k">
              <i
                className="cdot"
                style={{ ["--c" as string]: performance.color }}
              />{" "}
              performance &middot; {performance.status}
            </p>
            <h1 className="disp">{performance.name}</h1>
            {performance.location && <p className="sub">{performance.location}</p>}
            <p className="sg-meta">
              <span>{formatDate(performance.date)}</span>
              {themes.length > 0 && (
                <>
                  <span>{performance.poems.length} poems</span>
                  <span>
                    {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
                  </span>
                </>
              )}
            </p>
            <div className="rule" />
            <div className="sg-row">
              {themes.length > 0 && (
                <a className="btn" href="#themes">
                  read the poems &darr;
                </a>
              )}
              {chatModel && (
                /* A plain <a>, so it carries the basePath prefix itself. */
                <a className="btn" href={`/singulars/chat?model=${chatModel.slug}`}>
                  {chatModel.status === "training"
                    ? "meet the model →"
                    : "chat with the model →"}
                </a>
              )}
              {performance.model_link && (
                <a
                  className="btn"
                  href={performance.model_link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  duelling model &#x2197;
                </a>
              )}
              {performance.huggingface_link && (
                <a
                  className="btn"
                  href={performance.huggingface_link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  training data &#x2197;
                </a>
              )}
            </div>
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
            <h2 className="win__t">{performance.slug}.jpg</h2>
          </div>
          <div className="win__b">
            <div className="sg-hero">
              <img
                src={heroImgSrc(heroImg)}
                alt={heroImg.alt}
                width={1600}
                height={900}
                /* the hero is the largest paint above the fold: never deferred */
                loading="eager"
                decoding="async"
                data-lightbox=""
                role="button"
                tabIndex={0}
                style={
                  isHeroLogo
                    ? { objectFit: "contain", background: "var(--paper)" }
                    : undefined
                }
              />
            </div>
          </div>
        </section>

        {/* the description */}
        {hasDescription(performance.slug) &&
          (() => {
            const desc = getPerformanceDescription(performance.slug);
            return desc ? (
              <CollapsibleDescription
                content={desc.content}
                performanceColor={performance.color}
                a11yColor={performance.color}
                defaultOpen={false}
                id="about"
              />
            ) : null;
          })()}

        {/* the poems, as a ledger */}
        <section className="win w--eight" id="themes">
          <div className="win__bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <h2 className="win__t">poems/</h2>
            <span className="win__meta">
              {themes.length} {themes.length === 1 ? "theme" : "themes"}
            </span>
          </div>
          <div className="win__b">
            {themes.length === 0 && (
              <p className="note" style={{ marginTop: 0 }}>
                {performance.status === "training"
                  ? "The poems appear here during the performance. Once both poems land, you can read them and vote."
                  : "Poems for this performance are not posted yet."}
              </p>
            )}

            {themes.length > 0 && (
              <div className="hdr">
                <span className="k">theme</span>
                <span className="k">votes</span>
                <span className="k" />
                <span className="k">open</span>
              </div>
            )}

            {themes.map((themeGroup) => {
              const votes = themeGroup.poems.reduce(
                (s, p) => s + (p.vote_count ?? 0),
                0,
              );
              return (
                <details
                  className="file"
                  key={themeGroup.theme_slug}
                  id={themeGroup.theme_slug}
                >
                  <summary>
                    <span className="fr__n">
                      <i className="tri" aria-hidden="true" />
                      <i
                        className="cdot"
                        style={{ ["--c" as string]: performance.color }}
                      />
                      {themeGroup.theme}
                    </span>
                    <span className="fr__s">
                      {votes} {votes === 1 ? "vote" : "votes"}
                    </span>
                    <span className="fr__w" />
                    <span className="fr__d">read &amp; vote</span>
                  </summary>
                  <div className="fr__b">
                    <p className="k" style={{ marginBottom: "0.6rem" }}>
                      <Link href={`/${performance.slug}/${themeGroup.theme_slug}`}>
                        open this theme on its own page &rarr;
                      </Link>
                    </p>
                    <VotingPoemPair
                      poems={themeGroup.poems}
                      performanceColor={performance.color}
                      performanceStatus={performance.status}
                      aboutHref={
                        hasDescription(performance.slug)
                          ? "#about"
                          : `/${performance.slug}`
                      }
                      livePerfSlug={liveTrainingSlug}
                    />
                  </div>
                </details>
              );
            })}
          </div>
        </section>

        {/* Click any image on this page to open it full-screen and arrow
            through the rest. Discovers images via data-lightbox. */}
        <ImageLightbox accent={performance.color} />
      </main>
    </>
  );
}
