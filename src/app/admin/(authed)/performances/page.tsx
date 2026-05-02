"use client";

/**
 * /admin/performances (US-103)
 *
 * Lists every performance with status pill + vote-pair counts. Per row:
 *   - "view votes" -> /admin/performances/[slug]/votes (US-104)
 *   - "flip status" -> confirm modal -> POST /api/admin/performances/[slug]/status
 *   - "sync tallies" -> POST /api/admin/performances/[slug]/sync-tallies + toast
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  FONT_MONO,
  statusPillStyle,
  btnSmallStyle,
  formatDate,
} from "@/lib/admin-styles";
import { ConfirmModal } from "../_components/ConfirmModal";
import { Toaster, useToasts } from "../_components/Toaster";
// Now resolves correctly: page is at (authed)/performances, _components is at (authed)/_components

type PerfRow = {
  id: string;
  slug: string;
  name: string;
  date: string | null;
  status: "upcoming" | "training" | "trained";
  color: string;
  location: string | null;
  vote_pair_count: number;
  total_votes: number;
};

const NEXT_STATUS: Record<PerfRow["status"], PerfRow["status"] | null> = {
  upcoming: "training",
  training: "trained",
  trained: null,
};

export default function PerformancesPage() {
  const [rows, setRows] = useState<PerfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{
    perf: PerfRow;
    next: PerfRow["status"];
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { toasts, push, dismiss } = useToasts();

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/performances", {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "failed to load");
      } else {
        setRows(json.performances);
      }
    } catch {
      setError("network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  async function handleFlip(perf: PerfRow, next: PerfRow["status"]) {
    setBusy(perf.id);
    try {
      const res = await fetch(`/api/admin/performances/${perf.slug}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        push(json?.error || "flip failed", "error");
      } else {
        push(`${perf.name} -> ${next}`, "success", perf.color);
        fetchRows();
      }
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  async function handleSync(perf: PerfRow) {
    setBusy(perf.id);
    try {
      const res = await fetch(
        `/api/admin/performances/${perf.slug}/sync-tallies`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) {
        push(json?.error || "sync failed", "error");
      } else {
        const msg = `reconciled ${json.updated} of ${json.total} poems`;
        push(msg, "success", perf.color);
        if (json.updated > 0) fetchRows();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h1
        style={{
          fontFamily: '"Terminal Grotesque", sans-serif',
          fontSize: "3.5rem",
          lineHeight: 0.9,
          margin: "0 0 2rem 0",
        }}
      >
        performances
      </h1>

      {loading ? (
        <p style={{ ...mono(0.85), color: "var(--text-secondary)" }}>
          loading...
        </p>
      ) : error ? (
        <p style={{ ...mono(0.85), color: "#dc2626" }}>{error}</p>
      ) : rows.length === 0 ? (
        <p style={{ ...mono(0.85), color: "var(--text-secondary)" }}>
          no performances. seed via scripts/seed.mjs
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {rows.map((p) => {
            const nextSt = NEXT_STATUS[p.status];
            const fading = busy === p.id;
            return (
              <li
                key={p.id}
                style={{
                  borderTop: "1px solid var(--border-light)",
                  padding: "1.25rem 0",
                  opacity: fading ? 0.5 : 1,
                  transition: "opacity 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "baseline",
                    gap: "0.75rem",
                  }}
                >
                  <span
                    style={{
                      fontFamily: '"Standard", sans-serif',
                      fontSize: "1.15rem",
                      fontWeight: 500,
                    }}
                  >
                    {p.name}
                  </span>
                  <span style={statusPillStyle(p.status)}>{p.status}</span>
                  <span
                    style={{ ...mono(0.85), color: "var(--text-tertiary)" }}
                  >
                    {p.date ? formatDate(p.date) : "no date"}
                    {p.location ? ` · ${p.location}` : ""}
                  </span>
                </div>
                <div style={{ ...mono(0.8), color: "var(--text-secondary)" }}>
                  {p.vote_pair_count} theme{p.vote_pair_count === 1 ? "" : "s"}{" "}
                  with vote pairs · {p.total_votes} total votes
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                  }}
                >
                  <Link
                    href={`/admin/performances/${p.slug}/votes`}
                    style={{ ...btnSmallStyle, textDecoration: "none" }}
                  >
                    view votes
                  </Link>
                  {nextSt ? (
                    <button
                      style={btnSmallStyle}
                      disabled={fading}
                      onClick={() => setConfirming({ perf: p, next: nextSt })}
                    >
                      flip to {nextSt}
                    </button>
                  ) : (
                    <button style={btnSmallStyle} disabled aria-label="trained">
                      finalised
                    </button>
                  )}
                  <button
                    style={btnSmallStyle}
                    disabled={fading}
                    onClick={() => handleSync(p)}
                  >
                    sync tallies
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {confirming ? (
        <ConfirmModal
          title={`flip ${confirming.perf.name} to ${confirming.next}?`}
          body={
            confirming.next === "trained"
              ? "this finalises the audience-vote results."
              : "this opens the performance for voting."
          }
          confirmLabel={`flip to ${confirming.next}`}
          accentColor={confirming.perf.color}
          onCancel={() => setConfirming(null)}
          onConfirm={() => handleFlip(confirming.perf, confirming.next)}
        />
      ) : null}
      <Toaster toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

function mono(rem: number): React.CSSProperties {
  return { fontFamily: FONT_MONO, fontSize: `${rem}rem` };
}
