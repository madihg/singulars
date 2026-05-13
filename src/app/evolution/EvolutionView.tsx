"use client";

/**
 * /evolution - four views of the human-vs-machine series.
 *
 * 1. <AudienceTruthChart> - live-show audience verdicts per performance.
 * 2. <MachineTrajectoryChart> - both halim and the machine's actual
 *    archived poems scored against the audience-derived classifier rubric.
 * 3. <ClassifierGapHeatmap> - where the halim/machine gap lives across
 *    the 7 classifiers per performance.
 * 4. <ModelComparisonChart> - latest classifier-based eval of public
 *    candidate models on reverse.exe (held-out test set).
 *
 * Layout: single column on narrow screens (everything stacks), 2-column
 * outer grid on >= 1280px wide (title sticky on the left, charts in a
 * 2-column grid on the right). See .evolution-grid in globals.css.
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
        maxWidth: 1400,
        margin: "0 auto",
      }}
    >
      <div className="evolution-grid">
        <aside className="evolution-meta">
          <h1
            style={{
              fontFamily: DISPLAY,
              fontSize: "5rem",
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
              fontSize: "1rem",
              lineHeight: 1.5,
              color: "var(--text-secondary)",
              margin: "0 0 1.5rem 0",
            }}
          >
            four views of evolution: who the audience voted for at each live
            show, how the machine&apos;s quality has evolved on
            audience-taste dimensions across the series, where the gap with
            halim lives per classifier, and which of today&apos;s candidate
            models best matches that taste on the held-out reverse.exe.
          </p>
          <p
            style={{
              fontFamily: MONO,
              fontSize: "0.7rem",
              color: "var(--text-tertiary)",
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            audience truth from singulars.poems vote tallies. classifier
            scores from a council of 3 judges (gpt-5 · claude opus 4.7 ·
            deepseek r1) against the 7-classifier rubric extracted from 37
            audience-decided pairs.
          </p>
        </aside>

        <div className="evolution-charts">
          <AudienceTruthChart />
          <MachineTrajectoryChart />
          <ClassifierGapHeatmap />
          <ModelComparisonChart />
        </div>
      </div>
    </main>
  );
}
