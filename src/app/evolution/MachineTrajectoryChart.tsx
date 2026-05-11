"use client";

/**
 * <MachineTrajectoryChart /> - the third /evolution chart.
 *
 * Two lines (Halim, machine) showing per-performance average classifier
 * score from retroactively-judged archived poems. Tells the evolution
 * story: have both authors improved on audience-taste dimensions across the
 * series, regardless of who won the live vote?
 *
 * Reads /api/evals/quality-trajectory.
 */

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

const MONO = '"Diatype Mono Variable", monospace';
const STANDARD = '"Standard", sans-serif';
const DISPLAY = '"Terminal Grotesque", sans-serif';

const HUMAN_COLOR = "#171717";
const MACHINE_COLOR = "#D97706";

type Point = {
  perf_slug: string;
  perf_name: string;
  perf_date: string | null;
  perf_color: string;
  perf_status: string;
  avg_score: number;
  n_poems: number;
  stddev_score: number | null;
};

type TrajectoryData = {
  classifiers_version: string;
  performances: Array<{
    perf_slug: string;
    perf_name: string;
    perf_date: string | null;
    perf_color: string;
    perf_status: string;
    pending: boolean;
    n_themes_total: number;
    complete: boolean;
  }>;
  series: {
    human: Point[];
    machine: Point[];
  };
  scoring_progress: {
    poems_scored: number;
    poems_total: number;
    complete: boolean;
  };
};

