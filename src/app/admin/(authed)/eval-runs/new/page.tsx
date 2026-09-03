"use client";

/**
 * /admin/eval-runs/new (US-107)
 *
 * Form: pick performance (only trained), candidate models (chip multi-select),
 * judge model (auto-default away from candidate family), cost cap, n per theme.
 * Live cost estimate updates on every change.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Win from "@/components/desktop/Win";
import { estimateEvalCostUsd } from "@/lib/eval-cost";

type Perf = {
  id: string;
  slug: string;
  name: string;
  date: string | null;
  status: "upcoming" | "training" | "trained";
  vote_pair_count: number;
};
type Model = {
  id: string;
  slug: string;
  name: string;
  family: string;
  color: string;
  archived: boolean;
};

const JUDGE_OPTIONS = [
  "openai:gpt-5-5",
  "openai:gpt-4o-mini",
  "anthropic:messages:claude-opus-4-7",
  "openrouter:google/gemini-3.1-pro",
  "openrouter:deepseek/deepseek-r1",
];

function defaultJudge(candidates: Model[]): string {
  const candidateFamilies = new Set(candidates.map((c) => c.family));
  for (const j of JUDGE_OPTIONS) {
    const family = j.startsWith("openai:")
      ? "gpt"
      : j.startsWith("anthropic:")
        ? "claude"
        : j.startsWith("openrouter:google/")
          ? "gemini"
          : j.startsWith("openrouter:deepseek/")
            ? "deepseek"
            : "other";
    if (!candidateFamilies.has(family)) return j;
  }
  return JUDGE_OPTIONS[0];
}

export default function NewEvalRunPage() {
  const router = useRouter();
  const [perfs, setPerfs] = useState<Perf[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [perfId, setPerfId] = useState<string>("");
  const [candidateIds, setCandidateIds] = useState<string[]>([]);
  const [judge, setJudge] = useState<string>(JUDGE_OPTIONS[0]);
  const [costCap, setCostCap] = useState<number>(20);
  const [nPerTheme, setNPerTheme] = useState<number>(3);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/singulars/api/admin/performances")
      .then((r) => r.json())
      .then((j) => setPerfs(j.performances || []));
    fetch("/singulars/api/admin/candidate-models")
      .then((r) => r.json())
      .then((j) => setModels(j.models || []));
  }, []);

  // Auto-pick judge whenever candidates change
  useEffect(() => {
    const picked = models.filter((m) => candidateIds.includes(m.id));
    setJudge(defaultJudge(picked));
  }, [candidateIds, models]);

  const trained = perfs.filter((p) => p.status === "trained");
  const selectedPerf = perfs.find((p) => p.id === perfId);
  const selectedCandidates = models.filter((m) => candidateIds.includes(m.id));

  const estimate =
    selectedPerf && selectedCandidates.length > 0
      ? estimateEvalCostUsd({
          n_themes: selectedPerf.vote_pair_count,
          n_candidates: selectedCandidates.length,
          n_per_theme: nPerTheme,
          judge_model: judge,
        })
      : 0;
  const overCap = estimate > costCap;

  function toggle(id: string) {
    setCandidateIds((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/singulars/api/admin/eval-runs/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          performance_id: perfId,
          candidate_model_ids: candidateIds,
          judge_model: judge,
          cost_cap_usd: costCap,
          n_per_theme: nPerTheme,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j?.error || "failed");
        return;
      }
      router.push("/admin/eval-runs?status=pending");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Win file="eval-runs/new.txt" span="w--eight">
      <p className="k">eval pipeline</p>
      <h1 className="h2">new eval run</h1>
      <div className="rule" />

      {trained.length === 0 ? (
        <p className="note" style={{ marginTop: 0 }}>
          No trained performances yet.{" "}
          <Link href="/admin/performances">flip one to trained &rarr;</Link>
        </p>
      ) : (
        <form onSubmit={submit} className="sg-form sg-form--2">
          <Field label="performance">
            <select
              value={perfId}
              onChange={(e) => setPerfId(e.target.value)}
              required
            >
              <option value="">pick a performance</option>
              {perfs.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                  disabled={p.status !== "trained"}
                >
                  {p.name} {p.status !== "trained" ? "(not trained)" : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="judge model">
            <select value={judge} onChange={(e) => setJudge(e.target.value)}>
              {JUDGE_OPTIONS.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </Field>

          <div className="sg-span2">
            <span className="k">
              candidate models &middot; {candidateIds.length} selected
            </span>
            <div className="sg-row sg-row--tight" style={{ marginTop: "0.4rem" }}>
              {models
                .filter((m) => !m.archived)
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="btn"
                    aria-pressed={candidateIds.includes(m.id)}
                    onClick={() => toggle(m.id)}
                  >
                    <i className="cdot" style={{ ["--c" as string]: m.color }} />{" "}
                    {m.name}
                  </button>
                ))}
            </div>
          </div>

          <Field label="cost cap (usd)">
            <input
              type="number"
              min={0.1}
              step={0.5}
              value={costCap}
              onChange={(e) => setCostCap(Number(e.target.value))}
            />
          </Field>
          <Field label="n per theme">
            <input
              type="number"
              min={1}
              max={10}
              step={1}
              value={nPerTheme}
              onChange={(e) =>
                setNPerTheme(Math.max(1, Math.floor(Number(e.target.value))))
              }
            />
          </Field>

          <div className="sg-span2 sg-tile">
            <div
              className="sg-tile__v"
              style={{ color: overCap ? "var(--error)" : undefined }}
            >
              ${estimate.toFixed(2)}
            </div>
            <span className="k sg-tile__k">estimated cost</span>
            <span className="sg-tile__n">
              cap ${costCap.toFixed(2)}
              {overCap
                ? ". the estimate exceeds the cap. raise the cap or remove a candidate."
                : ""}
            </span>
          </div>

          {error ? <p className="sg-err sg-span2">{error}</p> : null}

          <div className="sg-row sg-row--end sg-span2">
            <Link className="btn" href="/admin/eval-runs">
              cancel
            </Link>
            <button
              type="submit"
              className="btn btn--send"
              disabled={
                submitting || !perfId || candidateIds.length === 0 || overCap
              }
            >
              {submitting ? "starting" : "start eval"}
            </button>
          </div>
        </form>
      )}
    </Win>
  );
}

/** A labelled field in the desk register. */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="dk-input">
      <span>{label}</span>
      {children}
      {hint ? (
        <span className="k" style={{ marginTop: "0.3rem" }}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}
