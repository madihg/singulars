"use client";

/**
 * <ClassifierGapHeatmap /> - per-classifier gap between Halim and the
 * machine across the 5 trained performances. Rows = perfs, cols =
 * classifiers. Color encodes gap = halim_avg - machine_avg:
 *   - black (ink) = halim ahead
 *   - orange (machine accent) = machine ahead
 *   - near-white = approximately equal
 *
 * Reveals WHERE the gap lives. Helps answer: which audience-taste
 * dimensions does the machine perpetually lag on? Which ones is it
 * narrowing? Are any cells flipping from black to orange (machine
 * catching up)?
 */

import { useEffect, useState } from "react";

const MONO = '"Diatype Mono Variable", monospace';
const STANDARD = '"Standard", sans-serif';
const DISPLAY = '"Terminal Grotesque", sans-serif';

const HUMAN_COLOR = "#171717";
const MACHINE_COLOR = "#D97706";

type Cell = {
  perf_slug: string;
  classifier_id: string;
  halim_avg: number;
  machine_avg: number;
  gap: number;
  halim_n: number;
  machine_n: number;
};

type GapData = {
  classifiers_version: string;
  classifiers: Array<{ id: string; name: string; weight: number }>;
  performances: Array<{
    perf_slug: string;
    perf_name: string;
    perf_date: string | null;
    perf_color: string;
  }>;
  cells: Cell[];
};

/** Convert hex to {r,g,b}. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Mix a hex color with white by `alpha` (0=white, 1=hex). */
function mixWithWhite(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  const a = Math.max(0, Math.min(1, alpha));
  const mix = (c: number) => Math.round(255 * (1 - a) + c * a);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function ClassifierGapHeatmap() {
  const [data, setData] = useState<GapData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/evals/classifier-gap")
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
          height: 240,
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

  if (data.cells.length === 0) {
    return null;
  }

  // Build lookup: perf_slug + classifier_id -> cell
  const byKey = new Map<string, Cell>();
  for (const c of data.cells) byKey.set(`${c.perf_slug}|${c.classifier_id}`, c);

  // The gap range in this data is roughly -0.2 to +2.0 (out of a possible
  // -5..+5). Scale alpha by absolute gap clipped to maxAbs = 2.0 so the
  // strongest cell saturates without being lost in floor noise.
  const maxAbs = 2.0;

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
        where the gap lives
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
        for each performance × classifier, the difference between halim&apos;s
        average and the machine&apos;s. darker black = halim further ahead;
        darker orange = machine further ahead; near-white = tied. cells
        reveal which audience-taste dimensions the machine perpetually lags
        on, and which are narrowing.
      </p>

      <div
        role="figure"
        aria-label="classifier gap heatmap"
        style={{
          overflowX: "auto",
          marginBottom: "1rem",
        }}
      >
        <table
          style={{
            borderCollapse: "collapse",
            fontFamily: MONO,
            fontSize: "0.78rem",
            minWidth: 640,
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  padding: "0.4rem 0.5rem",
                  color: "var(--text-tertiary)",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontSize: "0.72rem",
                }}
              >
                performance
              </th>
              {data.classifiers.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  style={{
                    textAlign: "center",
                    padding: "0.4rem 0.3rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    minWidth: 70,
                    verticalAlign: "bottom",
                  }}
                  title={`${c.id} - ${c.name} (weight ${c.weight})`}
                >
                  <div style={{ fontSize: "0.78rem" }}>{c.id}</div>
                  <div
                    style={{
                      fontSize: "0.62rem",
                      fontWeight: 400,
                      color: "var(--text-tertiary)",
                      maxWidth: 90,
                      lineHeight: 1.15,
                      marginTop: 4,
                    }}
                  >
                    {c.name.split(" vs ")[0]}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.performances.map((p) => (
              <tr key={p.perf_slug}>
                <th
                  scope="row"
                  style={{
                    textAlign: "left",
                    padding: "0.5rem 0.5rem",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    borderTop: "1px solid var(--border-light)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      background: p.perf_color,
                      marginRight: 6,
                      verticalAlign: "middle",
                    }}
                  />
                  {p.perf_name.replace(".exe", "")}
                </th>
                {data.classifiers.map((c) => {
                  const cell = byKey.get(`${p.perf_slug}|${c.id}`);
                  if (!cell) {
                    return (
                      <td
                        key={c.id}
                        style={{
                          padding: 0,
                          borderTop: "1px solid var(--border-light)",
                        }}
                      >
                        <div
                          style={{
                            height: 56,
                            background: "rgba(0,0,0,0.03)",
                          }}
                        />
                      </td>
                    );
                  }
                  const gap = cell.gap;
                  const alpha = Math.min(1, Math.abs(gap) / maxAbs);
                  const bg =
                    gap >= 0
                      ? mixWithWhite(HUMAN_COLOR, alpha)
                      : mixWithWhite(MACHINE_COLOR, alpha);
                  // Choose text color for contrast
                  const textColor =
                    alpha > 0.55
                      ? "#fff"
                      : gap >= 0
                        ? HUMAN_COLOR
                        : MACHINE_COLOR;
                  const sign = gap > 0 ? "+" : "";
                  return (
                    <td
                      key={c.id}
                      style={{
                        padding: 0,
                        borderTop: "1px solid var(--border-light)",
                      }}
                      title={`${c.id} (${c.name}) on ${p.perf_name}: halim ${cell.halim_avg.toFixed(2)} vs machine ${cell.machine_avg.toFixed(2)} → gap ${sign}${gap.toFixed(2)}`}
                    >
                      <div
                        style={{
                          height: 56,
                          background: bg,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          color: textColor,
                          fontFamily: MONO,
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          letterSpacing: "0.02em",
                        }}
                      >
                        <div>
                          {sign}
                          {gap.toFixed(1)}
                        </div>
                        <div
                          style={{
                            fontSize: "0.62rem",
                            fontWeight: 400,
                            opacity: alpha > 0.55 ? 0.85 : 0.65,
                            marginTop: 2,
                          }}
                        >
                          {cell.halim_avg.toFixed(1)}/{cell.machine_avg.toFixed(1)}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem 1.5rem",
          fontFamily: MONO,
          fontSize: "0.78rem",
          color: "var(--text-secondary)",
          alignItems: "center",
          marginTop: "0.5rem",
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            aria-hidden
            style={{
              width: 14,
              height: 14,
              background: HUMAN_COLOR,
              display: "inline-block",
            }}
          />
          halim ahead (positive gap)
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            aria-hidden
            style={{
              width: 14,
              height: 14,
              background: MACHINE_COLOR,
              display: "inline-block",
            }}
          />
          machine ahead (negative gap)
        </div>
        <div style={{ color: "var(--text-tertiary)" }}>
          cell shows gap · halim avg / machine avg · saturation = |gap| / 2.0
        </div>
      </div>

      {/* Classifier legend collapsed */}
      <details
        style={{
          marginTop: "1rem",
          paddingTop: "1rem",
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
