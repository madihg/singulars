"use client";

/**
 * /admin/fine-tunes/new (US-123)
 *
 * Form: provider, base model, format, source perfs, holdout, system prompt,
 * hyperparameters (collapsible), cost cap, candidate name. Live cost
 * estimator updates on every change.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Win from "@/components/desktop/Win";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/training-data";
import { estimateFinetuneCostUsd } from "@/lib/eval-cost";

type Provider = "openai" | "together" | "huggingface";
type Format = "sft" | "dpo";

const BASE_MODELS: Record<Provider, string[]> = {
  openai: [
    "gpt-4o-mini-2024-07-18",
    "gpt-4.1-2025-04-14",
    "gpt-3.5-turbo-1106",
  ],
  together: [
    "meta-llama/Llama-3.3-70B-Instruct",
    "Qwen/Qwen3-14B",
    "mistralai/Mistral-Nemo-Instruct-2407",
  ],
  huggingface: ["meta-llama/Llama-3.2-3B-Instruct"],
};

const SUPPORTS_DPO: Record<Provider, boolean> = {
  openai: true,
  together: true,
  huggingface: false,
};

type Perf = {
  id: string;
  slug: string;
  name: string;
  status: "upcoming" | "training" | "trained";
  date: string | null;
};

export default function NewFinetunePage() {
  const router = useRouter();
  const [perfs, setPerfs] = useState<Perf[]>([]);
  const [provider, setProvider] = useState<Provider>("openai");
  const [baseModel, setBaseModel] = useState<string>(BASE_MODELS.openai[0]);
  const [format, setFormat] = useState<Format>("sft");
  const [sourceSlugs, setSourceSlugs] = useState<string[]>([]);
  const [holdoutSlug, setHoldoutSlug] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [epochs, setEpochs] = useState(3);
  const [lrMultiplier, setLrMultiplier] = useState(1.0);
  const [costCap, setCostCap] = useState(
    Number(process.env.NEXT_PUBLIC_FINETUNE_COST_CAP_USD || "50"),
  );
  const [candidateName, setCandidateName] = useState("");
  const [previewRows, setPreviewRows] = useState<number>(0);
  const [previewTokens, setPreviewTokens] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load performances
  useEffect(() => {
    fetch("/singulars/api/admin/performances")
      .then((r) => r.json())
      .then((j) => {
        const all = j.performances || [];
        setPerfs(all);
        const trained = all
          .filter((p: Perf) => p.status === "trained")
          .map((p: Perf) => p.slug);
        setSourceSlugs(trained);
        // Default holdout = latest trained
        if (trained.length > 0) {
          setHoldoutSlug(trained[trained.length - 1]);
        }
      });
  }, []);

  // Auto-suggest candidate name
  useEffect(() => {
    if (!candidateName) {
      const baseShort = baseModel.split("/").pop() || baseModel;
      setCandidateName(
        `ground.exe (v? - ${baseShort}-${format.toUpperCase()})`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseModel, format]);

  // Update base model when provider changes
  useEffect(() => {
    setBaseModel(BASE_MODELS[provider][0]);
    if (!SUPPORTS_DPO[provider]) setFormat("sft");
  }, [provider]);

  // Refresh preview rows + tokens
  useEffect(() => {
    if (sourceSlugs.length === 0) {
      setPreviewRows(0);
      setPreviewTokens(0);
      return;
    }
    const params = new URLSearchParams({
      format,
      performances: sourceSlugs.join(","),
      preview: "true",
    });
    if (holdoutSlug) params.set("holdout", holdoutSlug);
    fetch(`/singulars/api/admin/training-data/export?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        setPreviewRows(j.rows || 0);
        setPreviewTokens(j.approxTokens || 0);
      });
  }, [sourceSlugs, holdoutSlug, format]);

  const estimate = estimateFinetuneCostUsd({
    n_training_rows: previewRows,
    tokens_per_row:
      previewRows > 0 ? Math.round(previewTokens / previewRows) : 0,
    n_epochs: epochs,
    provider,
    base_model: baseModel,
  });
  const overCap = estimate > costCap;

  function toggleSource(slug: string) {
    setSourceSlugs((s) =>
      s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/singulars/api/admin/fine-tunes/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          base_model: baseModel,
          training_format: format,
          source_performance_slugs: sourceSlugs,
          holdout_performance_slug: holdoutSlug || null,
          candidate_name: candidateName,
          system_prompt: systemPrompt,
          hyperparameters: {
            n_epochs: epochs,
            learning_rate_multiplier: lrMultiplier,
          },
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j?.error || "failed");
        return;
      }
      router.push(`/admin/fine-tunes/${j.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Win file="fine-tunes/new.txt" span="w--eight">
      <p className="k">fine-tune pipeline</p>
      <h1 className="h2">new fine-tune</h1>
      <div className="rule" />

      <form onSubmit={submit} className="sg-form sg-form--2">
        <div className="sg-span2">
          <span className="k">provider</span>
          <div className="sg-row sg-row--tight" style={{ marginTop: "0.4rem" }}>
            {(["openai", "together", "huggingface"] as Provider[]).map((p) => (
              <button
                key={p}
                type="button"
                className="btn"
                aria-pressed={provider === p}
                onClick={() => setProvider(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <Field label="base model">
          <select
            value={baseModel}
            onChange={(e) => setBaseModel(e.target.value)}
          >
            {BASE_MODELS[provider].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>

        <div>
          <span className="k">format</span>
          <div className="sg-row sg-row--tight" style={{ marginTop: "0.4rem" }}>
            {(["sft", "dpo"] as Format[]).map((f) => {
              const disabled = f === "dpo" && !SUPPORTS_DPO[provider];
              return (
                <button
                  key={f}
                  type="button"
                  className="btn"
                  aria-pressed={format === f}
                  disabled={disabled}
                  onClick={() => setFormat(f)}
                >
                  {f.toUpperCase()}
                  {disabled ? " (provider unsupported)" : ""}
                </button>
              );
            })}
          </div>
        </div>

        <div className="sg-span2">
          <span className="k">source performances</span>
          <div className="sg-row sg-row--tight" style={{ marginTop: "0.4rem" }}>
            {perfs
              .filter((p) => p.status === "trained")
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="btn"
                  aria-pressed={sourceSlugs.includes(p.slug)}
                  onClick={() => toggleSource(p.slug)}
                >
                  {p.name}
                </button>
              ))}
          </div>
        </div>

        <Field
          label="hold out performance"
          hint="becomes the test set, excluded from training"
        >
          <select
            value={holdoutSlug}
            onChange={(e) => setHoldoutSlug(e.target.value)}
          >
            <option value="">none</option>
            {perfs
              .filter(
                (p) => p.status === "trained" && sourceSlugs.includes(p.slug),
              )
              .map((p) => (
                <option key={p.id} value={p.slug}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>

        <Field label="cost cap (usd)">
          <input
            type="number"
            min={1}
            step={1}
            value={costCap}
            onChange={(e) => setCostCap(Number(e.target.value))}
          />
        </Field>

        <div className="sg-span2">
          <Field label="system prompt">
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
            />
          </Field>
        </div>

        <Field label="candidate model name" hint="auto-registered after success">
          <input
            type="text"
            value={candidateName}
            onChange={(e) => setCandidateName(e.target.value)}
            required
          />
        </Field>

        <div>
          <span className="k">advanced</span>
          <div className="sg-row sg-row--tight" style={{ marginTop: "0.4rem" }}>
            <button
              type="button"
              className="btn"
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? "hide" : "show"} hyperparameters
            </button>
          </div>
        </div>

        {showAdvanced ? (
          <>
            <Field label="epochs">
              <input
                type="number"
                min={1}
                max={10}
                value={epochs}
                onChange={(e) =>
                  setEpochs(Math.max(1, Math.floor(Number(e.target.value))))
                }
              />
            </Field>
            <Field label="lr multiplier">
              <input
                type="number"
                step={0.1}
                min={0.1}
                value={lrMultiplier}
                onChange={(e) => setLrMultiplier(Number(e.target.value))}
              />
            </Field>
          </>
        ) : null}

        <div className="sg-span2 sg-tile">
          <div
            className="sg-tile__v"
            style={{ color: overCap ? "var(--error)" : undefined }}
          >
            ${estimate.toFixed(2)}
          </div>
          <span className="k sg-tile__k">estimated cost</span>
          <span className="sg-tile__n">
            {previewRows} rows · ~{previewTokens.toLocaleString()} tokens · cap $
            {costCap.toFixed(2)}
            {overCap ? ". the estimate exceeds the cap." : ""}
          </span>
        </div>

        {error ? <p className="sg-err sg-span2">{error}</p> : null}

        <div className="sg-row sg-row--end sg-span2">
          <Link className="btn" href="/admin/fine-tunes">
            cancel
          </Link>
          <button
            type="submit"
            className="btn btn--send"
            disabled={
              submitting ||
              sourceSlugs.length === 0 ||
              !candidateName ||
              overCap
            }
          >
            {submitting ? "starting" : "start fine-tune"}
          </button>
        </div>
      </form>
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
