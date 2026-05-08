"use client";

/**
 * <AudienceTruthChart /> - the headline /evolution chart.
 *
 * Per-performance live-show audience truth: how many themes the room awarded
 * to Halim (human) vs the machine, by max vote_count per (theme, author). Pure
 * DB read - no LLM, no eval. Reads /api/evals/audience.
 *
 * The actual "evolution" question Halim cares about: "is the model improving
 * to beat me, performance over performance?" Stacked horizontal bars per
 * performance let you eyeball the trend across the series.
 *
 * Pending performances (status='upcoming', no poems yet - e.g. ground.exe)
 * render as a gray placeholder row.
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
    return <p style={{ fontFamily: MONO, color: "var(--text-tertiary)" }}>{error}</p>;
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

  // Find max n_themes for x-scale - use the largest non-pending row (so pending
  // doesn't squash everything).
  const maxThemes = Math.max(
    ...data.performances
      .filter((p) => !p.pending)
      .map((p) => p.n_themes),
    1,
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
        per performance: how many themes the audience voted for halim, the
        machine, or split evenly. straight from the room. no judges, no llms.
      </p>

      {/* Header row labels */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(140px, 22%) 1fr",
          gap: "0.75rem",
          alignItems: "baseline",
          marginBottom: "0.5rem",
          fontFamily: MONO,
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--text-tertiary)",
        }}
      >
        <div>performance</div>
        <div>themes (halim · machine · tie)</div>
      </div>

      <div role="table" aria-label="audience: machine vs halim per performance">
        {data.performances.map((p) => {
          const total = p.n_themes;
          const halimPct = total > 0 ? (p.human_wins / total) * 100 : 0;
          const machinePct = total > 0 ? (p.machine_wins / total) * 100 : 0;
          const tiePct = total > 0 ? (p.ties / total) * 100 : 0;
          // Bar width relative to the largest perf so smaller-N perfs read as smaller bars.
          const widthPct = total > 0 ? (total / maxThemes) * 100 : 0;
          return (
            <div
              key={p.perf_slug}
              role="row"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(140px, 22%) 1fr",
                gap: "0.75rem",
                alignItems: "center",
                padding: "0.75rem 0",
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
                      background: p.perf_color,
                      flexShrink: 0,
                    }}
                  />
                  {p.perf_name}
                </div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: "0.72rem",
                    color: "var(--text-tertiary)",
                    marginTop: "0.15rem",
                  }}
                >
                  {p.perf_date || "tbd"}
                  {p.pending ? " · upcoming" : ""}
                </div>
              </div>
              <div role="cell">
                {p.pending ? (
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: "0.85rem",
                      color: "var(--text-tertiary)",
                      padding: "0.4rem 0.6rem",
                      background: "rgba(0,0,0,0.025)",
                      border: "1px dashed rgba(0,0,0,0.15)",
                      width: "fit-content",
                    }}
                  >
                    pending — voting hasn&apos;t opened
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: "flex",
                        height: 26,
                        width: `${Math.max(widthPct, 8)}%`,
                        minWidth: 60,
                        border: "1px solid rgba(0,0,0,0.18)",
                      }}
                      aria-label={`halim ${p.human_wins} of ${total}, machine ${p.machine_wins} of ${total}, tie ${p.ties}`}
                    >
                      {halimPct > 0 ? (
                        <div
                          style={{
                            width: `${halimPct}%`,
                            background: HUMAN_COLOR,
                          }}
                          title={`halim ${p.human_wins}`}
                        />
                      ) : null}
                      {machinePct > 0 ? (
                        <div
                          style={{
                            width: `${machinePct}%`,
                            background: MACHINE_COLOR,
                          }}
                          title={`machine ${p.machine_wins}`}
                        />
                      ) : null}
                      {tiePct > 0 ? (
                        <div
                          style={{
                            width: `${tiePct}%`,
                            background: TIE_COLOR,
                          }}
                          title={`tie ${p.ties}`}
                        />
                      ) : null}
                    </div>
                    <div
                      style={{
                        fontFamily: MONO,
                        fontSize: "0.78rem",
                        color: "var(--text-secondary)",
                        marginTop: "0.4rem",
                      }}
                    >
                      <span style={{ color: HUMAN_COLOR, fontWeight: 600 }}>
                        halim {p.human_wins}
                      </span>
                      {" · "}
                      <span style={{ color: MACHINE_COLOR, fontWeight: 600 }}>
                        machine {p.machine_wins}
                      </span>
                      {p.ties > 0 ? (
                        <>
                          {" · "}
                          <span style={{ color: "var(--text-tertiary)" }}>
                            tie {p.ties}
                          </span>
                        </>
                      ) : null}
                      {" · "}
                      <span style={{ color: "var(--text-tertiary)" }}>
                        {total} themes
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals row */}
      <div
        style={{
          marginTop: "1.5rem",
          padding: "1rem 0 0 0",
          borderTop: "2px solid var(--text-primary)",
          fontFamily: MONO,
          fontSize: "0.85rem",
          color: "var(--text-primary)",
          display: "flex",
          flexWrap: "wrap",
          gap: "1.5rem",
          justifyContent: "space-between",
        }}
      >
        <div>
          across {data.totals.n_themes} themes in{" "}
          {data.performances.filter((p) => !p.pending).length} trained
          performances
        </div>
        <div>
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
