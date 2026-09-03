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
import Win from "@/components/desktop/Win";

interface Theme {
  id: string;
  content: string;
  theme_slug: string;
  votes: number;
  completed: boolean;
  created_at: string;
  updated_at: string;
}


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
      const res = await fetch("/singulars/api/themes");
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
      showMsg("A theme is 50 characters or less.", "error");
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
        showMsg(json.error || "The theme did not save.", "error");
        return;
      }
      setInput("");
      showMsg("Theme added.", "success");
      fetchThemes();
    } catch {
      showMsg("The theme did not save.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleComplete = async (id: string) => {
    setThemes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
    try {
      const res = await fetch(`/singulars/api/themes/admin/${id}/toggle-complete`, {
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
      const res = await fetch(`/singulars/api/themes/admin/${id}`, {
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
      showMsg("A theme is between 1 and 50 characters.", "error");
      return;
    }
    try {
      const res = await fetch(`/singulars/api/themes/admin/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const json = await res.json();
      if (!res.ok) {
        showMsg(json.error || "The change did not save.", "error");
        return;
      }
      setEditingId(null);
      showMsg("Theme updated.", "success");
      fetchThemes();
    } catch {
      showMsg("The change did not save.", "error");
    }
  };

  const activeThemes = themes.filter((t) => !t.completed);
  const completedThemes = themes.filter((t) => t.completed);
  const totalVotes = themes.reduce((s, t) => s + t.votes, 0);

  if (loading) {
    return (
      <Win file="themes/" span="w--eight">
        <p className="note" style={{ marginTop: 0 }}>
          Loading themes.
        </p>
      </Win>
    );
  }

  return (
    <>
      <Win file="themes.txt" span="w--eight">
        <p className="k">singulars &middot; admin</p>
        <h1 className="disp">themes</h1>
        <p className="sub">
          Audience-suggested themes for upcoming performances. Mark a theme
          done after it has been used at a show.
        </p>
        <div className="rule" />
        <div className="sg-tiles">
          <div className="sg-tile">
            <div className="sg-tile__v">{themes.length}</div>
            <span className="k sg-tile__k">themes</span>
          </div>
          <div className="sg-tile">
            <div className="sg-tile__v">{totalVotes}</div>
            <span className="k sg-tile__k">votes</span>
          </div>
        </div>
        <div className="rule" />
        <form onSubmit={handleAdd} className="sg-stack sg-stack--tight">
          <label className="dk-input">
            <span>add a theme</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="a theme in a few words"
              maxLength={50}
            />
          </label>
          <div className="sg-row sg-row--between">
            <span className="k">{input.length}/50</span>
            <button
              type="submit"
              className="btn btn--send"
              disabled={!input.trim() || submitting}
            >
              {submitting ? "adding" : "add theme"}
            </button>
          </div>
        </form>
        {message ? (
          <p
            className={message.type === "error" ? "sg-err" : "sg-ok"}
            role="status"
            aria-live="polite"
          >
            {message.text}
          </p>
        ) : null}
      </Win>

      <Win
        file="active/"
        span="w--seven"
        meta={`${activeThemes.length} ${activeThemes.length === 1 ? "theme" : "themes"}`}
      >
        {activeThemes.length === 0 ? (
          <p className="note" style={{ marginTop: 0 }}>
            No active themes.
          </p>
        ) : (
          activeThemes.map((theme) => (
            <ThemeRow
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
          ))
        )}
      </Win>

      {completedThemes.length > 0 ? (
        <Win
          file="completed/"
          span="w--five"
          meta={`${completedThemes.length} done`}
        >
          <button
            type="button"
            className="btn"
            aria-expanded={showCompleted}
            onClick={() => setShowCompleted(!showCompleted)}
          >
            {showCompleted ? "hide" : "show"} completed (
            {completedThemes.length})
          </button>
          {showCompleted ? (
            <div style={{ marginTop: "0.6rem" }}>
              {completedThemes.map((theme) => (
                <ThemeRow
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
        </Win>
      ) : null}
    </>
  );
}

/** One theme as a ledger row: name, votes, and the actions on the right. */
function ThemeRow({
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
      className="sg-line sg-line--2"
      style={{ opacity: isCompleted ? 0.6 : 1 }}
    >
      {isEditing ? (
        <label className="dk-input">
          <span>theme</span>
          <input
            type="text"
            value={editValue}
            maxLength={50}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveEdit();
              if (e.key === "Escape") onCancelEdit();
            }}
            autoFocus
          />
        </label>
      ) : (
        <span className="sg-line__n">{theme.content}</span>
      )}
      <span className="sg-line__a">
        <span className="k">{theme.votes} votes</span>
        {isEditing ? (
          <>
            <button type="button" className="btn" onClick={onSaveEdit}>
              save
            </button>
            <button type="button" className="btn" onClick={onCancelEdit}>
              cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn" onClick={onStartEdit}>
              edit
            </button>
            <button
              type="button"
              className="btn"
              aria-pressed={!!isCompleted}
              onClick={onToggleComplete}
            >
              {isCompleted ? "reopen" : "mark done"}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={onDelete}
            >
              delete
            </button>
          </>
        )}
      </span>
    </div>
  );
}
