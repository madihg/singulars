"use client";

/**
 * /evolution - three views of the human-vs-machine series.
 *
 * 1. <AudienceTruthChart> - live-show audience verdicts per performance
 *    (halim vs machine vote counts, ground.exe pending). The truest
 *    evolution signal: who did the room actually pick?
 *
 * 2. <ModelComparisonChart> - latest classifier-based eval of public
 *    candidate models on reverse.exe (held-out test set). Which of the
 *    current candidate models best matches audience taste?
 *
 * 3. <MachineTrajectoryChart> - both halim and the machine's actual
 *    archived poems retroactively scored against the audience-derived
 *    classifier rubric. Have they each improved on audience-taste
 *    dimensions across the series?
 *
 * The legacy per-perf judge-eval line chart was removed - it mixed old
 * (rank-against-A/B) and new (classifier-based) methodology on a single
 * axis, which was misleading. The trajectory chart replaces it with a
 * single consistent methodology end-to-end.
 */

import { AudienceTruthChart } from "./AudienceTruthChart";
import { ModelComparisonChart } from "./ModelComparisonChart";
import { MachineTrajectoryChart } from "./MachineTrajectoryChart";
import { ClassifierGapHeatmap } from "./ClassifierGapHeatmap";

const MONO = '"Diatype Mono Variable", monospace';
const DISPLAY = '"Terminal Grotesque", sans-serif';
const STANDARD = '"Standard", sans-serif';

export default function EvolutionView() {
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
          maxWidth: 600,
          margin: "0 0 3rem 0",
        }}
      >
        three views of evolution: who the audience voted for at each live
        show, how the machine&apos;s quality has evolved on audience-taste
        dimensions across the series, and which of today&apos;s candidate
        models best matches that taste on the held-out reverse.exe.
      </p>

      <AudienceTruthChart />
      <MachineTrajectoryChart />
      <ClassifierGapHeatmap />
      <ModelComparisonChart />

      <p
        style={{
          fontFamily: MONO,
          fontSize: "0.75rem",
          color: "var(--text-tertiary)",
          marginTop: "4rem",
          textAlign: "center",
        }}
      >
        audience truth from singulars.poems vote tallies. classifier
        scores from a council of 3 judges (gpt-5 · claude opus 4.7 ·
        deepseek r1) against the 7-classifier rubric extracted from 37
        audience-decided pairs.
      </p>
    </main>
  );
}