export function MachineTrajectoryChart() {
  const [data, setData] = useState<TrajectoryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/evals/quality-trajectory")
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
          height: 320,
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

  // Only plot performances where BOTH authors have classifier scores on every
  // audience-decided theme. Partial perfs (in-flight scoring) would render as
  // misleading low-sample data points.
  const completePerfs = data.performances.filter((p) => p.complete);
  const progressPct =
    data.scoring_progress.poems_total > 0
      ? Math.round(
          (data.scoring_progress.poems_scored /
            data.scoring_progress.poems_total) *
            100,
        )
      : 0;

  if (completePerfs.length === 0) {
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
          quality over time
        </h2>
        <p
          style={{
            fontFamily: STANDARD,
            fontSize: "0.95rem",
            color: "var(--text-secondary)",
            margin: "0 0 1.5rem 0",
          }}
        >
          retroactive classifier scoring in progress —{" "}
          {data.scoring_progress.poems_scored} of{" "}
          {data.scoring_progress.poems_total} poems scored ({progressPct}%).
          trajectory will appear once at least one performance is fully scored.
        </p>
      </section>
    );
  }

  // Build chart data: one row per fully-scored performance (in date order),
  // with halim_score and machine_score as percentages.
  const humanBySlug = new Map(data.series.human.map((p) => [p.perf_slug, p]));
  const machineBySlug = new Map(data.series.machine.map((p) => [p.perf_slug, p]));
  const chartData = completePerfs.map((perf) => {
    const h = humanBySlug.get(perf.perf_slug);
    const m = machineBySlug.get(perf.perf_slug);
    return {
      perf: perf.perf_name.replace(".exe", ""),
      perfSlug: perf.perf_slug,
      halim: h ? Math.round(h.avg_score * 100) : null,
      machine: m ? Math.round(m.avg_score * 100) : null,
      halim_n: h?.n_poems || 0,
      machine_n: m?.n_poems || 0,
    };
  });
  const inFlightPerfs = data.performances.filter(
    (p) => !p.pending && !p.complete && p.perf_status === "trained",
  );

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
        quality over time
      </h2>
      <p
        style={{
          fontFamily: STANDARD,
          fontSize: "0.95rem",
          lineHeight: 1.5,
          color: "var(--text-secondary)",
          margin: "0 0 1.75rem 0",
          maxWidth: 620,
        }}
      >
        the actual poems halim and the machine wrote at each live show,
        retroactively scored against the same {data.classifiers_version}{" "}
        classifier rubric. higher score = closer to what the audience
        consistently rewards. lines rising = improving on audience-taste
        dimensions, independent of who won the live vote.
      </p>
      {!data.scoring_progress.complete ? (
        <p
          style={{
            fontFamily: MONO,
            fontSize: "0.78rem",
            color: "var(--text-tertiary)",
            margin: "-0.5rem 0 1.5rem 0",
            letterSpacing: "0.01em",
          }}
        >
          scoring in progress: {data.scoring_progress.poems_scored} of{" "}
          {data.scoring_progress.poems_total} poems ({progressPct}%).
          {inFlightPerfs.length > 0
            ? ` showing only the ${completePerfs.length} fully-scored performance${completePerfs.length === 1 ? "" : "s"}; ${inFlightPerfs
                .map((p) => p.perf_name.replace(".exe", ""))
                .join(", ")} will appear once complete.`
            : ""}
        </p>
      ) : null}

      <div
        style={{ width: "100%", height: 320 }}
        role="figure"
        aria-label="halim and machine classifier-score trajectory across performances"
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
              formatter={(value, name, ctx) => {
                const slug = (ctx?.dataKey as string) || "";
                const payload = ctx?.payload as
                  | { halim_n?: number; machine_n?: number }
                  | undefined;
                const n =
                  slug === "halim" ? payload?.halim_n : payload?.machine_n;
                return [`${value}% (${n} poems)`, name as string];
              }}
            />
            <Legend
              wrapperStyle={{ fontFamily: MONO, fontSize: "0.8rem" }}
              iconType="square"
            />
            <Line
              type="monotone"
              dataKey="halim"
              name="halim"
              stroke={HUMAN_COLOR}
              strokeWidth={2}
              dot={{ r: 4, fill: HUMAN_COLOR }}
              activeDot={{ r: 6 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="machine"
              name="machine"
              stroke={MACHINE_COLOR}
              strokeWidth={2}
              dot={{ r: 4, fill: MACHINE_COLOR }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Inline data table for accessibility + transparency */}
      <details
        style={{
          marginTop: "1rem",
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
          per-performance breakdown
        </summary>
        <table
          style={{
            marginTop: "0.5rem",
            fontFamily: MONO,
            fontSize: "0.8rem",
            color: "var(--text-secondary)",
            borderCollapse: "collapse",
            width: "100%",
          }}
        >
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ padding: "0.25rem 0.5rem 0.25rem 0" }}>performance</th>
              <th style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>
                halim
              </th>
              <th style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>
                machine
              </th>
              <th style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>
                Δ
              </th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((r) => {
              const delta =
                r.halim != null && r.machine != null ? r.halim - r.machine : null;
              return (
                <tr
                  key={r.perfSlug}
                  style={{ borderTop: "1px solid var(--border-light)" }}
                >
                  <td style={{ padding: "0.35rem 0.5rem 0.35rem 0" }}>
                    {r.perf}
                  </td>
                  <td
                    style={{
                      padding: "0.35rem 0.5rem",
                      textAlign: "right",
                      color: HUMAN_COLOR,
                      fontWeight: 600,
                    }}
                  >
                    {r.halim != null ? `${r.halim}%` : "–"}{" "}
                    <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>
                      (n={r.halim_n})
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "0.35rem 0.5rem",
                      textAlign: "right",
                      color: MACHINE_COLOR,
                      fontWeight: 600,
                    }}
                  >
                    {r.machine != null ? `${r.machine}%` : "–"}{" "}
                    <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>
                      (n={r.machine_n})
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "0.35rem 0.5rem",
                      textAlign: "right",
                      color:
                        delta == null
                          ? "var(--text-tertiary)"
                          : delta > 0
                            ? HUMAN_COLOR
                            : MACHINE_COLOR,
                    }}
                  >
                    {delta == null
                      ? "–"
                      : delta > 0
                        ? `+${delta}`
                        : `${delta}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </section>
  );
}
