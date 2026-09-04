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
import Win from "@/components/desktop/Win";
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
      const res = await fetch(`/singulars/api/admin/performances/${slug}/vote-pairs`, {
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
      const res = await fetch(`/singulars/api/admin/poems/${tgt.id}`, {
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
    const res = await fetch(`/singulars/api/admin/performances/${slug}/import-csv`, {
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
    <>
      <Win
        file={`${slug}/votes.txt`}
        span="w--eight"
        meta={changes.length > 0 ? `${changes.length} unsaved` : undefined}
      >
        <p className="k">vote entry &middot; paper ballot reconciliation</p>
        <h1 className="h2">{perfName || slug}</h1>
        <div className="sg-row" style={{ marginTop: "0.7rem" }}>
          <Link className="btn" href="/admin/performances">
            all performances
          </Link>
        </div>

        <div className="rule" />

        <p className="k">csv import</p>
        <p className="note" style={{ marginTop: "0.35rem" }}>
          Drop a csv with columns theme_slug, human_votes, machine_votes, or
          pick a file.
        </p>
        <div className="sg-row" style={{ marginTop: "0.6rem" }}>
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="csv file"
            onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}
          />
          {csvFile ? (
            <button type="button" className="btn" onClick={handleCsv}>
              commit {csvFile.name}
            </button>
          ) : null}
        </div>
        {csvErrors.length > 0 ? (
          <ul
            className="sg-err"
            style={{ listStyle: "none", padding: 0, margin: "0.6rem 0 0" }}
          >
            {csvErrors.map((e) => (
              <li key={`${e.row}-${e.theme_slug}`}>
                row {e.row} ({e.theme_slug || "?"}): {e.message}
              </li>
            ))}
          </ul>
        ) : null}

        {changes.length > 0 ? (
          <>
            <div className="rule" />
            <div className="sg-row sg-row--between">
              <span className="k">
                {changes.length} theme{changes.length === 1 ? "" : "s"} changed
              </span>
              <button
                type="button"
                className="btn btn--send"
                onClick={() => setConfirmingAll(true)}
                disabled={savingAll}
              >
                save all
              </button>
            </div>
          </>
        ) : null}
      </Win>

      <Win
        file="themes/"
        span="w--eight"
        meta={loading ? "loading" : `${themes.length} themes`}
      >
        {loading ? (
          <p className="note" style={{ marginTop: 0 }}>
            Loading.
          </p>
        ) : error ? (
          <p className="sg-err" style={{ marginTop: 0 }}>
            {error}
          </p>
        ) : themes.length === 0 ? (
          <p className="note" style={{ marginTop: 0 }}>
            No themes for this performance yet.{" "}
            <Link href="/admin/themes">add some &rarr;</Link>
          </p>
        ) : (
          themes.map((t) => {
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
              <details className="file" key={t.theme_slug} open={!!dirty}>
                <summary>
                  <span className="fr__n">
                    <i className="tri" aria-hidden="true" />
                    {t.theme}
                  </span>
                  <span className="fr__s">
                    {(t.human?.vote_count ?? 0) + (t.machine?.vote_count ?? 0)}{" "}
                    votes
                  </span>
                  <span className="fr__w">
                    {dirty ? "unsaved changes" : ""}
                  </span>
                  <span className="fr__d">enter votes</span>
                </summary>
                <div className="fr__b">
                  <div className="sg-duel">
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
                  <div className="sg-row" style={{ marginTop: "0.8rem" }}>
                    <label className="dk-input" style={{ flex: "1 1 16rem" }}>
                      <span>reason (optional)</span>
                      <input
                        type="text"
                        placeholder="why this change"
                        value={e.reason || ""}
                        onChange={(ev) =>
                          setReason(t.theme_slug, ev.target.value)
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn--send"
                      onClick={() => saveRow(t)}
                      disabled={!dirty}
                    >
                      save row
                    </button>
                  </div>
                  <div className="sg-row" style={{ marginTop: "0.6rem" }}>
                    {t.human ? (
                      <HistoryDisclosure
                        label="human history"
                        poemId={t.human.id}
                      />
                    ) : null}
                    {t.machine ? (
                      <HistoryDisclosure
                        label="machine history"
                        poemId={t.machine.id}
                      />
                    ) : null}
                  </div>
                </div>
              </details>
            );
          })
        )}
      </Win>

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
    </>
  );
}

type Override = {
  id: string;
  online_count_at_override: number;
  manual_delta: number;
  new_total: number;
  reason: string | null;
  by: string | null;
  active: boolean;
  created_at: string;
};

/** The override audit trail for one poem, fetched on first open. */
function HistoryDisclosure({
  label,
  poemId,
}: {
  label: string;
  poemId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Override[] | null>(null);

  async function toggle() {
    if (!open && rows === null) {
      setLoading(true);
      try {
        const r = await fetch(`/singulars/api/admin/poems/${poemId}/overrides`);
        const j = await r.json();
        setRows(j.overrides || []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    }
    setOpen((v) => !v);
  }

  return (
    <div style={{ flex: "1 1 16rem", minWidth: 0 }}>
      <button
        type="button"
        className="btn"
        aria-expanded={open}
        onClick={toggle}
      >
        {label}
        {rows ? ` (${rows.length})` : ""}
      </button>
      {open ? (
        <div style={{ marginTop: "0.5rem" }}>
          {loading ? (
            <p className="k">loading</p>
          ) : rows === null || rows.length === 0 ? (
            <p className="k">no overrides</p>
          ) : (
            rows.map((r) => (
              <div
                className="sg-line"
                key={r.id}
                style={{ opacity: r.active ? 1 : 0.55 }}
              >
                <span className="fr__w">
                  {new Date(r.created_at)
                    .toISOString()
                    .slice(0, 16)
                    .replace("T", " ")}{" "}
                  · {r.online_count_at_override} online + {r.manual_delta}{" "}
                  manual = {r.new_total}
                  {r.active ? " · active" : ""}
                  {r.reason ? ` · ${r.reason}` : ""}
                  {r.by ? ` · by ${r.by}` : ""}
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

/** One side of a pair: the poem, and the count to enter for it. */
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
    <div className="sg-poem" style={{ cursor: "default" }}>
      <span className="k">{label}</span>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          background: "transparent",
          border: "none",
          padding: 0,
          margin: "0.4rem 0 0",
          cursor: poem ? "pointer" : "default",
        }}
      >
        <span className="sg-poem__t">
          {expanded && poem ? poem.text : snippet}
        </span>
      </button>
      <div className="sg-poem__f">
        <label className="dk-input" style={{ maxWidth: "7rem" }}>
          <span>votes</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={value}
            onChange={(e) =>
              onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))
            }
            disabled={!poem}
          />
        </label>
      </div>
    </div>
  );
}
