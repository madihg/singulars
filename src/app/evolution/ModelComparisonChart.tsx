"use client";

/**
 * <ModelComparisonChart /> - the middle /evolution chart.
 *
 * Classifier-based eval of public candidate models on reverse.exe (held-out
 * test set). One horizontal bar per model showing the normalized score (0-1)
 * plus a per-classifier breakdown segments inside the bar so you can see
 * WHICH dimensions a model wins or loses on.
 *
 * Reads /api/evals/model-comparison.
 */

import { useEffect, useState } from "react";

const MONO = '"Diatype Mono Variable", monospace';
const STANDARD = '"Standard", sans-serif';
const DISPLAY = '"Terminal Grotesque", sans-serif';

type ModelRow = {
  slug: string;
  name: string;
  family: string;
  color: string;
  score: number;
  per_classifier: Record<string, number>;
  n_themes: number;
  inter_rater_avg_stddev: number;
  perf_slug: string;
};

type ComparisonData = {
  classifiers_version: string;
  classifiers: Array<{ id: string; name: string; weight: number }>;
  models: ModelRow[];
};

export function ModelComparisonChart() {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/evals/model-comparison")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("network error"));
  }, []);

  if (error) {
    return (
      <p style={{ fontFamily: MONO, color: "var(--text-tertiary)" }}>{error}</p>
    );
  }
  if (!data) {
    return (
      <div
        style={{
          height: 200,
          background: "rgba(0,0,0,0.03)",
          fontFamily: MONO,
          fontSize: "0.8rem",
          color: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        loading…
      </div>
    );
  }

  if (data.models.length === 0) {
    return (
      <section style={{ marginBottom: "3.5rem" }}>
        <h2
          style={{
            fontFamily: DISPLAY,
            fontSize: "2rem",
            lineHeight: 0.95,
            margin: "0 0 0.4rem 0",
            fontWeight: 400,
          }}
        >
          model comparison
        </h2>
        <p
          style={{
            fontFamily: STANDARD,
            fontSize: "0.95rem",
            color: "var(--text-secondary)",
            margin: "0 0 1.5rem 0",
          }}
        >
          classifier-based eval pending. results land after the next run.
        </p>
      </section>
    );
  }

  const maxScore = Math.max(...data.models.map((m) => m.score), 0.001);

  return (
    <section style={{ marginBottom: "3.5rem" }}>
      <h2
        style={{
          fontFamily: DISPLAY,
          fontSize: "2rem",
          lineHeight: 0.95,
          margin: "0 0 0.4rem 0",
          fontWeight: 400,
        }}
      >
        model comparison
      </h2>
      <p
        style={{
          fontFamily: STANDARD,
          fontSize: "0.95rem",
          lineHeight: 1.5,
          color: "var(--text-secondary)",
          margin: "0 0 1.75rem 0",
          maxWidth: 600,
        }}
      >
        each candidate scored by a council of 3 judges (gpt-5 · claude opus
        4.7 · deepseek r1) against a {data.classifiers.length}-classifier
        rubric extracted from {data.models[0]?.n_themes ? "37 historical" : ""}{" "}
        winner/loser pairs. higher score = closer to what the audience
        consistently rewards. evaluated on reverse.exe (held-out test set).
      </p>

      <div role="table" aria-label="model comparison classifier scores">
        {data.models.map((m) => {
          const widthPct = (m.score / maxScore) * 100;
          // Build classifier breakdown bar - normalize per-classifier mean
          // (0-5) * weight, sum to total raw points.
          const segs = data.classifiers
            .map((c) => {
              const v = m.per_classifier[c.id] || 0;
              const points = v * c.weight;
              return { id: c.id, name: c.name, points, score05: v };
            })
            .filter((s) => s.points > 0);
          const totalPoints = segs.reduce((s, x) => s + x.points, 0);
          return (
            <div
              key={m.slug}
              role="row"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(180px, 28%) 1fr",
                gap: "0.75rem",
                alignItems: "center",
                padding: "0.85rem 0",
                borderTop: "1px solid var(--border-light)",
              }}
            >
              <div role="rowheader">
                <div
                  style={{
                    fontFamily: STANDARD,
                    fontSize: "1rem",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      background: m.color,
                      flexShrink: 0,
                    }}
                  />
                  {m.name}
                </div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: "0.72rem",
                    color: "var(--text-tertiary)",
                    marginTop: "0.15rem",
                  }}
                >
                  score {(m.score * 100).toFixed(0)}% · {m.n_themes} themes ·{" "}
                  inter-rater σ {m.inter_rater_avg_stddev.toFixed(2)}
                </div>
              </div>
              <div role="cell">
                <div
                  style={{
                    display: "flex",
                    height: 26,
                    width: `${Math.max(widthPct, 6)}%`,
                    minWidth: 60,
                    border: "1px solid rgba(0,0,0,0.18)",
                    background: "rgba(0,0,0,0.02)",
                  }}
                  aria-label={`${m.name} score ${(m.score * 100).toFixed(0)}%`}
                >
                  {segs.map((s) => {
                    const pct = totalPoints > 0 ? (s.points / totalPoints) * 100 : 0;
                    // Color segments by classifier - use a hue rotation off the
                    // model's base color so the breakdown stays per-model
                    // recognizable.
                    return (
                      <div
                        key={s.id}
                        title={`${s.id} · ${s.name}: ${s.score05.toFixed(1)}/5`}
                        style={{
                          width: `${pct}%`,
                          background: m.color,
                          opacity: 0.4 + (s.score05 / 5) * 0.6,
                          borderRight: "1px solid rgba(255,255,255,0.5)",
                        }}
                      />
                    );
                  })}
                </div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: "0.7rem",
                    color: "var(--text-tertiary)",
                    marginTop: "0.4rem",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.4rem 0.85rem",
                  }}
                >
                  {data.classifiers.map((c) => {
                    const v = m.per_classifier[c.id];
                    if (typeof v !== "number") return null;
                    return (
                      <span key={c.id}>
                        <strong style={{ color: m.color }}>{c.id}</strong>{" "}
                        <span>{v.toFixed(1)}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Classifier legend */}
      <details
        style={{
          marginTop: "1.25rem",
          padding: "1rem 0 0 0",
          borderTop: "1px solid var(--border-light)",
        }}
      >
        <summary
          style={{
            fontFamily: MONO,
            fontSize: "0.78rem",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            letterSpacing: "0.02em",
          }}
        >
          classifier rubric ({data.classifiers.length}, version{" "}
          {data.classifiers_version})
        </summary>
        <ul
          style={{
            fontFamily: STANDARD,
            fontSize: "0.85rem",
            lineHeight: 1.6,
            color: "var(--text-secondary)",
            marginTop: "0.5rem",
            paddingLeft: "1.2rem",
          }}
        >
          {data.classifiers.map((c) => (
            <li key={c.id}>
              <strong>{c.id} - {c.name}</strong>{" "}
              <span style={{ color: "var(--text-tertiary)" }}>
                (weight {c.weight})
              </span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
