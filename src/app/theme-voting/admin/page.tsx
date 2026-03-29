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

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [themes, setThemes] = useState<Theme[]>([]);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  // Check auth on mount
  useEffect(() => {
    fetch("/api/themes/admin/auth")
      .then((r) => r.json())
      .then((d) => setAuthenticated(d.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  const fetchThemes = useCallback(async () => {
    try {
      const res = await fetch("/api/themes");
      const json = await res.json();
      if (json.data) setThemes(json.data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (authenticated) fetchThemes();
  }, [authenticated, fetchThemes]);

  const showMsg = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // --- Auth ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const res = await fetch("/api/themes/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthenticated(true);
      setPassword("");
    } else {
      setAuthError("Incorrect password");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/themes/admin/auth", { method: "DELETE" });
    setAuthenticated(false);
    setThemes([]);
  };

  // --- Actions ---
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

  // --- Loading state ---
  if (authenticated === null) {
    return (
      <main style={pageStyle}>
        <p style={monoStyle}>Loading...</p>
      </main>
    );
  }

  // --- Login screen ---
  if (!authenticated) {
    return (
      <main style={pageStyle}>
        <a href="/theme-voting" style={backLinkStyle}>
          &larr; Theme Voting
        </a>
        <h1 style={titleStyle}>Admin</h1>
        <form
          onSubmit={handleLogin}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            maxWidth: 360,
            width: "100%",
          }}
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={!password}
            style={{
              ...btnPrimaryStyle,
              opacity: !password ? 0.4 : 1,
              cursor: !password ? "not-allowed" : "pointer",
            }}
          >
            Enter
          </button>
          {authError && <p style={errorTextStyle}>{authError}</p>}
        </form>
      </main>
    );
  }

  // --- Admin dashboard ---
  const activeThemes = themes.filter((t) => !t.completed);
  const completedThemes = themes.filter((t) => t.completed);
  const totalVotes = themes.reduce((s, t) => s + t.votes, 0);

  return (
    <main
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: "4rem 2rem",
        minHeight: "100vh",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
        }}
      >
        <a href="/theme-voting" style={backLinkStyle}>
          &larr; Theme Voting
        </a>
        <button onClick={handleLogout} style={btnSmallStyle}>
          Log out
        </button>
      </div>

      <h1 style={{ ...titleStyle, marginBottom: "0.5rem" }}>Theme Voting</h1>
      <p
        style={{
          ...monoStyle,
          fontSize: "0.85rem",
          color: "var(--text-hint)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "2rem",
        }}
      >
        Admin
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
          ...monoStyle,
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
            ...monoStyle,
            fontSize: "0.85rem",
            color: message.type === "error" ? "#dc2626" : "#16a34a",
            marginBottom: "1rem",
          }}
        >
          {message.text}
        </p>
      )}

      {/* Active themes header */}
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
            ...monoStyle,
            fontSize: "0.75rem",
            color: "var(--text-hint)",
          }}
        >
          {activeThemes.length} {activeThemes.length === 1 ? "theme" : "themes"}
        </span>
      </div>

      {/* Active themes list */}
      {activeThemes.length === 0 ? (
        <p
          style={{
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
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 600px) {
          main > h1 { font-size: 2.5rem !important; }
        }
      `}</style>
    </main>
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
            <span style={{ fontSize: "1rem", color: "var(--text-primary)" }}>
              {theme.content}
            </span>
            {isCompleted && <span style={doneBadgeStyle}>done</span>}
            <div
              style={{
                ...monoStyle,
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
              ...monoStyle,
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
                ...monoStyle,
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

const monoStyle: React.CSSProperties = {
  fontFamily: '"Diatype Mono Variable", monospace',
};

const pageStyle: React.CSSProperties = {
  maxWidth: 400,
  margin: "0 auto",
  padding: "4rem 2rem",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1.5rem",
};

const titleStyle: React.CSSProperties = {
  fontFamily: '"Terminal Grotesque", sans-serif',
  fontSize: "3.5rem",
  lineHeight: 0.9,
  fontWeight: 400,
  margin: 0,
};

const backLinkStyle: React.CSSProperties = {
  ...monoStyle,
  fontFamily: '"Diatype Mono Variable", monospace',
  fontSize: "0.85rem",
  color: "var(--text-secondary)",
  textDecoration: "none",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: '"Diatype Mono Variable", monospace',
  fontSize: "0.95rem",
  padding: "0.75rem 1rem",
  border: "1px solid var(--border-light)",
  borderRadius: "8px",
  background: "transparent",
  color: "var(--text-primary)",
  outline: "none",
};

const btnPrimaryStyle: React.CSSProperties = {
  fontFamily: '"Diatype Mono Variable", monospace',
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
  fontFamily: '"Diatype Mono Variable", monospace',
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
  fontFamily: '"Diatype Mono Variable", monospace',
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
  fontFamily: '"Diatype Mono Variable", monospace',
  fontSize: "2rem",
  fontWeight: 600,
  color: "var(--text-primary)",
  marginBottom: "0.25rem",
};

const statLabelStyle: React.CSSProperties = {
  fontFamily: '"Diatype Mono Variable", monospace',
  fontSize: "0.75rem",
  color: "var(--text-hint)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const doneBadgeStyle: React.CSSProperties = {
  fontFamily: '"Diatype Mono Variable", monospace',
  fontSize: "0.65rem",
  color: "var(--text-hint)",
  marginLeft: "0.5rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const errorTextStyle: React.CSSProperties = {
  fontFamily: '"Diatype Mono Variable", monospace',
  fontSize: "0.85rem",
  color: "#dc2626",
  margin: 0,
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
