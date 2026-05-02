/**
 * /evolution (mounted as /singulars/evolution per US-117).
 *
 * Single-page public view: Model Evolution Chart + Head-to-Head Matrix.
 * Both consume /api/evals/results on load. Tap matrix cell -> drilldown.
 */

import EvolutionView from "./EvolutionView";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Singulars - evolution",
};

export default function EvolutionPage() {
  return <EvolutionView />;
}
