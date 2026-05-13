"use client";

/**
 * /evolution - four views of the human-vs-machine series.
 *
 * Order (top to bottom, or left-to-right then top-to-bottom on wide):
 *
 * 1. <ClassifierGapHeatmap> - where the halim/machine gap lives across
 *    the 7 audience-derived classifiers per performance.
 * 2. <ModelComparisonChart> - latest classifier-based eval of public
 *    candidate models on reverse.exe (held-out test set).
 * 3. <AudienceTruthChart> - live-show audience verdicts per performance.
 * 4. <MachineTrajectoryChart> - halim and the machine's actual archived
 *    poems scored against the same classifier rubric over time.
 *
 * The classifier-anchored charts lead because they tell the headline
 * story (which model best matches audience taste, where the gap lives);
 * the audience-truth charts follow with the live-show context.
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
            four views of evolution: where the gap with halim lives per
            classifier, which of today&apos;s candidate models best matches
            that taste on the held-out reverse.exe, who the audience voted
            for at each live show, and how the machine&apos;s quality has
            evolved on audience-taste dimensions across the series.
          </p>
          <p
            style={{
              fontFamily: STANDARD,
              fontSize: "0.85rem",
              lineHeight: 1.55,
              color: "var(--text-secondary)",
              margin: "0 0 1.5rem 0",
            }}
          >
            <strong style={{ color: "var(--text-primary)" }}>
              how the classifiers were made.
            </strong>{" "}
            claude opus 4.7 read all 37 audience-decided (winner, loser)
            poem pairs from the five trained performances and surfaced the
            seven dimensions where winners consistently diverge from losers
            - the patterns the room reliably rewards. the rubric is
            anchored in actual audience preferences, filtered through
            contemporary poetry&apos;s living conventions (specificity over
            abstraction, voice over generic lyric, earned emotional landing
            over decorative drift). each classifier carries a weight 1-3
            reflecting how strongly it separated winners from losers in the
            data.
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
            deepseek r1) against the 7-classifier rubric.
          </p>
        </aside>

        <div className="evolution-charts">
          <ClassifierGapHeatmap />
          <ModelComparisonChart />
          <AudienceTruthChart />
          <MachineTrajectoryChart />
        </div>
      </div>
    </main>
  );
}
