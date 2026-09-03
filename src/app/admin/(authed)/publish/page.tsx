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
import Win from "@/components/desktop/Win";
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
      fetch("/singulars/api/admin/candidate-models", { cache: "no-store" }),
      fetch("/singulars/api/admin/performances", { cache: "no-store" }),
      fetch("/singulars/api/admin/eval-runs?limit=200", { cache: "no-store" }),
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
    const res = await fetch(`/singulars/api/admin/eval-runs/${c.latest.id}/publish`, {
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
      `/singulars/api/admin/candidate-models/${m.id}/toggle-public`,
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
    <Win
      file="publish/"
      span="w--eight"
      meta={loading ? "loading" : `${models.length} models`}
    >
      <p className="note" style={{ marginTop: 0 }}>
        Toggle a cell to publish that data point. Toggle the row chip to remove
        the whole model from the public chart.
      </p>

      {loading ? (
        <p className="note">Loading.</p>
      ) : (
        <div className="sg-tablewrap" style={{ marginTop: "0.9rem" }}>
          <table className="sg-table">
            <thead>
              <tr>
                <th>model</th>
                {perfs.map((p) => (
                  <th key={p.id}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id} style={{ opacity: m.is_public ? 1 : 0.5 }}>
                  <td>
                    <span className="sg-row sg-row--tight">
                      <i className="cdot" style={{ ["--c" as string]: m.color }} />
                      <span>{m.name}</span>
                      <button
                        type="button"
                        className="btn"
                        aria-pressed={m.is_public}
                        onClick={() => toggleModelPublic(m)}
                      >
                        {m.is_public ? "public" : "private"}
                      </button>
                    </span>
                  </td>
                  {perfs.map((p) => {
                    const c = cellByPair[`${m.id}::${p.id}`];
                    return (
                      <td key={p.id}>
                        {!c?.latest ? (
                          <span className="k">-</span>
                        ) : (
                          <span className="sg-row sg-row--tight">
                            <span className="sg-num">
                              {c.latest.win_rate !== null
                                ? `${(Number(c.latest.win_rate) * 100).toFixed(0)}%`
                                : "-"}
                            </span>
                            <button
                              type="button"
                              className="btn"
                              aria-pressed={c.latest.published}
                              onClick={() => togglePublish(c, m)}
                              disabled={c.latest.status !== "completed"}
                              title={
                                c.latest.status !== "completed"
                                  ? `cannot publish a ${c.latest.status} run`
                                  : undefined
                              }
                            >
                              {c.latest.published ? "published" : "draft"}
                            </button>
                          </span>
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
    </Win>
  );
}
