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
import {
  FONT_MONO,
  btnSmallStyle,
  statusPillStyle,
  formatDate,
} from "@/lib/admin-styles";

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
      const res = await fetch(`/api/admin/eval-runs?${params.toString()}`, {
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
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <h1
          style={{
            fontFamily: '"Terminal Grotesque", sans-serif',
            fontSize: "3.5rem",
            lineHeight: 0.9,
            margin: 0,
          }}
        >
          eval runs
        </h1>
        <Link
          href="/admin/eval-runs/new"
          style={{ ...btnSmallStyle, textDecoration: "none" }}
        >
          + run new eval
        </Link>
      </div>

      {/* Filter chips */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
          marginBottom: "1.5rem",
        }}
      >
        <Chip active={status === ""} onClick={() => setFilter("status", null)}>
          all
        </Chip>
        {STATUSES.map((s) => (
          <Chip
            key={s}
            active={status === s}
            onClick={() => setFilter("status", s)}
          >
            {s}
          </Chip>
        ))}
        <span style={{ marginLeft: "auto" }} />
        <Chip
          active={!!perf || !!model}
          onClick={() => {
            setFilter("perf", null);
            setFilter("model", null);
          }}
        >
          {perf || model
            ? `clear: ${perf || ""} ${model || ""}`
            : "no perf/model filter"}
        </Chip>
      </div>

      {pollError ? (
        <div
          style={{
            ...statusPillStyle("failed"),
            marginBottom: "1rem",
          }}
        >
          {pollError}
        </div>
      ) : null}

      {loading ? (
        <p style={{ fontFamily: FONT_MONO, color: "var(--text-secondary)" }}>
          loading...
        </p>
      ) : error ? (
        <p style={{ fontFamily: FONT_MONO, color: "#dc2626" }}>{error}</p>
      ) : runs.length === 0 ? (
        <p style={{ fontFamily: FONT_MONO, color: "var(--text-secondary)" }}>
          no eval runs match these filters.{" "}
          <Link
            href="/admin/eval-runs"
            style={{ color: "var(--text-primary)" }}
          >
            clear filters
          </Link>
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {runs.map((r) => (
            <li
              key={r.id}
              style={{
                borderTop: "1px solid var(--border-light)",
                padding: "1rem 0",
              }}
            >
              <Link
                href={`/admin/eval-runs/${r.id}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                  alignItems: "baseline",
                }}
              >
                {r.candidate_model ? (
                  <div
                    aria-hidden
                    style={{
                      width: 12,
                      height: 12,
                      background: r.candidate_model.color,
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  />
                ) : null}
                <span
                  style={{
                    fontFamily: '"Standard", sans-serif',
                    fontSize: "1rem",
                    fontWeight: 500,
                    flex: "1 1 200px",
                  }}
                >
                  {r.candidate_model?.name || "?"}{" "}
                  <span
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: "0.85rem",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    on {r.performance?.name || "?"}
                  </span>
                </span>
                <span style={statusPillStyle(r.status)}>{r.status}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: "0.85rem" }}>
                  {r.win_rate !== null
                    ? `${(Number(r.win_rate) * 100).toFixed(0)}%`
                    : "-"}
                  {r.n_themes > 0
                    ? ` · ${r.n_themes_completed}/${r.n_themes}`
                    : ""}
                </span>
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: "0.8rem",
                    color: "var(--text-tertiary)",
                  }}
                >
                  {r.cost_usd !== null
                    ? `$${Number(r.cost_usd).toFixed(2)}`
                    : ""}{" "}
                  · {formatDate(r.created_at)}
                </span>
                {r.published ? (
                  <span style={statusPillStyle("published")}>published</span>
                ) : (
                  <span style={statusPillStyle("draft")}>draft</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
    <button
      onClick={onClick}
      style={{
        fontFamily: FONT_MONO,
        fontSize: "0.85rem",
        padding: "0.25rem 0.7rem",
        border: "1px solid var(--border-light)",
        borderRadius: "2px",
        background: active ? "rgba(0,0,0,0.06)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        opacity: active ? 1 : 0.6,
        cursor: "pointer",
      }}
    >
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
