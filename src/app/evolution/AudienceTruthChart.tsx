"use client";

/**
 * <AudienceTruthChart /> - the headline /evolution chart.
 *
 * Per-performance live-show audience truth: how many themes the room awarded
 * to Halim vs the machine. Pure DB read - no LLM, no eval. Reads
 * /api/evals/audience.
 *
 * Rendered as vertical grouped columns (Halim, machine) per performance so
 * the trend reads as evolution-over-time at a glance.
 *
 * Pending performances (status='upcoming', no poems yet - e.g. ground.exe)
 * render as a dashed gray placeholder at the right edge.
 */

import { useEffect, useState } from "react";

const MONO = '"Diatype Mono Variable", monospace';
const STANDARD = '"Standard", sans-serif';
const DISPLAY = '"Terminal Grotesque", sans-serif';

type AudienceRow = {
  perf_slug: string;
  perf_name: string;
  perf_date: string | null;
  perf_color: string;
  perf_status: string;
  n_themes: number;
  human_wins: number;
  machine_wins: number;
  ties: number;
  pending: boolean;
};

type AudienceData = {
  performances: AudienceRow[];
  totals: {
    human_wins: number;
    machine_wins: number;
    ties: number;
    n_themes: number;
    machine_win_rate: number;
  };
};

const HUMAN_COLOR = "#171717"; // ink black for Halim
const MACHINE_COLOR = "#D97706"; // ground.exe accent for the machine
const TIE_COLOR = "rgba(0,0,0,0.18)"; // hairline gray for ties

