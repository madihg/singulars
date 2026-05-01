"use client";

/**
 * Model Evolution Chart + Head-to-Head Matrix (US-117).
 *
 * - Chart: line per model, x = performance milestones (in date order),
 *   y = win rate. Hover dims other lines (selection-by-contrast-collapse).
 * - Matrix below: row = model, col = perf, cell = win-rate %. Tap = drilldown.
 *
 * Match the Singulars design system (see PRD §6.5):
 *   - Terminal Grotesque H1, Diatype Mono labels, white bg, no shadows.
 *   - Mobile: matrix scrolls horizontally with sticky model column.
 *
 * Empty state: "evaluation in progress - first results will appear after ground.exe."
 */

import { useEffect, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const MONO = '"Diatype Mono Variable", monospace';
const DISPLAY = '"Terminal Grotesque", sans-serif';
const STANDARD = '"Standard", sans-serif';

type Performance = {
  slug: string;
  name: string;
  color: string;
  location: string | null;
  date: string | null;
  status: string;
};

type Model = {
  slug: string;
  name: string;
  family: string;
  color: string;
  is_public: boolean;
  series: Array<{ perf: string; rate: number; n_themes: number }>;
};

type Results = { performances: Performance[]; models: Model[] };

type ThemeRow = {
  theme: string;
  theme_slug: string;
  audience_winner_text: string | null;
  audience_winner_type: string | null;
  candidate_text: string;
  candidate_won: boolean;
  confidence: string | null;
  judge_rationale: string | null;
};

export default function EvolutionView() {
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<{
    model: Model;
    perf: Performance;
    themes: ThemeRow[] | null;
    loading: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/evals/results")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("network error"));
  }, []);

  const openCell = useCallback(async (model: Model, perf: Performance) => {
    setDrilldown({ model, perf, themes: null, loading: true });
    try {
      const r = await fetch(
        `/api/evals/themes?model=${encodeURIComponent(model.slug)}&perf=${encodeURIComponent(perf.slug)}`,
      );
      if (!r.ok) {
        setDrilldown((s) => (s ? { ...s, themes: [], loading: false } : s));
        return;
      }
      const j = await r.json();
      setDrilldown((s) =>
        s ? { ...s, themes: j.themes || [], loading: false } : s,
      );
    } catch {
      setDrilldown((s) => (s ? { ...s, themes: [], loading: false } : s));
    }
  }, []);

  if (error) {
    return (
      <main style={{ padding: "4rem 2rem", maxWidth: 800, margin: "0 auto" }}>
        <p style={{ fontFamily: MONO }}>{error}</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main style={{ padding: "4rem 2rem", maxWidth: 800, margin: "0 auto" }}>
        <Skeleton />
      </main>
    );
  }

  const isEmpty = data.models.length === 0;

  // Build chart data: array of { perf: name, [model.slug]: rate }
  const chartData = data.performances.map((p) => {
    const row: Record<string, string | number> = {
      perf: p.name,
      perfSlug: p.slug,
    };
    for (const m of data.models) {
      const point = m.series.find((s) => s.perf === p.slug);
      if (point) row[m.slug] = Math.round(point.rate * 100);
    }
    return row;
  });

  return (
    <main
      style={{
        padding: "4rem 2rem",
        maxWidth: 800,
        margin: "0 auto",
      }}
    >
      <h1
        style={{
          fontFamily: DISPLAY,
          fontSize: "7rem",
          lineHeight: 0.9,
          fontWeight: 400,
          margin: "0 0 1rem 0",
        }}
      >
        evolution
      </h1>
      <p
        style={{
          fontFamily: STANDARD,
          fontSize: "1.05rem",
          lineHeight: 1.5,
          color: "var(--text-secondary)",
          maxWidth: 560,
          margin: "0 0 3rem 0",
        }}
      >
        the audience trains the machine. each performance updates how every
        model fares against the winners. lines rising means models learning the
        room - or, sometimes, the room learning to lose.
      </p>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {/* Chart */}
          <section style={{ marginBottom: "3rem" }}>
            <h2 style={sectionHeading}>win rate over time</h2>
            <div
              style={{
                width: "100%",
                height: 360,
                marginTop: "1rem",
              }}
              role="figure"
              aria-label="model win rate per performance"
            >
              <ResponsiveContainer>
                <LineChart
                  data={chartData}
                  margin={{ top: 16, right: 24, bottom: 16, left: 0 }}
                >
                  <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis
                    dataKey="perf"
                    stroke="rgba(0,0,0,0.5)"
                    tick={{ fontFamily: MONO, fontSize: 11 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    stroke="rgba(0,0,0,0.5)"
                    tick={{ fontFamily: MONO, fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid rgba(0,0,0,0.75)",
                      borderRadius: 0,
                      fontFamily: MONO,
                      fontSize: "0.85rem",
                    }}
                    labelStyle={{ fontFamily: STANDARD, fontWeight: 500 }}
                    formatter={(value, name) => [`${value}%`, name as string]}
                  />
                  {data.models.map((m) => (
                    <Line
                      key={m.slug}
                      type="monotone"
                      dataKey={m.slug}
                      name={m.name}
                      stroke={m.color}
                      strokeWidth={1.5}
                      dot={{ r: 3, fill: m.color }}
                      activeDot={{ r: 5 }}
                      connectNulls
                      opacity={
                        hoveredModel && hoveredModel !== m.slug ? 0.4 : 1
                      }
                      onMouseEnter={() => setHoveredModel(m.slug)}
                      onMouseLeave={() => setHoveredModel(null)}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Screen-reader narration */}
            <ul
              aria-label="model series description"
              style={{
                position: "absolute",
                left: "-9999px",
                width: 1,
                height: 1,
                overflow: "hidden",
              }}
            >
              {data.models.map((m) => {
                const first = m.series[0];
                const last = m.series[m.series.length - 1];
                if (!first || !last) return null;
                return (
                  <li key={m.slug}>
                    {m.name}: {(first.rate * 100).toFixed(0)}% on {first.perf}{" "}
                    to {(last.rate * 100).toFixed(0)}% on {last.perf} across{" "}
                    {m.series.length} performances
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Matrix */}
          <section>
            <h2 style={sectionHeading}>head-to-head</h2>
            <div
              style={{
                marginTop: "1rem",
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  borderCollapse: "collapse",
                  fontFamily: MONO,
                  fontSize: "0.85rem",
                  minWidth: 480,
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        ...thStyle,
                        position: "sticky",
                        left: 0,
                        background: "#fff",
                      }}
                    >
                      model
                    </th>
                    {data.performances.map((p) => (
                      <th key={p.slug} style={thStyle}>
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.models.map((m) => (
                    <tr key={m.slug}>
                      <td
                        style={{
                          ...tdStyle,
                          position: "sticky",
                          left: 0,
                          background: "#fff",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              background: m.color,
                            }}
                          />
                          <span
                            style={{ fontFamily: STANDARD, fontWeight: 500 }}
                          >
                            {m.name}
                          </span>
                        </div>
                      </td>
                      {data.performances.map((p) => {
                        const pt = m.series.find((s) => s.perf === p.slug);
                        return (
                          <td key={p.slug} style={tdStyle}>
                            {pt ? (
                              <button
                                onClick={() => openCell(m, p)}
                                style={cellButtonStyle(m.color, pt.rate)}
                                aria-label={`${m.name} on ${p.name}: ${(pt.rate * 100).toFixed(0)} percent`}
                              >
                                {(pt.rate * 100).toFixed(0)}%
                              </button>
                            ) : (
                              <span style={{ color: "rgba(0,0,0,0.4)" }}>
                                ·
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
          </section>

          <Footer data={data} />
        </>
      )}

      {drilldown ? (
        <Drilldown
          model={drilldown.model}
          perf={drilldown.perf}
          themes={drilldown.themes}
          loading={drilldown.loading}
          onClose={() => setDrilldown(null)}
        />
      ) : null}
    </main>
  );
}

function Skeleton() {
  return (
    <div>
      <div
        style={{
          height: 96,
          background: "rgba(0,0,0,0.06)",
          marginBottom: 32,
          width: "60%",
        }}
      />
      <div
        style={{
          height: 240,
          background: "rgba(0,0,0,0.04)",
          marginBottom: 32,
        }}
      />
      <div style={{ height: 200, background: "rgba(0,0,0,0.04)" }} />
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: "4rem 0",
        textAlign: "center",
        fontFamily: STANDARD,
        fontSize: "1.05rem",
        color: "var(--text-secondary)",
      }}
    >
      evaluation in progress - first results will appear after ground.exe.
    </div>
  );
}

function Footer({ data }: { data: Results }) {
  // Derive judge model + last update from the chart data shape - if no models
  // shown, no footer.
  if (data.models.length === 0) return null;
  return (
    <p
      style={{
        fontFamily: MONO,
        fontSize: "0.8rem",
        color: "var(--text-tertiary)",
        marginTop: "3rem",
      }}
    >
      {data.models.length} model{data.models.length === 1 ? "" : "s"} ·{" "}
      {data.performances.length} performance
      {data.performances.length === 1 ? "" : "s"}
    </p>
  );
}

function Drilldown({
  model,
  perf,
  themes,
  loading,
  onClose,
}: {
  model: Model;
  perf: Performance;
  themes: ThemeRow[] | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.25)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-end",
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`${model.name} on ${perf.name}`}
        style={{
          background: "#fff",
          width: "min(640px, 100%)",
          maxHeight: "100vh",
          overflowY: "auto",
          padding: "2rem",
          borderLeft: "1px solid rgba(0,0,0,0.75)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="close"
          style={{
            background: "transparent",
            border: "none",
            fontFamily: MONO,
            fontSize: "1rem",
            cursor: "pointer",
            float: "right",
            color: "var(--text-secondary)",
          }}
        >
          ×
        </button>
        <h3
          style={{
            fontFamily: '"Diatype Variable", sans-serif',
            fontSize: "1.4rem",
            fontWeight: 700,
            margin: "0 0 0.25rem 0",
          }}
        >
          {model.name}
        </h3>
        <p
          style={{
            fontFamily: MONO,
            fontSize: "0.9rem",
            color: "var(--text-secondary)",
            margin: "0 0 1.5rem 0",
          }}
        >
          on {perf.name}
        </p>
        {loading ? (
          <p style={{ fontFamily: MONO }}>loading...</p>
        ) : !themes || themes.length === 0 ? (
          <p style={{ fontFamily: MONO, color: "var(--text-secondary)" }}>
            no themes available.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {themes.map((t) => (
              <li
                key={t.theme_slug}
                style={{
                  borderTop: "1px solid var(--border-light)",
                  padding: "1.25rem 0",
                }}
              >
                <h4
                  style={{
                    fontFamily: '"Diatype Variable", sans-serif',
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    margin: "0 0 0.75rem 0",
                  }}
                >
                  {t.theme}
                </h4>
                <Block
                  label={`audience winner${t.audience_winner_type ? ` (${t.audience_winner_type})` : ""}`}
                  text={t.audience_winner_text}
                />
                <Block
                  label="candidate"
                  text={t.candidate_text}
                  accent={t.candidate_won ? model.color : undefined}
                />
                {t.judge_rationale ? (
                  <p
                    style={{
                      fontFamily: STANDARD,
                      fontStyle: "italic",
                      fontSize: "0.9rem",
                      lineHeight: 1.6,
                      color: "var(--text-secondary)",
                      marginTop: "0.75rem",
                    }}
                  >
                    {t.judge_rationale}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

function Block({
  label,
  text,
  accent,
}: {
  label: string;
  text: string | null;
  accent?: string;
}) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--text-tertiary)",
          marginBottom: "0.5rem",
        }}
      >
        {label}
      </div>
      <p
        style={{
          fontFamily: STANDARD,
          fontSize: "0.95rem",
          lineHeight: 1.7,
          margin: 0,
          whiteSpace: "pre-line",
          paddingLeft: "0.75rem",
          borderLeft: accent
            ? `2px solid ${accent}`
            : "2px solid rgba(0,0,0,0.12)",
        }}
      >
        {text || "(missing)"}
      </p>
    </div>
  );
}

const sectionHeading = {
  fontFamily: '"Diatype Variable", sans-serif',
  fontSize: "1.3rem",
  fontWeight: 700,
  margin: 0,
  textTransform: "lowercase" as const,
};

const thStyle = {
  textAlign: "left" as const,
  padding: "0.5rem 0.75rem",
  borderBottom: "1px solid rgba(0,0,0,0.12)",
  fontFamily: MONO,
  fontSize: "0.75rem",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  color: "rgba(0,0,0,0.5)",
  whiteSpace: "nowrap" as const,
};

const tdStyle = {
  padding: "0.5rem 0.75rem",
  borderBottom: "1px solid rgba(0,0,0,0.06)",
  whiteSpace: "nowrap" as const,
};

function cellButtonStyle(color: string, rate: number): React.CSSProperties {
  const pct = Math.round(rate * 100);
  return {
    fontFamily: MONO,
    fontSize: "0.85rem",
    background: `linear-gradient(to right, ${color}33 ${pct}%, transparent ${pct}%)`,
    border: "1px solid rgba(0,0,0,0.06)",
    padding: "0.4rem 0.6rem",
    cursor: "pointer",
    color: "var(--text-primary)",
    width: "100%",
    textAlign: "left" as const,
  };
}
