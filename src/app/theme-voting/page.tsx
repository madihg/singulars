"use client";

import { useState, useEffect, useCallback } from "react";

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
      const res = await fetch("/api/themes");
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
      showMessage("Theme must be 50 characters or less", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const json = await res.json();

      if (!res.ok) {
        showMessage(json.error || "Failed to add theme", "error");
        return;
      }

      setInput("");
      showMessage("Theme added", "success");
      fetchThemes();
    } catch {
      showMessage("Failed to add theme", "error");
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
      const res = await fetch(`/api/themes/${id}/upvote`, { method: "POST" });
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
    <main
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: "4rem 2rem",
        minHeight: "100vh",
      }}
    >
      {/* Back link */}
      <a
        href="/"
        style={{
          fontFamily: '"Diatype Mono Variable", monospace',
          fontSize: "0.85rem",
          color: "var(--text-secondary)",
          display: "inline-block",
          marginBottom: "2rem",
        }}
      >
        &larr; Singulars
      </a>

      {/* Title */}
      <h1
        style={{
          fontFamily: '"Terminal Grotesque", sans-serif',
          fontSize: "4rem",
          lineHeight: 0.9,
          marginBottom: "0.75rem",
          fontWeight: 400,
        }}
      >
        Theme Voting
      </h1>
      <p
        style={{
          fontFamily: '"Diatype Mono Variable", monospace',
          fontSize: "1rem",
          color: "var(--text-secondary)",
          marginBottom: "2.5rem",
          lineHeight: 1.4,
        }}
      >
        Suggest and vote for poetry performance themes
      </p>

      {/* Submit form */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          gap: "0.75rem",
          marginBottom: "0.5rem",
        }}
      >
        <div style={{ flex: 1, position: "relative" }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter your theme idea..."
            maxLength={50}
            style={{
              width: "100%",
              fontFamily: '"Diatype Mono Variable", monospace',
              fontSize: "0.95rem",
              padding: "0.75rem 1rem",
              border: "1px solid var(--border-light)",
              borderRadius: "8px",
              background: "transparent",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || submitting}
          style={{
            fontFamily: '"Diatype Mono Variable", monospace',
            fontSize: "0.85rem",
            padding: "0.75rem 1.25rem",
            border: "1px solid",
            borderColor:
              !input.trim() || submitting
                ? "var(--border-light)"
                : "var(--text-primary)",
            borderRadius: "8px",
            background:
              !input.trim() || submitting
                ? "transparent"
                : "var(--text-primary)",
            color: !input.trim() || submitting ? "var(--text-hint)" : "#fff",
            cursor: !input.trim() || submitting ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            whiteSpace: "nowrap",
          }}
        >
          {submitting ? "..." : "Add Theme"}
        </button>
      </form>

      {/* Character count */}
      <div
        style={{
          fontFamily: '"Diatype Mono Variable", monospace',
          fontSize: "0.75rem",
          color: input.length > 45 ? "#dc2626" : "var(--text-hint)",
          textAlign: "right",
          marginBottom: "1rem",
        }}
      >
        {input.length}/50
      </div>

      {/* Message */}
      {message && (
        <p
          style={{
            fontFamily: '"Diatype Mono Variable", monospace',
            fontSize: "0.85rem",
            color: message.type === "error" ? "#dc2626" : "#16a34a",
            marginBottom: "1rem",
          }}
        >
          {message.text}
        </p>
      )}

      {/* Themes header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          borderBottom: "1px solid var(--border-light)",
          paddingBottom: "0.75rem",
        }}
      >
        <h2
          style={{
            fontFamily: '"Diatype Variable", sans-serif',
            fontSize: "1.25rem",
            fontWeight: 600,
            margin: 0,
          }}
        >
          Themes
        </h2>
        <span
          style={{
            fontFamily: '"Diatype Mono Variable", monospace',
            fontSize: "0.75rem",
            color: "var(--text-hint)",
          }}
        >
          {activeThemes.length} {activeThemes.length === 1 ? "theme" : "themes"}
        </span>
      </div>

      {/* Theme list */}
      {loading ? (
        <p
          style={{
            fontFamily: '"Diatype Mono Variable", monospace',
            fontSize: "0.85rem",
            color: "var(--text-hint)",
            textAlign: "center",
            padding: "2rem 0",
          }}
        >
          Loading...
        </p>
      ) : activeThemes.length === 0 ? (
        <p
          style={{
            fontSize: "1rem",
            color: "var(--text-secondary)",
            textAlign: "center",
            padding: "2rem 0",
          }}
        >
          No themes yet. Be the first to add one!
        </p>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          {activeThemes.map((theme) => (
            <div
              key={theme.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                padding: "0.75rem 1rem",
                border: "1px solid var(--border-light)",
                borderRadius: "8px",
                transition: "border-color 0.2s ease",
              }}
            >
              <div style={{ flex: 1 }}>
                <span
                  style={{
                    fontSize: "1rem",
                    color: "var(--text-primary)",
                    lineHeight: 1.4,
                  }}
                >
                  {theme.content}
                </span>
                <div
                  style={{
                    fontFamily: '"Diatype Mono Variable", monospace',
                    fontSize: "0.7rem",
                    color: "var(--text-hint)",
                    marginTop: "0.25rem",
                  }}
                >
                  {formatDate(theme.created_at)}
                </div>
              </div>
              <button
                onClick={() => handleUpvote(theme.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.15rem",
                  padding: "0.4rem 0.6rem",
                  border: "1px solid var(--border-light)",
                  borderRadius: "6px",
                  background: "transparent",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  minWidth: 44,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--text-secondary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-light)";
                }}
              >
                <span
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1,
                  }}
                >
                  ▲
                </span>
                <span
                  style={{
                    fontFamily: '"Diatype Mono Variable", monospace',
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    lineHeight: 1,
                  }}
                >
                  {theme.votes}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Completed section */}
      {completedThemes.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: '"Diatype Variable", sans-serif',
              fontSize: "1rem",
              fontWeight: 600,
              color: "var(--text-secondary)",
              padding: "0.5rem 0",
              width: "100%",
              textAlign: "left",
            }}
          >
            <span
              style={{
                fontSize: "0.7rem",
                transition: "transform 0.2s ease",
                transform: showCompleted ? "rotate(90deg)" : "rotate(0deg)",
                display: "inline-block",
              }}
            >
              ▶
            </span>
            Completed ({completedThemes.length})
          </button>

          {showCompleted && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                marginTop: "0.5rem",
              }}
            >
              {completedThemes.map((theme) => (
                <div
                  key={theme.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "0.75rem 1rem",
                    border: "1px solid var(--border-light)",
                    borderRadius: "8px",
                    opacity: 0.5,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <span
                      style={{ fontSize: "1rem", color: "var(--text-primary)" }}
                    >
                      {theme.content}
                    </span>
                    <span
                      style={{
                        fontFamily: '"Diatype Mono Variable", monospace',
                        fontSize: "0.65rem",
                        color: "var(--text-hint)",
                        marginLeft: "0.5rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      done
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: '"Diatype Mono Variable", monospace',
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--text-hint)",
                      minWidth: 44,
                      textAlign: "center",
                    }}
                  >
                    {theme.votes}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Responsive style */}
      <style>{`
        @media (max-width: 600px) {
          main > h1 {
            font-size: 2.5rem !important;
          }
        }
      `}</style>
    </main>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
