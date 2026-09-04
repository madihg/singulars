"use client";

/**
 * /admin/models/[id] (and /admin/models/new) (US-105)
 *
 * Single form for create + edit. id === "new" -> create flow.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Win from "@/components/desktop/Win";
import { Toaster, useToasts } from "../../_components/Toaster";

const FAMILIES = [
  "claude",
  "gpt",
  "gemini",
  "grok",
  "deepseek",
  "qwen",
  "llama",
  "mistral",
  "open-source-ground",
  "other",
] as const;

type Model = {
  id?: string;
  name: string;
  slug: string;
  family: (typeof FAMILIES)[number];
  version_label: string | null;
  api_endpoint: string | null;
  hf_repo: string | null;
  color: string;
  notes: string | null;
  is_public: boolean;
  fine_tune_source: string | null;
};

const EMPTY: Model = {
  name: "",
  slug: "",
  family: "other",
  version_label: null,
  api_endpoint: null,
  hf_repo: null,
  color: "#888888",
  notes: null,
  is_public: false,
  fine_tune_source: null,
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function ModelEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string) || "new";
  const isNew = id === "new";

  const [model, setModel] = useState<Model>(EMPTY);
  const [allModels, setAllModels] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugConflict, setSlugConflict] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toasts, push, dismiss } = useToasts();

  // Load model + sibling list (for fine_tune_source select)
  const load = useCallback(async () => {
    if (!isNew) {
      const r = await fetch(`/singulars/api/admin/candidate-models/${id}`, {
        cache: "no-store",
      });
      const j = await r.json();
      if (r.ok) setModel(j.model);
    }
    const r2 = await fetch(
      "/singulars/api/admin/candidate-models?include_archived=true",
      { cache: "no-store" },
    );
    const j2 = await r2.json();
    if (r2.ok) setAllModels(j2.models || []);
  }, [id, isNew]);
  useEffect(() => {
    load();
  }, [load]);

  // Auto-slug from name
  useEffect(() => {
    if (isNew && !slugTouched && model.name) {
      setModel((m) => ({ ...m, slug: slugify(m.name) }));
    }
  }, [isNew, slugTouched, model.name]);

  // Slug conflict probe (debounced via simple useEffect)
  useEffect(() => {
    if (!model.slug) {
      setSlugConflict(null);
      return;
    }
    const t = setTimeout(async () => {
      const r = await fetch(
        `/singulars/api/admin/candidate-models?slug=${encodeURIComponent(model.slug)}`,
      );
      const j = await r.json();
      const hit = (j.models || []).find(
        (m: { id: string; name: string }) => m.id !== model.id,
      );
      setSlugConflict(hit ? hit.name : null);
    }, 250);
    return () => clearTimeout(t);
  }, [model.slug, model.id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!model.name || !model.slug || !model.family) {
      setError("name, slug, family required");
      return;
    }
    if (slugConflict) {
      setError(`slug taken by ${slugConflict}`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = isNew
        ? await fetch("/singulars/api/admin/candidate-models", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(model),
          })
        : await fetch(`/singulars/api/admin/candidate-models/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(model),
          });
      const j = await res.json();
      if (!res.ok) {
        setError(j?.error || "save failed");
        return;
      }
      push(isNew ? "created" : "saved", "success", model.color);
      router.push("/admin/models");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Win
      file={isNew ? "models/new.txt" : `models/${model.slug || "model"}.txt`}
      span="w--eight"
      meta={model.is_public ? "public" : "private"}
    >
      <p className="k">candidate model</p>
      <h1 className="h2">{isNew ? "new model" : model.name || "model"}</h1>
      <div className="rule" />

      <form onSubmit={save} className="sg-form sg-form--2">
        <Field label="name *">
          <input
            type="text"
            value={model.name}
            onChange={(e) => setModel({ ...model, name: e.target.value })}
            required
          />
        </Field>
        <Field
          label="slug *"
          hint={slugConflict ? `slug taken by ${slugConflict}` : null}
          hintError={!!slugConflict}
        >
          <input
            type="text"
            value={model.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setModel({ ...model, slug: e.target.value });
            }}
            required
          />
        </Field>
        <Field label="family *">
          <select
            value={model.family}
            onChange={(e) =>
              setModel({ ...model, family: e.target.value as Model["family"] })
            }
          >
            {FAMILIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
        <Field label="version label">
          <input
            type="text"
            value={model.version_label || ""}
            onChange={(e) =>
              setModel({ ...model, version_label: e.target.value || null })
            }
            placeholder="v0, 4.7"
          />
        </Field>
        <Field
          label="api endpoint"
          hint="promptfoo provider id, e.g. anthropic:messages:claude-opus-4-7"
        >
          <input
            type="text"
            value={model.api_endpoint || ""}
            onChange={(e) =>
              setModel({ ...model, api_endpoint: e.target.value || null })
            }
          />
        </Field>
        <Field label="hf repo">
          <input
            type="text"
            value={model.hf_repo || ""}
            onChange={(e) =>
              setModel({ ...model, hf_repo: e.target.value || null })
            }
            placeholder="halim/ground-exe-v1"
          />
        </Field>
        <Field label="fine-tune source">
          <select
            value={model.fine_tune_source || ""}
            onChange={(e) =>
              setModel({
                ...model,
                fine_tune_source: e.target.value || null,
              })
            }
          >
            <option value="">none</option>
            {allModels
              .filter((m) => m.id !== model.id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </Field>
        <div className="dk-input">
          <span>colour</span>
          <div className="sg-row">
            <input
              type="color"
              aria-label="model colour"
              value={model.color}
              onChange={(e) => setModel({ ...model, color: e.target.value })}
              style={{
                width: 44,
                height: 34,
                padding: 0,
                border: "1px solid var(--metal)",
                borderRadius: 4,
                background: "var(--paper)",
              }}
            />
            <input
              type="text"
              aria-label="model colour hex"
              value={model.color}
              onChange={(e) => setModel({ ...model, color: e.target.value })}
              style={{
                width: 110,
                background: "var(--paper)",
                border: "1px solid var(--metal)",
                borderRadius: 4,
                padding: "0.5rem 0.6rem",
                fontFamily: "var(--font-mono)",
                fontSize: "0.85rem",
              }}
            />
            <span className="k">
              <i className="cdot" style={{ ["--c" as string]: model.color }} />{" "}
              {model.name || "(name)"}
            </span>
          </div>
        </div>
        <div className="sg-span2">
          <Field label="notes">
            <textarea
              value={model.notes || ""}
              onChange={(e) =>
                setModel({ ...model, notes: e.target.value || null })
              }
              rows={3}
            />
          </Field>
        </div>
        <div className="sg-span2">
          <label className="dk-check">
            <input
              type="checkbox"
              checked={model.is_public}
              onChange={(e) =>
                setModel({ ...model, is_public: e.target.checked })
              }
            />
            public on the chart
          </label>
        </div>

        {error ? (
          <p className="sg-err sg-span2">{error}</p>
        ) : null}

        <div className="sg-row sg-row--end sg-span2">
          <Link className="btn" href="/admin/models">
            cancel
          </Link>
          <button
            type="submit"
            className="btn btn--send"
            disabled={saving || !!slugConflict}
          >
            {saving ? "saving" : isNew ? "create" : "save"}
          </button>
        </div>
      </form>
      <Toaster toasts={toasts} dismiss={dismiss} />
    </Win>
  );
}

/** A labelled field in the desk register. */
function Field({
  label,
  hint,
  hintError,
  children,
}: {
  label: string;
  hint?: string | null;
  hintError?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="dk-input">
      <span>{label}</span>
      {children}
      {hint ? (
        <span
          className="k"
          style={{
            marginTop: "0.3rem",
            color: hintError ? "var(--error)" : undefined,
          }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}
