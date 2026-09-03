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
    fetch("/singulars/api/themes/admin/auth")
      .then((r) => r.json())
      .then((d) => setAuthenticated(d.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  const fetchThemes = useCallback(async () => {
    try {
      const res = await fetch("/singulars/api/themes");
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
    const res = await fetch("/singulars/api/themes/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthenticated(true);
      setPassword("");
    } else {
      setAuthError("Wrong password.");
    }
  };

  const handleLogout = async () => {
    await fetch("/singulars/api/themes/admin/auth", { method: "DELETE" });
    setAuthenticated(false);
    setThemes([]);
  };

  // --- Actions ---
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

  const menu = [
    { href: "/singulars/", label: "singulars" },
    { href: "/singulars/theme-voting", label: "theme voting" },
  ];

  // --- Loading state ---
  if (authenticated === null) {
    return (
      <>
        <MenuBar menu={menu} />
        <main className="desk">
          <section className="win w--five">
            <div className="win__bar">
              <span className="dots">
                <i />
                <i />
                <i />
              </span>
              <h2 className="win__t">admin.txt</h2>
            </div>
            <div className="win__b">
              <p className="note" style={{ marginTop: 0 }}>
                Loading.
              </p>
            </div>
          </section>
        </main>
      </>
    );
  }

  // --- Login ---
  if (!authenticated) {
    return (
      <>
        <MenuBar menu={menu} />
        <main className="desk">
          <section className="win w--five">
            <div className="win__bar">
              <span className="dots">
                <i />
                <i />
                <i />
              </span>
              <h2 className="win__t">admin.txt</h2>
            </div>
            <div className="win__b">
              <p className="k">theme voting</p>
              <h1 className="disp">Admin</h1>
              <div className="rule" />
              <form onSubmit={handleLogin} className="sg-stack sg-stack--tight">
                <label className="dk-input">
                  <span>password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                </label>
                <div className="sg-row sg-row--end">
                  <button type="submit" className="btn btn--send">
                    enter
                  </button>
                </div>
              </form>
              {authError && <p className="sg-err">{authError}</p>}
            </div>
          </section>
        </main>
      </>
    );
  }

  // --- Panel ---
  return (
    <>
      <MenuBar menu={menu} />
      <main className="desk">
        <section className="win w--four">
          <div className="win__bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <h2 className="win__t">admin.txt</h2>
          </div>
          <div className="win__b">
            <p className="k">theme voting</p>
            <h1 className="disp">Admin</h1>
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
            <div className="rule" />
            <button type="button" className="btn" onClick={handleLogout}>
              log out
            </button>
          </div>
        </section>

        <section className="win w--eight">
          <div className="win__bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <h2 className="win__t">themes/</h2>
            <span className="win__meta">
              {activeThemes.length} active &middot; {completedThemes.length} done
            </span>
          </div>
          <div className="win__b">
            {activeThemes.length === 0 && (
              <p className="note" style={{ marginTop: 0 }}>
                No active themes.
              </p>
            )}
            {activeThemes.map((theme) => (
              <div className="sg-line sg-line--2" key={theme.id}>
                {editingId === theme.id ? (
                  <label className="dk-input">
                    <span>theme</span>
                    <input
                      type="text"
                      value={editValue}
                      maxLength={50}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit(theme.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                    />
                  </label>
                ) : (
                  <span className="sg-line__n">{theme.content}</span>
                )}
                <span className="sg-line__a">
                  <span className="k">{theme.votes} votes</span>
                  {editingId === theme.id ? (
                    <>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleSaveEdit(theme.id)}
                      >
                        save
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setEditingId(null)}
                      >
                        cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setEditingId(theme.id);
                          setEditValue(theme.content);
                        }}
                      >
                        edit
                      </button>
                      <button
                        type="button"
                        className="btn"
                        aria-pressed={theme.completed}
                        onClick={() => handleToggleComplete(theme.id)}
                      >
                        mark done
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => handleDelete(theme.id)}
                      >
                        delete
                      </button>
                    </>
                  )}
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
                          <span className="k">{theme.votes} votes</span>
                          <button
                            type="button"
                            className="btn"
                            aria-pressed
                            onClick={() => handleToggleComplete(theme.id)}
                          >
                            reopen
                          </button>
                          <button
                            type="button"
                            className="btn btn--danger"
                            onClick={() => handleDelete(theme.id)}
                          >
                            delete
                          </button>
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
