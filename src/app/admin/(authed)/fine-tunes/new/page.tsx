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
import {
  FONT_MONO,
  inputStyle,
  btnPrimaryStyle,
  btnSecondaryStyle,
  backLinkStyle,
} from "@/lib/admin-styles";
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
    fetch("/api/admin/performances")
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
    fetch(`/api/admin/training-data/export?${params.toString()}`)
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
      const res = await fetch("/api/admin/fine-tunes/start", {
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
    <div style={{ maxWidth: 560 }}>
      <Link href="/admin/fine-tunes" style={backLinkStyle}>
        ← fine-tunes
      </Link>
      <h1
        style={{
          fontFamily: '"Terminal Grotesque", sans-serif',
          fontSize: "3.5rem",
          lineHeight: 0.9,
          margin: "1rem 0 2rem 0",
        }}
      >
        new fine-tune
      </h1>

      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
      >
        <Field label="provider">
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {(["openai", "together", "huggingface"] as Provider[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: "0.85rem",
                  padding: "0.4rem 0.75rem",
                  border: `1px solid ${provider === p ? "var(--text-primary)" : "var(--border-light)"}`,
                  background:
                    provider === p ? "var(--text-primary)" : "transparent",
                  color: provider === p ? "#fff" : "var(--text-primary)",
                  cursor: "pointer",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </Field>

        <Field label="base model">
          <select
            value={baseModel}
            onChange={(e) => setBaseModel(e.target.value)}
            style={{ ...inputStyle, padding: "0.65rem 0.75rem" }}
          >
            {BASE_MODELS[provider].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>

        <Field label="format">
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {(["sft", "dpo"] as Format[]).map((f) => {
              const disabled = f === "dpo" && !SUPPORTS_DPO[provider];
              return (
                <button
                  key={f}
                  type="button"
                  disabled={disabled}
                  onClick={() => setFormat(f)}
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: "0.85rem",
                    padding: "0.4rem 0.75rem",
                    border: `1px solid ${format === f ? "var(--text-primary)" : "var(--border-light)"}`,
                    background:
                      format === f ? "var(--text-primary)" : "transparent",
                    color: format === f ? "#fff" : "var(--text-primary)",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.4 : 1,
                  }}
                >
                  {f.toUpperCase()}
                  {disabled ? " (provider unsupported)" : ""}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="source performances">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {perfs
              .filter((p) => p.status === "trained")
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleSource(p.slug)}
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: "0.85rem",
                    padding: "0.4rem 0.75rem",
                    border: `1px solid ${sourceSlugs.includes(p.slug) ? "var(--text-primary)" : "var(--border-light)"}`,
                    background: sourceSlugs.includes(p.slug)
                      ? "var(--text-primary)"
                      : "transparent",
                    color: sourceSlugs.includes(p.slug)
                      ? "#fff"
                      : "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  {p.name}
                </button>
              ))}
          </div>
        </Field>

        <Field
          label="hold out performance"
          hint="becomes the test set; excluded from training"
        >
          <select
            value={holdoutSlug}
            onChange={(e) => setHoldoutSlug(e.target.value)}
            style={{ ...inputStyle, padding: "0.65rem 0.75rem" }}
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

        <Field label="system prompt">
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={4}
            style={{ ...inputStyle, fontFamily: FONT_MONO, resize: "vertical" }}
          />
        </Field>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          style={{
            fontFamily: FONT_MONO,
            fontSize: "0.8rem",
            background: "transparent",
            border: "none",
            padding: 0,
            color: "var(--text-secondary)",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {showAdvanced ? "- advanced" : "+ advanced"}
        </button>
        {showAdvanced ? (
          <div style={{ display: "flex", gap: "1rem" }}>
            <Field label="epochs">
              <input
                type="number"
                min={1}
                max={10}
                value={epochs}
                onChange={(e) =>
                  setEpochs(Math.max(1, Math.floor(Number(e.target.value))))
                }
                style={inputStyle}
              />
            </Field>
            <Field label="lr multiplier">
              <input
                type="number"
                step={0.1}
                min={0.1}
                value={lrMultiplier}
                onChange={(e) => setLrMultiplier(Number(e.target.value))}
                style={inputStyle}
              />
            </Field>
          </div>
        ) : null}

        <Field label="cost cap (usd)">
          <input
            type="number"
            min={1}
            step={1}
            value={costCap}
            onChange={(e) => setCostCap(Number(e.target.value))}
            style={inputStyle}
          />
        </Field>

        <Field
          label="candidate model name"
          hint="auto-registered after success"
        >
          <input
            type="text"
            value={candidateName}
            onChange={(e) => setCandidateName(e.target.value)}
            style={inputStyle}
            required
          />
        </Field>

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
            {previewRows} rows · ~{previewTokens.toLocaleString()} tokens · cap
            ${costCap.toFixed(2)}
            {overCap ? " · estimate exceeds cap" : ""}
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
              submitting ||
              sourceSlugs.length === 0 ||
              !candidateName ||
              overCap
            }
            style={btnPrimaryStyle}
          >
            {submitting ? "starting..." : "start fine-tune"}
          </button>
          <Link
            href="/admin/fine-tunes"
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
