import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import VotingPoemPair from "./VotingPoemPair";
import { MenuBar } from "@/components/desktop/Chrome";

export const dynamic = "force-dynamic";

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
  status: "upcoming" | "training" | "trained";
}

async function getThemeData(
  performanceSlug: string,
  themeSlug: string,
): Promise<{ performance: Performance; poems: Poem[] } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Theme page: Supabase not configured", {
      url: !!url,
      key: !!key,
    });
    return null;
  }
  const supabase = createClient(url, key, {
    db: { schema: "singulars" },
    global: {
      fetch: (u: RequestInfo | URL, o?: RequestInit) =>
        fetch(u, { ...o, cache: "no-store" as RequestCache }),
    },
  }) as unknown as SupabaseClient;

  const { data: performance, error: perfError } = await supabase
    .from("performances")
    .select("*")
    .eq("slug", performanceSlug)
    .single();

  if (perfError || !performance) {
    console.error("Theme page: performance not found", {
      performanceSlug,
      perfError,
    });
    return null;
  }

  const { data: poems, error: poemsError } = await supabase
    .from("poems")
    .select("*")
    .eq("performance_id", performance.id)
    .eq("theme_slug", themeSlug);

  if (poemsError || !poems || poems.length === 0) {
    console.error("Theme page: poems not found", {
      themeSlug,
      poemsError,
      poemCount: poems?.length,
    });
    return null;
  }

  return { performance, poems };
}

export default async function ThemeVotingPage({
  params,
}: {
  params: { slug: string; themeSlug: string };
}) {
  const data = await getThemeData(params.slug, params.themeSlug);

  if (!data) {
    notFound();
  }

  const { performance, poems } = data;
  const themeName = poems[0]?.theme || params.themeSlug;

  return (
    <>
      <MenuBar
        menu={[
          { href: "/singulars/", label: "singulars" },
          { href: `/singulars/${performance.slug}`, label: performance.name },
        ]}
      />
      <main className="desk" data-performance-color={performance.color}>
        {/* the theme */}
        <section className="win w--five">
          <div className="win__bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <h2 className="win__t">{params.themeSlug}.txt</h2>
            <span className="win__meta">{performance.status}</span>
          </div>
          <div className="win__b">
            <p className="k">
              <i
                className="cdot"
                style={{ ["--c" as string]: performance.color }}
              />{" "}
              theme &middot; {performance.name}
            </p>
            <h1 className="disp">{themeName}</h1>
            {performance.status === "trained" && (
              <p className="note">Training is closed. Vote counts are final.</p>
            )}
            {performance.status === "upcoming" && (
              <p className="note">Voting has not begun.</p>
            )}
          </div>
        </section>

        {/* the duel */}
        <section className="win w--seven">
          <div className="win__bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <h2 className="win__t">duel.txt</h2>
            <span className="win__meta">{poems.length} poems</span>
          </div>
          <div className="win__b">
            {/* Interactive voting pair. "Read more about the piece" points to
                the performance page's about section (which auto-expands on
                #about). */}
            <VotingPoemPair
              poems={poems}
              performanceColor={performance.color}
              performanceStatus={performance.status}
              aboutHref={`/${performance.slug}#about`}
            />
          </div>
        </section>
      </main>
    </>
  );
}
