"use client";

/**
 * /admin/eval-runs (US-106)
 *
 * Lists all eval_runs joined with model + performance. Filter chips for
 * status / performance / model. Live polling at 5s when any visible row is
 * pending or running. Polling stops when no live rows + when tab is hidden.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { formatDate } from "@/lib/admin-format";
import Win from "@/components/desktop/Win";

type Run = {
  id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  judge_model: string;
  n_themes: number;
  n_themes_completed: number;
  win_rate: number | null;
  cost_usd: number | null;
  published: boolean;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
  candidate_model: {
    id: string;
    slug: string;
    name: string;
    color: string;
  } | null;
  performance: {
    id: string;
    slug: string;
    name: string;
    color: string;
    date: string | null;
    status: string;
  } | null;
};

const STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export default function EvalRunsPage() {
  const search = useSearchParams();
  const router = useRouter();
  const status = search?.get("status") || "";
  const perf = search?.get("perf") || "";
  const model = search?.get("model") || "";

  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const tabVisible = useTabVisible();
  const fetchRef = useRef<() => void>();

  const fetchRuns = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (perf) params.set("perf", perf);
    if (model) params.set("model", model);
    try {
      const res = await fetch(`/singulars/api/admin/eval-runs?${params.toString()}`, {
        cache: "no-store",
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j?.error || "failed");
        setPollError("polling failed - retry in 30s");
      } else {
        setRuns(j.runs);
        setPollError(null);
      }
    } catch {
      setPollError("polling failed - retry in 30s");
    } finally {
      setLoading(false);
    }
  }, [status, perf, model]);
  fetchRef.current = fetchRuns;

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Live polling
  useEffect(() => {
    const live = runs.some(
      (r) => r.status === "pending" || r.status === "running",
    );
    if (!live || !tabVisible) return;
    const interval = setInterval(() => fetchRef.current?.(), 5000);
    return () => clearInterval(interval);
  }, [runs, tabVisible]);

  function setFilter(key: string, value: string | null) {
    const next = new URLSearchParams(search?.toString() || "");
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    router.push(`/admin/eval-runs?${next.toString()}`);
  }

  return (
    <>
      <Win
        file="eval-runs/"
        span="w--eight"
        meta={loading ? "loading" : `${runs.length} runs`}
      >
        <div className="sg-row sg-row--between" style={{ marginBottom: "0.9rem" }}>
          <div className="sg-row sg-row--tight">
            <Chip active={status === ""} onClick={() => setFilter("status", null)}>
              all
            </Chip>
            {STATUSES.map((st) => (
              <Chip
                key={st}
                active={status === st}
                onClick={() => setFilter("status", st)}
              >
                {st}
              </Chip>
            ))}
            <Chip
              active={!!perf || !!model}
              onClick={() => {
                setFilter("perf", null);
                setFilter("model", null);
              }}
            >
              {perf || model
                ? `clear: ${perf || ""} ${model || ""}`
                : "no perf or model filter"}
            </Chip>
          </div>
          <Link className="btn btn--send" href="/admin/eval-runs/new">
            run new eval
          </Link>
        </div>

        {pollError ? <p className="sg-err">{pollError}</p> : null}

        {loading ? (
          <p className="note" style={{ marginTop: 0 }}>
            Loading.
          </p>
        ) : error ? (
          <p className="sg-err" style={{ marginTop: 0 }}>
            {error}
          </p>
        ) : runs.length === 0 ? (
          <p className="note" style={{ marginTop: 0 }}>
            No eval runs match these filters.{" "}
            <Link href="/admin/eval-runs">clear filters</Link>
          </p>
        ) : (
          <>
            <div className="hdr">
              <span className="k">run</span>
              <span className="k">status</span>
              <span className="k">result</span>
              <span className="k">when</span>
            </div>
            {runs.map((r) => (
              <Link
                className="sg-line sg-line--4"
                key={r.id}
                href={`/admin/eval-runs/${r.id}`}
              >
                <span className="sg-line__n">
                  {r.candidate_model ? (
                    <i
                      className="cdot"
                      style={{ ["--c" as string]: r.candidate_model.color }}
                    />
                  ) : null}
                  {r.candidate_model?.name || "?"} on{" "}
                  {r.performance?.name || "?"}
                </span>
                <span className="fr__s">
                  <span className="sg-pill" data-state={r.status}>
                    {r.status}
                  </span>
                </span>
                <span className="fr__w">
                  {r.win_rate !== null
                    ? `${(Number(r.win_rate) * 100).toFixed(0)}%`
                    : "-"}
                  {r.n_themes > 0
                    ? ` · ${r.n_themes_completed}/${r.n_themes} themes`
                    : ""}
                  {r.cost_usd !== null
                    ? ` · $${Number(r.cost_usd).toFixed(2)}`
                    : ""}
                  {" · "}
                  <span
                    className="sg-pill"
                    data-state={r.published ? "published" : "draft"}
                  >
                    {r.published ? "published" : "draft"}
                  </span>
                </span>
                <span className="fr__d">{formatDate(r.created_at)}</span>
              </Link>
            ))}
          </>
        )}
      </Win>
    </>
  );
}

/** A filter chip: a .btn that reports its own pressed state. */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className="btn" aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}

function useTabVisible() {
  const [v, setV] = useState(true);
  useEffect(() => {
    const handler = () => setV(!document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);
  return v;
}