export function AudienceTruthChart() {
  const [data, setData] = useState<AudienceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/evals/audience")
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
          height: 280,
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

  // Use the max theme count across non-pending perfs as the y-axis scale.
  const maxThemes = Math.max(
    ...data.performances.filter((p) => !p.pending).map((p) => p.n_themes),
    1,
  );
  // Round up to a nice tick value (multiple of 5).
  const yMax = Math.ceil(maxThemes / 5) * 5;
  const yTicks = [0, Math.round(yMax / 4), Math.round(yMax / 2), Math.round((3 * yMax) / 4), yMax];

  // Layout constants
  const CHART_HEIGHT = 280; // px
  const BOTTOM_LABEL_HEIGHT = 60; // for perf name + date
  const TOP_PADDING = 16; // headroom above tallest bar for count labels
  const PLOT_HEIGHT = CHART_HEIGHT - BOTTOM_LABEL_HEIGHT - TOP_PADDING;

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
        machine vs me
      </h2>
      <p
        style={{
          fontFamily: STANDARD,
          fontSize: "0.95rem",
          lineHeight: 1.5,
          color: "var(--text-secondary)",
          margin: "0 0 1.75rem 0",
          maxWidth: 560,
        }}
      >
        per performance: how many themes the audience voted for halim
        (black) vs the machine (orange). straight from the room. no judges, no
        llms. ground.exe pending.
      </p>

      <div
        role="figure"
        aria-label="audience: themes won by halim vs machine per performance"
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "0.5rem",
          alignItems: "stretch",
        }}
      >
        {/* Y-axis ticks */}
        <div
          style={{
            position: "relative",
            width: 28,
            height: CHART_HEIGHT,
          }}
        >
          {yTicks.map((t) => {
            const y = TOP_PADDING + PLOT_HEIGHT - (t / yMax) * PLOT_HEIGHT;
            return (
              <div
                key={t}
                style={{
                  position: "absolute",
                  top: y - 7,
                  right: 4,
                  fontFamily: MONO,
                  fontSize: "0.7rem",
                  color: "var(--text-tertiary)",
                }}
              >
                {t}
              </div>
            );
          })}
        </div>

        {/* Plot area */}
        <div
          style={{
            position: "relative",
            height: CHART_HEIGHT,
            display: "grid",
            gridTemplateColumns: `repeat(${data.performances.length}, 1fr)`,
            gap: "0.5rem",
          }}
        >
          {/* Horizontal grid lines */}
          {yTicks.map((t) => {
            const y = TOP_PADDING + PLOT_HEIGHT - (t / yMax) * PLOT_HEIGHT;
            return (
              <div
                key={t}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: y,
                  height: 1,
                  background:
                    t === 0 ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.06)",
                  pointerEvents: "none",
                }}
              />
            );
          })}

          {data.performances.map((p) => {
            const halimH = p.pending
              ? 0
              : (p.human_wins / yMax) * PLOT_HEIGHT;
            const machineH = p.pending
              ? 0
              : (p.machine_wins / yMax) * PLOT_HEIGHT;
            return (
              <div
                key={p.perf_slug}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: CHART_HEIGHT,
                }}
                role="row"
                aria-label={
                  p.pending
                    ? `${p.perf_name} pending`
                    : `${p.perf_name}: halim ${p.human_wins}, machine ${p.machine_wins}, tie ${p.ties}`
                }
              >
                {/* Bar group container */}
                <div
                  style={{
                    position: "absolute",
                    top: TOP_PADDING,
                    bottom: BOTTOM_LABEL_HEIGHT,
                    left: 0,
                    right: 0,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  {p.pending ? (
                    <div
                      style={{
                        width: "70%",
                        height: "100%",
                        border: "1px dashed rgba(0,0,0,0.2)",
                        background: "rgba(0,0,0,0.02)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: MONO,
                        fontSize: "0.7rem",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      pending
                    </div>
                  ) : (
                    <>
                      {/* Halim bar */}
                      <div
                        style={{
                          width: "40%",
                          height: halimH,
                          background: HUMAN_COLOR,
                          position: "relative",
                          minHeight: p.human_wins > 0 ? 2 : 0,
                        }}
                        title={`halim ${p.human_wins}`}
                      >
                        {p.human_wins > 0 ? (
                          <span
                            style={{
                              position: "absolute",
                              top: -16,
                              left: "50%",
                              transform: "translateX(-50%)",
                              fontFamily: MONO,
                              fontSize: "0.72rem",
                              color: HUMAN_COLOR,
                              fontWeight: 600,
                            }}
                          >
                            {p.human_wins}
                          </span>
                        ) : null}
                      </div>
                      {/* Machine bar */}
                      <div
                        style={{
                          width: "40%",
                          height: machineH,
                          background: MACHINE_COLOR,
                          position: "relative",
                          minHeight: p.machine_wins > 0 ? 2 : 0,
                        }}
                        title={`machine ${p.machine_wins}`}
                      >
                        {p.machine_wins > 0 ? (
                          <span
                            style={{
                              position: "absolute",
                              top: -16,
                              left: "50%",
                              transform: "translateX(-50%)",
                              fontFamily: MONO,
                              fontSize: "0.72rem",
                              color: MACHINE_COLOR,
                              fontWeight: 600,
                            }}
                          >
                            {p.machine_wins}
                          </span>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
                {/* X-axis label */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: BOTTOM_LABEL_HEIGHT,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    paddingTop: 8,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      background: p.perf_color,
                      marginBottom: 4,
                    }}
                  />
                  <div
                    style={{
                      fontFamily: STANDARD,
                      fontSize: "0.78rem",
                      fontWeight: 500,
                      textAlign: "center",
                      lineHeight: 1.1,
                      color: "var(--text-primary)",
                    }}
                  >
                    {p.perf_name.replace(".exe", "")}
                  </div>
                  {p.ties > 0 ? (
                    <div
                      style={{
                        fontFamily: MONO,
                        fontSize: "0.65rem",
                        color: "var(--text-tertiary)",
                        marginTop: 2,
                      }}
                    >
                      +{p.ties} tie
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend + totals */}
      <div
        style={{
          marginTop: "1.5rem",
          padding: "1rem 0 0 0",
          borderTop: "1px solid var(--border-light)",
          fontFamily: MONO,
          fontSize: "0.85rem",
          color: "var(--text-primary)",
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem 2rem",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: "1.25rem", alignItems: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              aria-hidden
              style={{ width: 12, height: 12, background: HUMAN_COLOR }}
            />
            halim
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              aria-hidden
              style={{ width: 12, height: 12, background: MACHINE_COLOR }}
            />
            machine
          </span>
          {data.totals.ties > 0 ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                aria-hidden
                style={{ width: 12, height: 12, background: TIE_COLOR }}
              />
              tie
            </span>
          ) : null}
        </div>
        <div style={{ textAlign: "right" }}>
          across {data.totals.n_themes} themes ·{" "}
          <span style={{ color: HUMAN_COLOR, fontWeight: 600 }}>
            halim {data.totals.human_wins}
          </span>
          {" · "}
          <span style={{ color: MACHINE_COLOR, fontWeight: 600 }}>
            machine {data.totals.machine_wins}
          </span>
          {data.totals.ties > 0 ? (
            <>
              {" · "}
              <span style={{ color: "var(--text-tertiary)" }}>
                tie {data.totals.ties}
              </span>
            </>
          ) : null}
          {" · "}
          <span style={{ color: "var(--text-tertiary)" }}>
            machine win rate {(data.totals.machine_win_rate * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </section>
  );
}
