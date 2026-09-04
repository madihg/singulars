"use client";

/**
 * vote.exe on the landing desk: one theme pulled from the performance
 * currently in training (or the last finished one), its two poems side by side,
 * and a vote. Choosing a poem and submitting sends the visitor to that theme's
 * own page, where the result lives.
 *
 * The window is named for what a visitor can do in it, and each poem carries a
 * pick line, so the two blocks of text read as the two things you choose
 * between rather than as something to read past.
 *
 * The fetch paths, the fingerprint and the vote contract are untouched by the
 * reskin: only the markup moved to the Desktop vocabulary.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getFingerprint } from "@/lib/fingerprint";

interface Poem {
  id: string;
  performance_id: string;
  theme: string;
  theme_slug: string;
  text: string;
  author_name: string;
  author_type: "human" | "machine";
  vote_count: number;
}

interface Performance {
  id: string;
  name: string;
  slug: string;
  color: string;
  status: "upcoming" | "training" | "trained";
}

interface ThemeData {
  performance: Performance;
  poems: Poem[];
}

function Shell({
  children,
  meta,
}: {
  children: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <section className="win w--seven" id="duel" data-testid="mini-voting">
      <div className="win__bar">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        <h2 className="win__t">vote.exe</h2>
        {meta ? <span className="win__meta">{meta}</span> : null}
      </div>
      <div className="win__b">{children}</div>
    </section>
  );
}

export default function MiniVoting() {
  const router = useRouter();
  const [themeData, setThemeData] = useState<ThemeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPoemId, setSelectedPoemId] = useState<string | null>(null);

  // Fetch a random theme from whichever performance is currently `training`.
  // Falls back to the most recent `trained` performance if no training perf
  // exists (so the widget always has something to show between shows).
  useEffect(() => {
    async function fetchRandomTheme() {
      try {
        const listRes = await fetch("/singulars/api/performances");
        if (!listRes.ok) {
          throw new Error("Failed to fetch performances list");
        }
        const performances: Array<{
          slug: string;
          status: "upcoming" | "training" | "trained";
          date: string;
        }> = await listRes.json();

        // Candidate order: the live (training) perf first, then trained by
        // date desc. We try each until we find one that actually HAS poems -
        // a training perf with no poems yet (pre-show) must NOT crash the
        // widget; it should fall back to the latest finished duel.
        const candidates = [
          ...performances.filter((p) => p.status === "training"),
          ...performances
            .filter((p) => p.status === "trained")
            .sort((a, b) => (b.date || "").localeCompare(a.date || "")),
        ];

        let data: {
          id: string;
          name: string;
          slug: string;
          color: string;
          status: Performance["status"];
          poems: Poem[];
        } | null = null;
        for (const cand of candidates) {
          const res = await fetch(`/singulars/api/performances/${cand.slug}`);
          if (!res.ok) continue;
          const d = await res.json();
          if (Array.isArray(d.poems) && d.poems.length > 0) {
            data = d;
            break;
          }
        }

        if (!data) {
          throw new Error("No performance with poems available");
        }

        // Group poems by theme
        const themeMap = new Map<string, Poem[]>();
        for (const poem of data.poems) {
          const existing = themeMap.get(poem.theme_slug) || [];
          existing.push(poem);
          themeMap.set(poem.theme_slug, existing);
        }

        // Pick a random theme
        const themes = Array.from(themeMap.entries());
        const randomIdx = Math.floor(Math.random() * themes.length);
        const [, poems] = themes[randomIdx];

        setThemeData({
          performance: {
            id: data.id,
            name: data.name,
            slug: data.slug,
            color: data.color,
            status: data.status,
          },
          poems,
        });
      } catch (err) {
        console.error("MiniVoting fetch error:", err);
        setError("Could not load a duel.");
      } finally {
        setLoading(false);
      }
    }

    fetchRandomTheme();
  }, []);

  const handleSelect = useCallback(
    (poemId: string) => {
      if (voting) return;
      setSelectedPoemId((prev) => (prev === poemId ? null : poemId));
    },
    [voting],
  );

  const handleSubmit = useCallback(async () => {
    if (voting || !themeData || !selectedPoemId) return;
    setVoting(true);

    try {
      const fingerprint = await getFingerprint();

      const res = await fetch("/singulars/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poem_id: selectedPoemId, fingerprint }),
      });

      if (!res.ok && res.status !== 429) {
        throw new Error("Vote request failed");
      }

      // Navigate to the post-vote / theme page
      const themeSlug = themeData.poems[0]?.theme_slug;
      router.push(`/${themeData.performance.slug}/${themeSlug}`);
    } catch (err) {
      console.error("Vote error:", err);
      setError("The vote did not register. Try again.");
      setVoting(false);
    }
  }, [voting, themeData, selectedPoemId, router]);

  if (loading) {
    return (
      <Shell>
        <p className="note" style={{ margin: 0 }}>
          Loading a duel.
        </p>
      </Shell>
    );
  }

  if (error || !themeData) {
    return (
      <Shell>
        <p className="note" style={{ margin: 0 }}>
          {error || "Could not load a duel."}
        </p>
      </Shell>
    );
  }

  const { performance, poems } = themeData;
  const themeName = poems[0]?.theme || "";

  return (
    <Shell
      meta={
        <span data-testid="mini-voting-performance">{performance.name}</span>
      }
    >
      <p className="k" data-testid="mini-voting-status">
        theme &middot; <span data-state={performance.status}>{performance.status}</span>
      </p>
      <h3 className="h2" data-testid="mini-voting-theme">
        {themeName}
      </h3>
      <p className="note">
        You can vote here. One poem is by a human, one is by a machine, and you
        are not told which. Pick the one you prefer, then submit your vote.
      </p>

      <div className="sg-duel" data-testid="mini-voting-poems">
        {poems.map((poem) => {
          const isSelected = selectedPoemId === poem.id;
          return (
            <button
              key={poem.id}
              type="button"
              className="sg-poem"
              data-testid={`mini-voting-poem-${poem.author_type}`}
              data-poem-id={poem.id}
              data-voteable="true"
              onClick={() => handleSelect(poem.id)}
              aria-label="vote for this poem"
              aria-pressed={isSelected}
              style={{
                opacity: voting ? 0.7 : selectedPoemId && !isSelected ? 0.55 : 1,
              }}
            >
              {/* No author labels: the vote stays blind. */}
              <p className="sg-poem__t">{poem.text}</p>
              <span className="sg-poem__pick">
                {isSelected ? "chosen" : "vote for this one"}
              </span>
            </button>
          );
        })}
      </div>

      {selectedPoemId && !voting && (
        <div className="sg-row sg-row--end" style={{ marginTop: "1rem" }}>
          <button type="button" className="btn btn--send" onClick={handleSubmit}>
            submit my vote
          </button>
        </div>
      )}

      {voting && (
        <p className="k" style={{ marginTop: "1rem" }}>
          recording your vote
        </p>
      )}
    </Shell>
  );
}
