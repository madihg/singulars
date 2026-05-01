"use client";

/**
 * /admin/performances/[slug]/votes (US-104)
 *
 * Per-theme vote-entry table. Columns:
 *   theme | human snippet + votes input | machine snippet + votes input | save row
 * Click on a snippet expands the full poem inline.
 *
 * Plus a CSV import dropzone at top.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  FONT_MONO,
  inputStyle,
  btnSmallStyle,
  backLinkStyle,
} from "@/lib/admin-styles";
import { ConfirmModal } from "../../../_components/ConfirmModal";
import { Toaster, useToasts } from "../../../_components/Toaster";

type Poem = {
  id: string;
  text: string;
  author_name: string;
  vote_count: number;
};
type ThemeRow = {
  theme: string;
  theme_slug: string;
  human: Poem | null;
  machine: Poem | null;
};

type Edits = Record<
  string,
  { human?: number; machine?: number; reason?: string }
>;

export default function VoteEntryPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "";

  const [perfName, setPerfName] = useState("");
  const [themes, setThemes] = useState<ThemeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Edits>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvErrors, setCsvErrors] = useState<
    Array<{ row: number; theme_slug: string; message: string }>
  >([]);
  const { toasts, push, dismiss } = useToasts();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/performances/${slug}/vote-pairs`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "failed");
      } else {
        setPerfName(json.performance.name);
        setThemes(json.themes);
      }
    } catch {
      setError("network error");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (slug) load();
  }, [slug, load]);

  function setHumanVotes(themeSlug: string, n: number) {
    setEdits((e) => ({
      ...e,
      [themeSlug]: { ...e[themeSlug], human: n },
    }));
  }
  function setMachineVotes(themeSlug: string, n: number) {
    setEdits((e) => ({
      ...e,
      [themeSlug]: { ...e[themeSlug], machine: n },
    }));
  }
  function setReason(themeSlug: string, reason: string) {
    setEdits((e) => ({
      ...e,
      [themeSlug]: { ...e[themeSlug], reason },
    }));
  }

  function changedThemes(): ThemeRow[] {
    return themes.filter((t) => {
      const e = edits[t.theme_slug];
      if (!e) return false;
      if (e.human !== undefined && t.human && e.human !== t.human.vote_count)
        return true;
      if (
        e.machine !== undefined &&
        t.machine &&
        e.machine !== t.machine.vote_count
      )
        return true;
      return false;
    });
  }

  async function saveRow(t: ThemeRow) {
    const e = edits[t.theme_slug];
    if (!e) return;
    const reason = e.reason || null;
    const targets: Array<{ id: string; count: number }> = [];
    if (e.human !== undefined && t.human && e.human !== t.human.vote_count) {
      targets.push({ id: t.human.id, count: e.human });
    }
    if (
      e.machine !== undefined &&
      t.machine &&
      e.machine !== t.machine.vote_count
    ) {
      targets.push({ id: t.machine.id, count: e.machine });
    }
    if (targets.length === 0) return;
    for (const tgt of targets) {
      const res = await fetch(`/api/admin/poems/${tgt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote_count: tgt.count, reason }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        push(j?.error || "save failed", "error");
        return;
      }
    }
    push(`saved ${t.theme}`, "success");
    setEdits((s) => {
      const copy = { ...s };
      delete copy[t.theme_slug];
      return copy;
    });
    load();
  }

  async function saveAll() {
    setSavingAll(true);
    try {
      for (const t of changedThemes()) {
        await saveRow(t);
      }
    } finally {
      setSavingAll(false);
      setConfirmingAll(false);
    }
  }

  async function handleCsv() {
    if (!csvFile) return;
    setCsvErrors([]);
    const form = new FormData();
    form.append("file", csvFile);
    const res = await fetch(`/api/admin/performances/${slug}/import-csv`, {
      method: "POST",
      body: form,
    });
    const json = await res.json();
    if (!res.ok) {
      setCsvErrors(json?.errors || []);
      push(`csv import had ${json?.errors?.length || 0} errors`, "error");
    } else {
      push(`csv applied ${json.applied} updates`, "success");
      setCsvFile(null);
      load();
    }
  }

  const changes = changedThemes();

  return (
    <div>
      <Link href="/admin/performances" style={backLinkStyle}>
        ← performances
      </Link>
      <h1
        style={{
          fontFamily: '"Terminal Grotesque", sans-serif',
          fontSize: "3.5rem",
          lineHeight: 0.9,
          margin: "1rem 0 0.5rem 0",
        }}
      >
        {perfName || slug}
      </h1>
      <p
        style={{
          fontFamily: FONT_MONO,
          fontSize: "0.85rem",
          color: "var(--text-secondary)",
          margin: "0 0 2rem 0",
        }}
      >
        vote entry · paper-ballot reconciliation
      </p>

      {/* CSV import */}
      <div
        style={{
          border: "1px dashed rgba(0,0,0,0.18)",
          padding: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: "0.8rem",
            color: "var(--text-secondary)",
            marginBottom: "0.75rem",
          }}
        >
          drop a csv with columns theme_slug, human_votes, machine_votes - or
          pick a file
        </div>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
          style={{
            fontFamily: FONT_MONO,
            fontSize: "0.85rem",
            marginRight: "0.75rem",
          }}
        />
        {csvFile ? (
          <button onClick={handleCsv} style={btnSmallStyle}>
            commit {csvFile.name}
          </button>
        ) : null}
        {csvErrors.length > 0 ? (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "0.75rem 0 0 0",
              fontFamily: FONT_MONO,
              fontSize: "0.8rem",
              color: "#dc2626",
            }}
          >
            {csvErrors.map((e) => (
              <li key={`${e.row}-${e.theme_slug}`}>
                row {e.row} ({e.theme_slug || "?"}): {e.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Save all bar */}
      {changes.length > 0 ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#fafafa",
            border: "1px solid var(--border-light)",
            padding: "0.75rem 1rem",
            position: "sticky",
            top: 0,
            zIndex: 10,
            marginBottom: "1rem",
            fontFamily: FONT_MONO,
            fontSize: "0.85rem",
          }}
        >
          <span>
            {changes.length} theme{changes.length === 1 ? "" : "s"} changed
          </span>
          <button
            onClick={() => setConfirmingAll(true)}
            disabled={savingAll}
            style={btnSmallStyle}
          >
            save all
          </button>
        </div>
      ) : null}

      {loading ? (
        <p
          style={{
            fontFamily: FONT_MONO,
            color: "var(--text-secondary)",
          }}
        >
          loading...
        </p>
      ) : error ? (
        <p style={{ fontFamily: FONT_MONO, color: "#dc2626" }}>{error}</p>
      ) : themes.length === 0 ? (
        <p style={{ fontFamily: FONT_MONO, color: "var(--text-secondary)" }}>
          no themes for this performance yet.{" "}
          <Link href="/theme-voting/admin" style={{ color: "inherit" }}>
            add some →
          </Link>
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {themes.map((t) => {
            const e = edits[t.theme_slug] || {};
            const isExpanded = expanded[t.theme_slug];
            const dirty =
              (e.human !== undefined &&
                t.human &&
                e.human !== t.human.vote_count) ||
              (e.machine !== undefined &&
                t.machine &&
                e.machine !== t.machine.vote_count);
            return (
              <div
                key={t.theme_slug}
                style={{
                  borderTop: "1px solid var(--border-light)",
                  paddingTop: "1.25rem",
                }}
              >
                <h3
                  style={{
                    fontFamily: '"Diatype Variable", sans-serif',
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    margin: "0 0 0.75rem 0",
                  }}
                >
                  {t.theme}
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "1.5rem",
                  }}
                >
                  <PoemBlock
                    label="human"
                    poem={t.human}
                    expanded={!!isExpanded}
                    onToggle={() =>
                      setExpanded((s) => ({
                        ...s,
                        [t.theme_slug]: !s[t.theme_slug],
                      }))
                    }
                    value={e.human ?? t.human?.vote_count ?? 0}
                    onChange={(n) => setHumanVotes(t.theme_slug, n)}
                  />
                  <PoemBlock
                    label="machine"
                    poem={t.machine}
                    expanded={!!isExpanded}
                    onToggle={() =>
                      setExpanded((s) => ({
                        ...s,
                        [t.theme_slug]: !s[t.theme_slug],
                      }))
                    }
                    value={e.machine ?? t.machine?.vote_count ?? 0}
                    onChange={(n) => setMachineVotes(t.theme_slug, n)}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    marginTop: "1rem",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    placeholder="optional - why this change?"
                    value={e.reason || ""}
                    onChange={(ev) => setReason(t.theme_slug, ev.target.value)}
                    style={{
                      ...inputStyle,
                      fontSize: "0.8rem",
                      flex: "1 1 240px",
                    }}
                  />
                  <button
                    onClick={() => saveRow(t)}
                    disabled={!dirty}
                    style={btnSmallStyle}
                  >
                    save row
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmingAll ? (
        <ConfirmModal
          title={`save ${changes.length} change${changes.length === 1 ? "" : "s"}?`}
          body={changes
            .map((t) => {
              const e = edits[t.theme_slug];
              const parts: string[] = [];
              if (
                e.human !== undefined &&
                t.human &&
                e.human !== t.human.vote_count
              )
                parts.push(`human ${t.human.vote_count} -> ${e.human}`);
              if (
                e.machine !== undefined &&
                t.machine &&
                e.machine !== t.machine.vote_count
              )
                parts.push(`machine ${t.machine.vote_count} -> ${e.machine}`);
              return `${t.theme}: ${parts.join(", ")}`;
            })
            .join("\n")}
          confirmLabel="save all"
          onCancel={() => setConfirmingAll(false)}
          onConfirm={saveAll}
        />
      ) : null}
      <Toaster toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

function PoemBlock({
  label,
  poem,
  expanded,
  onToggle,
  value,
  onChange,
}: {
  label: string;
  poem: Poem | null;
  expanded: boolean;
  onToggle: () => void;
  value: number;
  onChange: (n: number) => void;
}) {
  const snippet = poem
    ? poem.text.slice(0, 60) + (poem.text.length > 60 ? "..." : "")
    : "(missing)";
  return (
    <div>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--text-tertiary)",
          marginBottom: "0.5rem",
        }}
      >
        {label}
      </div>
      <button
        onClick={onToggle}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          textAlign: "left",
          fontFamily: '"Standard", sans-serif',
          fontSize: "0.95rem",
          color: "var(--text-primary)",
          cursor: poem ? "pointer" : "default",
          marginBottom: "0.75rem",
        }}
      >
        {expanded && poem ? (
          <span style={{ whiteSpace: "pre-line", lineHeight: 1.7 }}>
            {poem.text}
          </span>
        ) : (
          snippet
        )}
      </button>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontFamily: FONT_MONO,
          fontSize: "0.85rem",
        }}
      >
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={value}
          onChange={(e) =>
            onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))
          }
          disabled={!poem}
          style={{ ...inputStyle, width: 80, padding: "0.4rem 0.6rem" }}
        />
        <span style={{ color: "var(--text-tertiary)" }}>votes</span>
      </div>
    </div>
  );
}
