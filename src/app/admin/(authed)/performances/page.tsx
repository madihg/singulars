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
import { formatDate } from "@/lib/admin-format";
import Win from "@/components/desktop/Win";
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
      const res = await fetch("/singulars/api/admin/performances", {
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
      const res = await fetch(`/singulars/api/admin/performances/${perf.slug}/status`, {
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
        `/singulars/api/admin/performances/${perf.slug}/sync-tallies`,
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
    <>
      <Win
        file="performances/"
        span="w--eight"
        meta={loading ? "loading" : `${rows.length} in the series`}
      >
        {loading ? (
          <p className="note" style={{ marginTop: 0 }}>
            Loading.
          </p>
        ) : error ? (
          <p className="sg-err" style={{ marginTop: 0 }}>
            {error}
          </p>
        ) : rows.length === 0 ? (
          <p className="note" style={{ marginTop: 0 }}>
            No performances. Seed via scripts/seed.mjs.
          </p>
        ) : (
          <>
            <div className="hdr">
              <span className="k">performance</span>
              <span className="k">status</span>
              <span className="k">votes</span>
              <span className="k">actions</span>
            </div>
            {rows.map((p) => {
              const nextSt = NEXT_STATUS[p.status];
              const fading = busy === p.id;
              return (
                <div
                  className="sg-line sg-line--4"
                  key={p.id}
                  style={{ opacity: fading ? 0.5 : 1 }}
                >
                  <span className="sg-line__n">
                    <i
                      className="cdot"
                      style={{ ["--c" as string]: p.color }}
                    />
                    {p.name}
                  </span>
                  <span className="fr__s">
                    <span className="sg-pill" data-state={p.status}>
                      {p.status}
                    </span>
                  </span>
                  <span className="fr__w">
                    {p.vote_pair_count} theme
                    {p.vote_pair_count === 1 ? "" : "s"} with pairs ·{" "}
                    {p.total_votes} votes ·{" "}
                    {p.date ? formatDate(p.date) : "no date"}
                    {p.location ? ` · ${p.location}` : ""}
                  </span>
                  <span className="sg-line__a">
                    <Link
                      className="btn"
                      href={`/admin/performances/${p.slug}/votes`}
                    >
                      votes
                    </Link>
                    {nextSt ? (
                      <button
                        type="button"
                        className="btn"
                        disabled={fading}
                        onClick={() => setConfirming({ perf: p, next: nextSt })}
                      >
                        flip to {nextSt}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn"
                        disabled
                        aria-label="trained"
                      >
                        finalised
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn"
                      disabled={fading}
                      onClick={() => handleSync(p)}
                    >
                      sync tallies
                    </button>
                  </span>
                </div>
              );
            })}
          </>
        )}
      </Win>

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
    </>
  );
}
