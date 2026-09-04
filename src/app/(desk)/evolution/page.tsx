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
  description:
    "Four views of how the Singulars machine has moved against the audience's taste across the series.",
};

export default function EvolutionPage() {
  return <EvolutionView />;
}
