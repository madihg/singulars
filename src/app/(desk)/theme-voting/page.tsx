"use client";

import { useState, useEffect, useCallback } from "react";
import { MenuBar } from "@/components/desktop/Chrome";

interface Theme {
  id: string;
  content: string;
  theme_slug: string;
  votes: number;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export default function ThemeVotingPage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchThemes = useCallback(async () => {
    try {
      const res = await fetch("/singulars/api/themes");
      const json = await res.json();
      if (json.data) setThemes(json.data);
    } catch {
      // silently fail on load
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThemes();
  }, [fetchThemes]);

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || submitting) return;

    if (content.length > 50) {
      showMessage("A theme is 50 characters or less.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/singulars/api/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const json = await res.json();

      if (!res.ok) {
        showMessage(json.error || "The theme did not save.", "error");
        return;
      }

      setInput("");
      showMessage("Theme added.", "success");
      fetchThemes();
    } catch {
      showMessage("The theme did not save.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpvote = async (id: string) => {
    // Optimistic update
    setThemes((prev) =>
      prev
        .map((t) => (t.id === id ? { ...t, votes: t.votes + 1 } : t))
        .sort((a, b) => b.votes - a.votes),
    );

    try {
      const res = await fetch(`/singulars/api/themes/${id}/upvote`, { method: "POST" });
      if (!res.ok) {
        // Revert on failure
        fetchThemes();
      }
    } catch {
      fetchThemes();
    }
  };

  const activeThemes = themes.filter((t) => !t.completed);
  const completedThemes = themes.filter((t) => t.completed);

  return (
    <>
      <MenuBar
        menu={[
          { href: "/singulars/", label: "singulars" },
          { href: "#themes", label: "themes" },
        ]}
      />
      <main className="desk">
        {/* the ask */}
        <section className="win w--five">
          <div className="win__bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <h2 className="win__t">theme-voting.txt</h2>
          </div>
          <div className="win__b">
            <p className="k">machine poetry &middot; singulars</p>
            <h1 className="disp">Themes</h1>
            <p className="sub">
              Suggest what the poet and the machine write on next, and vote on
              what other people have suggested.
            </p>
            <div className="rule" />
            <form onSubmit={handleSubmit} className="sg-stack sg-stack--tight">
              <label className="dk-input">
                <span>your theme</span>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="a theme in a few words"
                  maxLength={50}
                  disabled={submitting}
                />
              </label>
              <div className="sg-row sg-row--between">
                <span className="k">{input.length}/50</span>
                <button
                  type="submit"
                  className="btn btn--send"
                  disabled={submitting || !input.trim()}
                >
                  {submitting ? "adding" : "add theme"}
                </button>
              </div>
            </form>
            {message && (
              <p
                className={message.type === "error" ? "sg-err" : "sg-ok"}
                role="status"
                aria-live="polite"
              >
                {message.text}
              </p>
            )}
          </div>
        </section>

        {/* the ledger */}
        <section className="win w--seven" id="themes">
          <div className="win__bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <h2 className="win__t">themes/</h2>
            <span className="win__meta">
              {activeThemes.length} open &middot; {completedThemes.length} done
            </span>
          </div>
          <div className="win__b">
            {loading && (
              <p className="note" style={{ marginTop: 0 }}>
                Loading.
              </p>
            )}
            {!loading && activeThemes.length === 0 && (
              <p className="note" style={{ marginTop: 0 }}>
                No themes yet. Add the first one.
              </p>
            )}
            {activeThemes.map((theme) => (
              <div className="sg-line sg-line--2" key={theme.id}>
                <span className="sg-line__n">{theme.content}</span>
                <span className="sg-line__a">
                  <span className="k">{theme.votes}</span>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleUpvote(theme.id)}
                    aria-label={`upvote ${theme.content}`}
                  >
                    upvote
                  </button>
                </span>
              </div>
            ))}

            {completedThemes.length > 0 && (
              <>
                <div className="rule" />
                <button
                  type="button"
                  className="btn"
                  aria-expanded={showCompleted}
                  onClick={() => setShowCompleted((v) => !v)}
                >
                  completed ({completedThemes.length})
                </button>
                {showCompleted && (
                  <div style={{ marginTop: "0.6rem" }}>
                    {completedThemes.map((theme) => (
                      <div className="sg-line sg-line--2" key={theme.id}>
                        <span className="sg-line__n">{theme.content}</span>
                        <span className="sg-line__a">
                          <span className="k">{theme.votes}</span>
                          <span className="sg-pill">done</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
