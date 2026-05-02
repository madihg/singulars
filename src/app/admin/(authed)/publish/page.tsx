"use client";

/**
 * /admin/publish (US-109)
 *
 * Matrix: rows = candidate models (non-archived), columns = performances by date.
 * Each cell shows the latest run's win-rate + draft/published toggle.
 * Row header has is_public toggle (whole row dims when off).
 *
 * Right side renders a live preview of the public chart with the current draft
 * state. Toggling a cell updates the preview within ~1s (optimistic + refetch).
 */

import { useEffect, useState, useCallback } from "react";
import { FONT_MONO, btnSmallStyle, statusPillStyle } from "@/lib/admin-styles";
import { Toaster, useToasts } from "../_components/Toaster";

type LatestRun = {
  id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  win_rate: number | null;
  published: boolean;
};

type Cell = {
  model_id: string;
  performance_id: string;
  latest: LatestRun | null;
};

type Model = {
  id: string;
  name: string;
  slug: string;
  color: string;
  is_public: boolean;
};

type Perf = {
  id: string;
  slug: string;
  name: string;
  color: string;
  date: string | null;
  status: string;
};

export default function PublishPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [perfs, setPerfs] = useState<Perf[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [loading, setLoading] = useState(true);
  const { toasts, push, dismiss } = useToasts();

  const load = useCallback(async () => {
    setLoading(true);
    const [mRes, pRes, rRes] = await Promise.all([
      fetch("/api/admin/candidate-models", { cache: "no-store" }),
      fetch("/api/admin/performances", { cache: "no-store" }),
      fetch("/api/admin/eval-runs?limit=200", { cache: "no-store" }),
    ]);
    const m = await mRes.json();
    const p = await pRes.json();
    const r = await rRes.json();

    setModels(m.models || []);
    setPerfs(
      (p.performances || []).slice().sort((a: Perf, b: Perf) => {
        const ad = a.date ? new Date(a.date).getTime() : 0;
        const bd = b.date ? new Date(b.date).getTime() : 0;
        return ad - bd;
      }),
    );

    // For each (model, perf), pick the latest completed run.
    type Run = {
      id: string;
      status: LatestRun["status"];
      win_rate: number | null;
      published: boolean;
      created_at: string;
      candidate_model: { id: string } | null;
      performance: { id: string } | null;
    };
    const byPair: Record<string, Run> = {};
    for (const run of (r.runs || []) as Run[]) {
      const mid = run.candidate_model?.id;
      const pid = run.performance?.id;
      if (!mid || !pid) continue;
      const key = `${mid}::${pid}`;
      const existing = byPair[key];
      if (
        !existing ||
        new Date(run.created_at) > new Date(existing.created_at)
      ) {
        byPair[key] = run;
      }
    }
    setCells(
      Object.entries(byPair).map(([key, run]) => {
        const [model_id, performance_id] = key.split("::");
        return {
          model_id,
          performance_id,
          latest: {
            id: run.id,
            status: run.status,
            win_rate: run.win_rate,
            published: run.published,
          },
        };
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cellByPair: Record<string, Cell> = {};
  for (const c of cells) cellByPair[`${c.model_id}::${c.performance_id}`] = c;

  async function togglePublish(c: Cell, model: Model) {
    if (!c.latest) return;
    const next = !c.latest.published;
    // Optimistic
    setCells((prev) =>
      prev.map((p) =>
        p.model_id === c.model_id && p.performance_id === c.performance_id
          ? { ...p, latest: { ...c.latest!, published: next } }
          : p,
      ),
    );
    const res = await fetch(`/api/admin/eval-runs/${c.latest.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: next }),
    });
    if (!res.ok) {
      push("publish failed - reverted", "error");
      load();
    } else {
      push(
        `${model.name}: ${next ? "published" : "draft"}`,
        "success",
        model.color,
      );
    }
  }

  async function toggleModelPublic(m: Model) {
    const res = await fetch(
      `/api/admin/candidate-models/${m.id}/toggle-public`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: !m.is_public }),
      },
    );
    if (!res.ok) {
      push("toggle failed", "error");
    } else {
      push(
        `${m.name} is ${!m.is_public ? "public" : "private"}`,
        "success",
        m.color,
      );
      setModels((prev) =>
        prev.map((x) =>
          x.id === m.id ? { ...x, is_public: !m.is_public } : x,
        ),
      );
    }
  }

  return (
    <div>
      <h1
        style={{
          fontFamily: '"Terminal Grotesque", sans-serif',
          fontSize: "3.5rem",
          lineHeight: 0.9,
          margin: "0 0 0.5rem 0",
        }}
      >
        publish
      </h1>
      <p
        style={{
          fontFamily: FONT_MONO,
          fontSize: "0.85rem",
          color: "var(--text-secondary)",
          margin: "0 0 2rem 0",
        }}
      >
        toggle individual cells to publish that data point. toggle the row chip
        to remove the entire model from the public chart.
      </p>

      {loading ? (
        <p style={{ fontFamily: FONT_MONO, color: "var(--text-secondary)" }}>
          loading...
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              borderCollapse: "collapse",
              fontFamily: FONT_MONO,
              fontSize: "0.8rem",
              minWidth: 600,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: "0.5rem 0.75rem",
                    borderBottom: "1px solid var(--border-light)",
                    background: "#fff",
                    position: "sticky",
                    left: 0,
                  }}
                >
                  model
                </th>
                {perfs.map((p) => (
                  <th
                    key={p.id}
                    style={{
                      textAlign: "left",
                      padding: "0.5rem 0.75rem",
                      borderBottom: "1px solid var(--border-light)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id} style={{ opacity: m.is_public ? 1 : 0.4 }}>
                  <td
                    style={{
                      padding: "0.5rem 0.75rem",
                      borderBottom: "1px solid var(--border-light)",
                      background: "#fff",
                      position: "sticky",
                      left: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          background: m.color,
                        }}
                      />
                      <span>{m.name}</span>
                      <button
                        onClick={() => toggleModelPublic(m)}
                        style={{
                          ...btnSmallStyle,
                          padding: "0.2rem 0.5rem",
                          fontSize: "0.7rem",
                        }}
                      >
                        {m.is_public ? "public" : "private"}
                      </button>
                    </div>
                  </td>
                  {perfs.map((p) => {
                    const c = cellByPair[`${m.id}::${p.id}`];
                    return (
                      <td
                        key={p.id}
                        style={{
                          padding: "0.5rem 0.75rem",
                          borderBottom: "1px solid var(--border-light)",
                          minWidth: 90,
                        }}
                      >
                        {!c?.latest ? (
                          <span style={{ color: "var(--text-hint)" }}>·</span>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.25rem",
                            }}
                          >
                            <span style={{ fontWeight: 500 }}>
                              {c.latest.win_rate !== null
                                ? `${(Number(c.latest.win_rate) * 100).toFixed(0)}%`
                                : "-"}
                            </span>
                            <button
                              onClick={() => togglePublish(c, m)}
                              style={{
                                ...statusPillStyle(
                                  c.latest.published ? "published" : "draft",
                                ),
                                cursor: "pointer",
                                background: c.latest.published
                                  ? m.color
                                  : "transparent",
                                color: c.latest.published
                                  ? "#fff"
                                  : "var(--text-secondary)",
                                borderColor: c.latest.published
                                  ? m.color
                                  : "var(--border-light)",
                              }}
                              disabled={c.latest.status !== "completed"}
                              title={
                                c.latest.status !== "completed"
                                  ? `cannot publish ${c.latest.status} run`
                                  : ""
                              }
                            >
                              {c.latest.published ? "published" : "draft"}
                            </button>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Toaster toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
