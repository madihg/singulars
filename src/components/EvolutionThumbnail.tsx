/**
 * <EvolutionThumbnail /> (US-118).
 *
 * Optional 4:3 mini-chart embedded on /singulars below the performance card row.
 * Rendered server-side as a static SVG (no interactivity, no tooltips). Click
 * navigates to /singulars/evolution.
 *
 * Toggleable via env NEXT_PUBLIC_SHOW_EVOLUTION_ON_LANDING. When false, the
 * component renders nothing (not a placeholder, not a zero-height div) to
 * avoid layout shift on toggle.
 */

import Link from "next/link";
import { getSupabase, getServiceClient } from "@/lib/supabase";

type Series = Array<{ rate: number; perf: string }>;
type ModelLine = { slug: string; color: string; series: Series };

async function loadMini(): Promise<{
  perfs: string[];
  lines: ModelLine[];
}> {
  const supabase = getSupabase() || getServiceClient();
  if (!supabase) return { perfs: [], lines: [] };

  const { data: perfRows } = await supabase
    .from("performances")
    .select("slug")
    .order("date", { ascending: true, nullsFirst: false });

  const { data: viewRows } = await supabase
    .from("v_model_winrate_per_performance")
    .select("model_slug, model_color, performance_slug, win_rate");

  type ViewRow = {
    model_slug: string;
    model_color: string;
    performance_slug: string;
    win_rate: number;
  };
  const byModel: Record<string, ModelLine> = {};
  for (const r of (viewRows ?? []) as ViewRow[]) {
    if (!byModel[r.model_slug]) {
      byModel[r.model_slug] = {
        slug: r.model_slug,
        color: r.model_color,
        series: [],
      };
    }
    byModel[r.model_slug].series.push({
      perf: r.performance_slug,
      rate: Number(r.win_rate) || 0,
    });
  }

  return {
    perfs: (perfRows ?? []).map((p) => p.slug as string),
    lines: Object.values(byModel),
  };
}

export default async function EvolutionThumbnail() {
  if (process.env.NEXT_PUBLIC_SHOW_EVOLUTION_ON_LANDING !== "true") {
    return null;
  }

  const { perfs, lines } = await loadMini();
  if (perfs.length === 0 || lines.length === 0) return null;

  const W = 320;
  const H = 240;
  const padX = 24;
  const padY = 28;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const xStep = perfs.length > 1 ? innerW / (perfs.length - 1) : 0;

  const xByPerf: Record<string, number> = {};
  perfs.forEach((p, i) => {
    xByPerf[p] = padX + i * xStep;
  });

  return (
    <div style={{ marginTop: "3rem" }}>
      <div
        style={{
          fontFamily: '"Diatype Mono Variable", monospace',
          fontSize: "0.85rem",
          color: "var(--text-secondary)",
          marginBottom: "0.5rem",
        }}
      >
        how the models are doing →
      </div>
      <Link
        href="/singulars/evolution"
        style={{
          display: "inline-block",
          textDecoration: "none",
          cursor: "pointer",
        }}
        aria-label="open evolution chart"
      >
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: "block", background: "#fff" }}
          role="img"
          aria-label="model win rate evolution thumbnail"
        >
          {/* horizontal grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((q) => (
            <line
              key={q}
              x1={padX}
              x2={W - padX}
              y1={padY + innerH * (1 - q)}
              y2={padY + innerH * (1 - q)}
              stroke="rgba(0,0,0,0.08)"
              strokeWidth={0.5}
            />
          ))}
          {/* lines */}
          {lines.map((m) => {
            const points = m.series
              .filter((s) => xByPerf[s.perf] !== undefined)
              .map((s) => {
                const x = xByPerf[s.perf];
                const y =
                  padY + innerH * (1 - Math.min(1, Math.max(0, s.rate)));
                return `${x},${y}`;
              });
            if (points.length === 0) return null;
            return (
              <polyline
                key={m.slug}
                fill="none"
                stroke={m.color}
                strokeWidth={1.5}
                points={points.join(" ")}
              />
            );
          })}
          {/* x labels */}
          {perfs.map((p) => (
            <text
              key={p}
              x={xByPerf[p]}
              y={H - 6}
              fontFamily="Diatype Mono Variable, monospace"
              fontSize={9}
              fill="rgba(0,0,0,0.5)"
              textAnchor="middle"
            >
              {p.replace(".exe", "")}
            </text>
          ))}
        </svg>
      </Link>
    </div>
  );
}
