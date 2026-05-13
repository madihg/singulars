"use client";

/**
 * /admin/themes - manage suggested themes for upcoming performances.
 *
 * Pulled into the new /admin shell from the original /theme-voting/admin
 * page (which still exists for backward compat but the project rule is
 * /admin is the canonical interface going forward). The auth cookie is
 * shared between /admin and /theme-voting/admin (theme-admin-token), so
 * the existing /api/themes/admin/* endpoints work without any backend
 * change.
 *
 * Functionality: list active + completed themes, add, edit, mark
 * complete/incomplete (which moves them between sections), delete.
 */

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

const MONO = '"Diatype Mono Variable", monospace';
const DISPLAY = '"Terminal Grotesque", sans-serif';
const STANDARD = '"Standard", sans-serif';

export default function ThemesAdminPage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const fetchThemes = useCallback(async () => {
    try {
      const res = await fetch("/api/themes");
      const json = await res.json();
      if (json.data) setThemes(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThemes();
  }, [fetchThemes]);

  const showMsg = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || submitting) return;
    if (content.length > 50) {
      showMsg("Theme must be 50 characters or less", "error");
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
        showMsg(json.error || "Failed to add theme", "error");
        return;
      }
      setInput("");
      showMsg("Theme added", "success");
      fetchThemes();
    } catch {
      showMsg("Failed to add theme", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleComplete = async (id: string) => {
    setThemes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
    try {
      const res = await fetch(`/api/themes/admin/${id}/toggle-complete`, {
        method: "PATCH",
      });
      if (!res.ok) fetchThemes();
    } catch {
      fetchThemes();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this theme permanently?")) return;
    setThemes((prev) => prev.filter((t) => t.id !== id));
    try {
      const res = await fetch(`/api/themes/admin/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) fetchThemes();
    } catch {
      fetchThemes();
    }
  };

  const handleSaveEdit = async (id: string) => {
    const content = editValue.trim();
    if (!content || content.length > 50) {
      showMsg("Theme must be between 1 and 50 characters", "error");
      return;
    }
    try {
      const res = await fetch(`/api/themes/admin/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const json = await res.json();
      if (!res.ok) {
        showMsg(json.error || "Failed to update", "error");
        return;
      }
      setEditingId(null);
      showMsg("Theme updated", "success");
      fetchThemes();
    } catch {
      showMsg("Failed to update", "error");
    }
  };

  if (loading) {
    return (
      <p style={{ fontFamily: MONO, color: "var(--text-tertiary)" }}>
        loading themes…
      </p>
    );
  }

  const activeThemes = themes.filter((t) => !t.completed);
  const completedThemes = themes.filter((t) => t.completed);
  const totalVotes = themes.reduce((s, t) => s + t.votes, 0);

  return (
    <div>
      <h1
        style={{
          fontFamily: DISPLAY,
          fontSize: "3.5rem",
          lineHeight: 0.9,
          fontWeight: 400,
          margin: "0 0 0.5rem 0",
        }}
      >
        themes
      </h1>
      <p
        style={{
          fontFamily: MONO,
          fontSize: "0.85rem",
          color: "var(--text-secondary)",
          margin: "0 0 2rem 0",
        }}
      >
        audience-suggested themes for upcoming performances. mark themes as
        done after they&apos;ve been used at a show.
      </p>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div style={statCardStyle}>
          <div style={statValueStyle}>{themes.length}</div>
          <div style={statLabelStyle}>Total Themes</div>
        </div>
        <div style={statCardStyle}>
          <div style={statValueStyle}>{totalVotes}</div>
          <div style={statLabelStyle}>Total Votes</div>
        </div>
      </div>

      {/* Add form */}
      <form
        onSubmit={handleAdd}
        style={{ display: "flex", gap: "0.75rem", marginBottom: "0.5rem" }}
      >
        <div style={{ flex: 1 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add a new theme..."
            maxLength={50}
            style={inputStyle}
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || submitting}
          style={{
            ...btnPrimaryStyle,
            opacity: !input.trim() || submitting ? 0.4 : 1,
            cursor: !input.trim() || submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "..." : "Add"}
        </button>
      </form>
      <div
        style={{
          fontFamily: MONO,
          fontSize: "0.75rem",
          color: input.length > 45 ? "#dc2626" : "var(--text-hint)",
          textAlign: "right",
          marginBottom: "1rem",
        }}
      >
        {input.length}/50
      </div>

      {message ? (
        <p
          style={{
            fontFamily: MONO,
            fontSize: "0.85rem",
            color: message.type === "error" ? "#dc2626" : "#16a34a",
            marginBottom: "1rem",
          }}
        >
          {message.text}
        </p>
      ) : null}

      {/* Active themes */}
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
        <h2 style={sectionHeadingStyle}>Active Themes</h2>
        <span
          style={{
            fontFamily: MONO,
            fontSize: "0.75rem",
            color: "var(--text-hint)",
          }}
        >
          {activeThemes.length} {activeThemes.length === 1 ? "theme" : "themes"}
        </span>
      </div>

      {activeThemes.length === 0 ? (
        <p
          style={{
            fontFamily: STANDARD,
            fontSize: "1rem",
            color: "var(--text-secondary)",
            textAlign: "center",
            padding: "2rem 0",
          }}
        >
          No active themes.
        </p>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          {activeThemes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              editingId={editingId}
              editValue={editValue}
              onStartEdit={() => {
                setEditingId(theme.id);
                setEditValue(theme.content);
              }}
              onCancelEdit={() => setEditingId(null)}
              onEditChange={setEditValue}
              onSaveEdit={() => handleSaveEdit(theme.id)}
              onToggleComplete={() => handleToggleComplete(theme.id)}
              onDelete={() => handleDelete(theme.id)}
            />
          ))}
        </div>
      )}

      {/* Completed section */}
      {completedThemes.length > 0 ? (
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
              ...sectionHeadingStyle,
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

          {showCompleted ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                marginTop: "0.5rem",
              }}
            >
              {completedThemes.map((theme) => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  editingId={editingId}
                  editValue={editValue}
                  onStartEdit={() => {
                    setEditingId(theme.id);
                    setEditValue(theme.content);
                  }}
                  onCancelEdit={() => setEditingId(null)}
                  onEditChange={setEditValue}
                  onSaveEdit={() => handleSaveEdit(theme.id)}
                  onToggleComplete={() => handleToggleComplete(theme.id)}
                  onDelete={() => handleDelete(theme.id)}
                  isCompleted
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ---- Theme Card ---- */

function ThemeCard({
  theme,
  editingId,
  editValue,
  onStartEdit,
  onCancelEdit,
  onEditChange,
  onSaveEdit,
  onToggleComplete,
  onDelete,
  isCompleted,
}: {
  theme: Theme;
  editingId: string | null;
  editValue: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onEditChange: (v: string) => void;
  onSaveEdit: () => void;
  onToggleComplete: () => void;
  onDelete: () => void;
  isCompleted?: boolean;
}) {
  const isEditing = editingId === theme.id;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.75rem 1rem",
        border: "1px solid var(--border-light)",
        borderRadius: "8px",
        opacity: isCompleted ? 0.5 : 1,
      }}
    >
      {isEditing ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            maxLength={50}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveEdit();
              if (e.key === "Escape") onCancelEdit();
            }}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={onSaveEdit} style={btnSmallStyle}>
            Save
          </button>
          <button onClick={onCancelEdit} style={btnSmallStyle}>
            Cancel
          </button>
        </div>
      ) : (
        <>
          <div style={{ flex: 1 }}>
            <span
              style={{
                fontFamily: STANDARD,
                fontSize: "1rem",
                color: "var(--text-primary)",
              }}
            >
              {theme.content}
            </span>
            {isCompleted ? <span style={doneBadgeStyle}>done</span> : null}
            <div
              style={{
                fontFamily: MONO,
                fontSize: "0.7rem",
                color: "var(--text-hint)",
                marginTop: "0.25rem",
              }}
            >
              {formatDate(theme.created_at)}
            </div>
          </div>

          {/* Vote count */}
          <span
            style={{
              fontFamily: MONO,
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "var(--text-secondary)",
              minWidth: 30,
              textAlign: "center",
            }}
          >
            {theme.votes}
          </span>

          {/* Admin actions */}
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                cursor: "pointer",
                fontFamily: MONO,
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
              }}
            >
              <input
                type="checkbox"
                checked={theme.completed}
                onChange={onToggleComplete}
                style={{ cursor: "pointer" }}
              />
              Done
            </label>
            <button
              onClick={onStartEdit}
              style={actionBtnStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--text-secondary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-light)";
              }}
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              style={actionBtnStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#dc2626";
                e.currentTarget.style.color = "#dc2626";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-light)";
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---- Styles ---- */

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: MONO,
  fontSize: "0.95rem",
  padding: "0.75rem 1rem",
  border: "1px solid var(--border-light)",
  borderRadius: "8px",
  background: "transparent",
  color: "var(--text-primary)",
  outline: "none",
};

const btnPrimaryStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: "0.85rem",
  padding: "0.75rem 1.25rem",
  border: "1px solid var(--text-primary)",
  borderRadius: "8px",
  background: "var(--text-primary)",
  color: "#fff",
  transition: "all 0.2s ease",
  whiteSpace: "nowrap",
};

const btnSmallStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: "0.75rem",
  padding: "0.4rem 0.75rem",
  border: "1px solid var(--border-light)",
  borderRadius: "6px",
  background: "transparent",
  color: "var(--text-secondary)",
  cursor: "pointer",
  transition: "border-color 0.15s ease",
};

const actionBtnStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: "0.75rem",
  padding: "0.35rem 0.6rem",
  border: "1px solid var(--border-light)",
  borderRadius: "6px",
  background: "transparent",
  color: "var(--text-secondary)",
  cursor: "pointer",
  transition: "all 0.15s ease",
};

const sectionHeadingStyle: React.CSSProperties = {
  fontFamily: '"Diatype Variable", sans-serif',
  fontSize: "1.25rem",
  fontWeight: 600,
  margin: 0,
};

const statCardStyle: React.CSSProperties = {
  border: "1px solid var(--border-light)",
  borderRadius: "8px",
  padding: "1rem 1.25rem",
};

const statValueStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: "2rem",
  fontWeight: 600,
  color: "var(--text-primary)",
  marginBottom: "0.25rem",
};

const statLabelStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: "0.75rem",
  color: "var(--text-hint)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const doneBadgeStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: "0.65rem",
  color: "var(--text-hint)",
  marginLeft: "0.5rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

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
