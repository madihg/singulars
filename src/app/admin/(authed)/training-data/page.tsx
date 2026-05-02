"use client";

/**
 * /admin/training-data (US-121)
 *
 * Form: source perfs, exclude themes, format (sft/dpo), system prompt,
 * holdout perf. Live preview pane: row count, approx tokens, first 5 rows.
 * Download button hits the export route with the resolved filename.
 */

import { useEffect, useState, useCallback } from "react";
import {
  FONT_MONO,
  inputStyle,
  btnPrimaryStyle,
  btnSecondaryStyle,
} from "@/lib/admin-styles";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/training-data";

type Perf = {
  id: string;
  slug: string;
  name: string;
  status: "upcoming" | "training" | "trained";
};

export default function TrainingDataPage() {
  const [perfs, setPerfs] = useState<Perf[]>([]);
  const [format, setFormat] = useState<"sft" | "dpo">("sft");
  const [selected, setSelected] = useState<string[]>([]);
  const [holdout, setHoldout] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [preview, setPreview] = useState<{
    rows: number;
    approxTokens: number;
    preview: string[];
    holdoutRows: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/performances")
      .then((r) => r.json())
      .then((j) => {
        const all = j.performances || [];
        setPerfs(all);
        const trained = all
          .filter((p: Perf) => p.status === "trained")
          .map((p: Perf) => p.slug);
        setSelected(trained);
      });
  }, []);

  const refresh = useCallback(async () => {
    if (selected.length === 0) {
      setPreview(null);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("format", format);
    params.set("performances", selected.join(","));
    if (holdout) params.set("holdout", holdout);
    params.set(
      "system_prompt",
      Buffer.from(systemPrompt, "utf8").toString("base64"),
    );
    params.set("preview", "true");
    try {
      const r = await fetch(
        `/api/admin/training-data/export?${params.toString()}`,
      );
      const j = await r.json();
      setPreview(j);
    } finally {
      setLoading(false);
    }
  }, [format, selected, holdout, systemPrompt]);

  useEffect(() => {
    const t = setTimeout(refresh, 250);
    return () => clearTimeout(t);
  }, [refresh]);

  function toggle(slug: string) {
    setSelected((s) =>
      s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug],
    );
  }

  function downloadUrl(): string {
    const params = new URLSearchParams();
    params.set("format", format);
    if (selected.length) params.set("performances", selected.join(","));
    if (holdout) params.set("holdout", holdout);
    params.set(
      "system_prompt",
      Buffer.from(systemPrompt, "utf8").toString("base64"),
    );
    return `/api/admin/training-data/export?${params.toString()}`;
  }

  return (
    <div>
      <h1
        style={{
          fontFamily: '"Terminal Grotesque", sans-serif',
          fontSize: "3.5rem",
          lineHeight: 0.9,
          margin: "0 0 0.5rem 0",
        }}
      >
        training data
      </h1>
      <p
        style={{
          fontFamily: FONT_MONO,
          fontSize: "0.9rem",
          color: "var(--text-secondary)",
          margin: "0 0 2rem 0",
        }}
      >
        export jsonl for openai, together, or any other provider.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 1fr) minmax(280px, 1fr)",
          gap: "2rem",
        }}
      >
        <form
          onSubmit={(e) => e.preventDefault()}
          style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
        >
          <Field label="source performances">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {perfs
                .filter((p) => p.status === "trained")
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.slug)}
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: "0.85rem",
                      padding: "0.4rem 0.75rem",
                      border: `1px solid ${selected.includes(p.slug) ? "var(--text-primary)" : "var(--border-light)"}`,
                      background: selected.includes(p.slug)
                        ? "var(--text-primary)"
                        : "transparent",
                      color: selected.includes(p.slug)
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

          <Field label="format">
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {(["sft", "dpo"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: "0.85rem",
                    padding: "0.4rem 0.75rem",
                    border: `1px solid ${format === f ? "var(--text-primary)" : "var(--border-light)"}`,
                    background:
                      format === f ? "var(--text-primary)" : "transparent",
                    color: format === f ? "#fff" : "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </Field>

          <Field
            label="hold-out performance"
            hint="excluded from training; sibling _holdout.jsonl available"
          >
            <select
              value={holdout}
              onChange={(e) => setHoldout(e.target.value)}
              style={{ ...inputStyle, padding: "0.65rem 0.75rem" }}
            >
              <option value="">none</option>
              {perfs
                .filter(
                  (p) => p.status === "trained" && selected.includes(p.slug),
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
              rows={6}
              style={{
                ...inputStyle,
                fontFamily: FONT_MONO,
                resize: "vertical",
              }}
            />
          </Field>

          <a
            href={downloadUrl()}
            style={{
              ...btnPrimaryStyle,
              textDecoration: "none",
              display: "inline-block",
              textAlign: "center",
            }}
          >
            download jsonl
          </a>
        </form>

        <div
          style={{
            border: "1px solid var(--border-light)",
            padding: "1rem",
            fontFamily: FONT_MONO,
            fontSize: "0.8rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            minHeight: 240,
          }}
        >
          <div
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.85rem",
            }}
          >
            {loading
              ? "computing..."
              : preview
                ? `${preview.rows} rows · ~${preview.approxTokens} tokens${preview.holdoutRows ? ` · ${preview.holdoutRows} holdout` : ""}`
                : "select at least one performance"}
          </div>
          {preview && preview.preview.length > 0 ? (
            <pre
              style={{
                fontFamily: FONT_MONO,
                fontSize: "0.7rem",
                whiteSpace: "pre-wrap",
                margin: 0,
                color: "var(--text-primary)",
                overflow: "auto",
                maxHeight: 480,
              }}
            >
              {preview.preview.join("\n\n")}
            </pre>
          ) : null}
        </div>
      </div>
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
    <label style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
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

// Suppress unused import (btnSecondaryStyle reserved for future cancel button)
void btnSecondaryStyle;
