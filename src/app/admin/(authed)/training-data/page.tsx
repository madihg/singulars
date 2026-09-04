"use client";

/**
 * /admin/training-data (US-121)
 *
 * Form: source perfs, exclude themes, format (sft/dpo), system prompt,
 * holdout perf. Live preview pane: row count, approx tokens, first 5 rows.
 * Download button hits the export route with the resolved filename.
 */

import { useEffect, useState, useCallback } from "react";
import Win from "@/components/desktop/Win";
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
    fetch("/singulars/api/admin/performances")
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
        `/singulars/api/admin/training-data/export?${params.toString()}`,
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
    return `/singulars/api/admin/training-data/export?${params.toString()}`;
  }

  return (
    <>
      <Win file="training-data.txt" span="w--five">
        <p className="k">fine-tune pipeline</p>
        <h1 className="h2">training data</h1>
        <p className="note">
          Export jsonl for openai, together, or any other provider.
        </p>
        <div className="rule" />

        <form
          onSubmit={(e) => e.preventDefault()}
          className="sg-stack sg-stack--tight"
        >
          <div>
            <span className="k">source performances</span>
            <div className="sg-row sg-row--tight" style={{ marginTop: "0.4rem" }}>
              {perfs
                .filter((p) => p.status === "trained")
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="btn"
                    aria-pressed={selected.includes(p.slug)}
                    onClick={() => toggle(p.slug)}
                  >
                    {p.name}
                  </button>
                ))}
            </div>
          </div>

          <div>
            <span className="k">format</span>
            <div className="sg-row sg-row--tight" style={{ marginTop: "0.4rem" }}>
              {(["sft", "dpo"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className="btn"
                  aria-pressed={format === f}
                  onClick={() => setFormat(f)}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <Field
            label="hold-out performance"
            hint="excluded from training. a sibling _holdout.jsonl is available."
          >
            <select
              value={holdout}
              onChange={(e) => setHoldout(e.target.value)}
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
            />
          </Field>

          <div className="sg-row sg-row--end">
            <a className="btn btn--send" href={downloadUrl()}>
              download jsonl
            </a>
          </div>
        </form>
      </Win>

      <Win
        file="preview.jsonl"
        span="w--seven"
        meta={
          loading
            ? "computing"
            : preview
              ? `${preview.rows} rows`
              : "nothing selected"
        }
      >
        <p className="k">
          {loading
            ? "computing"
            : preview
              ? `${preview.rows} rows · ~${preview.approxTokens} tokens${preview.holdoutRows ? ` · ${preview.holdoutRows} holdout` : ""}`
              : "select at least one performance"}
        </p>
        {preview && preview.preview.length > 0 ? (
          <pre className="sg-pre" style={{ marginTop: "0.6rem" }}>
            {preview.preview.join("\n\n")}
          </pre>
        ) : null}
      </Win>
    </>
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
