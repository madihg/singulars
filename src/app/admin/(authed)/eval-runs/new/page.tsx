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
import {
  FONT_MONO,
  inputStyle,
  btnPrimaryStyle,
  btnSecondaryStyle,
  backLinkStyle,
} from "@/lib/admin-styles";
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
    fetch("/api/admin/performances")
      .then((r) => r.json())
      .then((j) => setPerfs(j.performances || []));
    fetch("/api/admin/candidate-models")
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
      const res = await fetch("/api/admin/eval-runs/start", {
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
    <div style={{ maxWidth: 560 }}>
      <Link href="/admin/eval-runs" style={backLinkStyle}>
        ← eval runs
      </Link>
      <h1
        style={{
          fontFamily: '"Terminal Grotesque", sans-serif',
          fontSize: "3.5rem",
          lineHeight: 0.9,
          margin: "1rem 0 2rem 0",
        }}
      >
        new eval run
      </h1>

      {trained.length === 0 ? (
        <p
          style={{
            fontFamily: FONT_MONO,
            fontSize: "0.9rem",
            color: "var(--text-secondary)",
          }}
        >
          no trained performances yet.{" "}
          <Link
            href="/admin/performances"
            style={{ color: "var(--text-primary)" }}
          >
            flip one to trained →
          </Link>
        </p>
      ) : (
        <form
          onSubmit={submit}
          style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
        >
          <Field label="performance">
            <select
              value={perfId}
              onChange={(e) => setPerfId(e.target.value)}
              style={{ ...inputStyle, padding: "0.65rem 0.75rem" }}
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

          <Field
            label="candidate models"
            hint={`${candidateIds.length} selected`}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {models
                .filter((m) => !m.archived)
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggle(m.id)}
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: "0.85rem",
                      padding: "0.4rem 0.75rem",
                      border: `1px solid ${candidateIds.includes(m.id) ? m.color : "var(--border-light)"}`,
                      background: candidateIds.includes(m.id)
                        ? m.color
                        : "transparent",
                      color: candidateIds.includes(m.id)
                        ? "#fff"
                        : "var(--text-primary)",
                      cursor: "pointer",
                    }}
                  >
                    {m.name}
                  </button>
                ))}
            </div>
          </Field>

          <Field label="judge model">
            <select
              value={judge}
              onChange={(e) => setJudge(e.target.value)}
              style={{ ...inputStyle, padding: "0.65rem 0.75rem" }}
            >
              {JUDGE_OPTIONS.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </Field>

          <div style={{ display: "flex", gap: "1rem" }}>
            <Field label="cost cap (usd)">
              <input
                type="number"
                min={0.1}
                step={0.5}
                value={costCap}
                onChange={(e) => setCostCap(Number(e.target.value))}
                style={inputStyle}
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
                style={inputStyle}
              />
            </Field>
          </div>

          {/* Cost estimator */}
          <div
            style={{
              border: "1px solid var(--border-light)",
              padding: "1rem 1.25rem",
            }}
          >
            <div
              style={{
                fontFamily: '"Diatype Variable", sans-serif',
                fontSize: "1.6rem",
                fontWeight: 700,
                color: overCap ? "#dc2626" : "var(--text-primary)",
              }}
            >
              estimated ${estimate.toFixed(2)}
            </div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: "0.8rem",
                color: "var(--text-tertiary)",
                marginTop: "0.25rem",
              }}
            >
              cap ${costCap.toFixed(2)}
              {overCap
                ? " · estimate exceeds cap. raise the cap or remove a candidate."
                : ""}
            </div>
          </div>

          {error ? (
            <p
              style={{
                fontFamily: FONT_MONO,
                fontSize: "0.85rem",
                color: "#dc2626",
                margin: 0,
              }}
            >
              {error}
            </p>
          ) : null}

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="submit"
              disabled={
                submitting || !perfId || candidateIds.length === 0 || overCap
              }
              style={btnPrimaryStyle}
            >
              {submitting ? "..." : "start eval"}
            </button>
            <Link
              href="/admin/eval-runs"
              style={{
                ...btnSecondaryStyle,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

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
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.4rem",
        flex: 1,
      }}
    >
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--text-tertiary)",
        }}
      >
        {label}
      </span>
      {children}
      {hint ? (
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: "0.75rem",
            color: "var(--text-tertiary)",
          }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}
