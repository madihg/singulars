"use client";

/**
 * /evolution - four views of the human and machine series, each in its own
 * window on the desk.
 *
 * 1. <ClassifierGapHeatmap>   - where the halim/machine gap lives across the
 *                               7 audience-derived classifiers per performance.
 * 2. <ModelComparisonChart>   - latest classifier-based eval of public
 *                               candidate models on reverse.exe (held out).
 * 3. <AudienceTruthChart>     - live-show audience verdicts per performance.
 * 4. <MachineTrajectoryChart> - halim and the machine's archived poems scored
 *                               against the same rubric over time.
 *
 * The classifier-anchored charts lead because they carry the headline story;
 * the audience-truth charts follow with the live-show context. The charts
 * themselves are unchanged recharts and SVG; they sit inside .win windows and
 * take their colours from the tokens.
 */

import { AudienceTruthChart } from "./AudienceTruthChart";
import { ModelComparisonChart } from "./ModelComparisonChart";
import { MachineTrajectoryChart } from "./MachineTrajectoryChart";
import { ClassifierGapHeatmap } from "./ClassifierGapHeatmap";
import { MenuBar } from "@/components/desktop/Chrome";

function ChartWindow({
  file,
  id,
  span,
  children,
}: {
  file: string;
  id: string;
  span: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`win ${span}`} id={id}>
      <div className="win__bar">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        <h2 className="win__t">{file}</h2>
      </div>
      <div className="win__b">
        <div className="sg-chart">{children}</div>
      </div>
    </section>
  );
}

export default function EvolutionView() {
  return (
    <>
      <MenuBar
        menu={[
          { href: "/singulars/", label: "singulars" },
          { href: "#gap", label: "gap" },
          { href: "#models", label: "models" },
          { href: "#audience", label: "audience" },
          { href: "#trajectory", label: "trajectory" },
        ]}
      />
      <main className="desk">
        <section className="win w--five">
          <div className="win__bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <h2 className="win__t">evolution.txt</h2>
          </div>
          <div className="win__b">
            <p className="k">machine poetry &middot; singulars</p>
            <h1 className="disp">evolution</h1>
            <p className="sub">
              Four views of the series: where the gap with halim lives per
              classifier, which candidate model best matches that taste on the
              held-out reverse.exe, who the audience voted for at each live
              show, and how the machine has moved on audience-taste dimensions
              over time.
            </p>
            <div className="rule" />
            <p className="prose">
              <strong>How the classifiers were made.</strong> Halim worked with
              claude opus 4.7 to read all 37 audience-decided winner and loser
              poem pairs from the five trained performances and surface the
              seven dimensions where winners consistently diverge from losers,
              the patterns the room reliably rewards. The methodology, the
              framing (audience as truth, classifier as rubric), and the
              calibration against contemporary poetry are halim&apos;s; claude
              did the systematic pass through the pairs. The rubric ends up
              anchored in actual audience preferences: specificity over
              abstraction, voice over generic lyric, earned emotional landing
              over decorative drift. Each classifier carries a weight of 1 to 3
              reflecting how strongly it separated winners from losers.
            </p>
            <p className="k">
              audience truth from singulars.poems vote tallies. classifier
              scores from a council of 3 judges (gpt-5, claude opus 4.7,
              deepseek r1) against the 7-classifier rubric.
            </p>
          </div>
        </section>

        <ChartWindow file="classifier-gap.svg" id="gap" span="w--seven">
          <ClassifierGapHeatmap />
        </ChartWindow>
        <ChartWindow file="model-comparison.svg" id="models" span="w--seven">
          <ModelComparisonChart />
        </ChartWindow>
        <ChartWindow file="audience-truth.svg" id="audience" span="w--five">
          <AudienceTruthChart />
        </ChartWindow>
        <ChartWindow
          file="machine-trajectory.svg"
          id="trajectory"
          span="w--eight"
        >
          <MachineTrajectoryChart />
        </ChartWindow>
      </main>
    </>
  );
}
