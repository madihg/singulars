"use client";

/**
 * /admin/models/[id] (and /admin/models/new) (US-105)
 *
 * Single form for create + edit. id === "new" -> create flow.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  FONT_MONO,
  inputStyle,
  btnPrimaryStyle,
  btnSecondaryStyle,
  backLinkStyle,
} from "@/lib/admin-styles";
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
      const r = await fetch(`/api/admin/candidate-models/${id}`, {
        cache: "no-store",
      });
      const j = await r.json();
      if (r.ok) setModel(j.model);
    }
    const r2 = await fetch(
      "/api/admin/candidate-models?include_archived=true",
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
        `/api/admin/candidate-models?slug=${encodeURIComponent(model.slug)}`,
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
        ? await fetch("/api/admin/candidate-models", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(model),
          })
        : await fetch(`/api/admin/candidate-models/${id}`, {
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
    <div style={{ maxWidth: 560 }}>
      <Link href="/admin/models" style={backLinkStyle}>
        ← models
      </Link>
      <h1
        style={{
          fontFamily: '"Terminal Grotesque", sans-serif',
          fontSize: "3.5rem",
          lineHeight: 0.9,
          margin: "1rem 0 2rem 0",
        }}
      >
        {isNew ? "new model" : model.name || "model"}
      </h1>

      <form
        onSubmit={save}
        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        <Field label="name" required>
          <input
            type="text"
            value={model.name}
            onChange={(e) => setModel({ ...model, name: e.target.value })}
            style={inputStyle}
            required
          />
        </Field>
        <Field
          label="slug"
          required
          hint={slugConflict ? `slug taken by ${slugConflict}` : null}
          hintColor={slugConflict ? "#dc2626" : undefined}
        >
          <input
            type="text"
            value={model.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setModel({ ...model, slug: e.target.value });
            }}
            style={inputStyle}
            required
          />
        </Field>
        <Field label="family" required>
          <select
            value={model.family}
            onChange={(e) =>
              setModel({ ...model, family: e.target.value as Model["family"] })
            }
            style={{ ...inputStyle, padding: "0.65rem 0.75rem" }}
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
            style={inputStyle}
            placeholder="v0, 4.7, ..."
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
            style={inputStyle}
          />
        </Field>
        <Field label="hf repo">
          <input
            type="text"
            value={model.hf_repo || ""}
            onChange={(e) =>
              setModel({ ...model, hf_repo: e.target.value || null })
            }
            style={inputStyle}
            placeholder="halim/ground-exe-v1"
          />
        </Field>
        <Field label="color">
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              type="color"
              value={model.color}
              onChange={(e) => setModel({ ...model, color: e.target.value })}
              style={{
                width: 48,
                height: 38,
                padding: 0,
                border: "1px solid var(--border-light)",
              }}
            />
            <input
              type="text"
              value={model.color}
              onChange={(e) => setModel({ ...model, color: e.target.value })}
              style={{ ...inputStyle, width: 120 }}
            />
            <ChartPreview name={model.name || "(name)"} color={model.color} />
          </div>
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
            style={{ ...inputStyle, padding: "0.65rem 0.75rem" }}
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
        <Field label="notes">
          <textarea
            value={model.notes || ""}
            onChange={(e) =>
              setModel({ ...model, notes: e.target.value || null })
            }
            rows={3}
            style={{ ...inputStyle, fontFamily: FONT_MONO, resize: "vertical" }}
          />
        </Field>
        <label
          style={{
            fontFamily: FONT_MONO,
            fontSize: "0.85rem",
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <input
            type="checkbox"
            checked={model.is_public}
            onChange={(e) =>
              setModel({ ...model, is_public: e.target.checked })
            }
          />
          public on chart
        </label>

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

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
          <button
            type="submit"
            disabled={saving || !!slugConflict}
            style={btnPrimaryStyle}
          >
            {saving ? "..." : isNew ? "create" : "save"}
          </button>
          <Link
            href="/admin/models"
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
      <Toaster toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  hintColor,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string | null;
  hintColor?: string;
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
        {required ? " *" : ""}
      </span>
      {children}
      {hint ? (
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: "0.75rem",
            color: hintColor || "var(--text-tertiary)",
          }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function ChartPreview({ name, color }: { name: string; color: string }) {
  return (
    <div
      style={{
        flex: 1,
        height: 36,
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0 0.5rem",
        borderLeft: "1px solid var(--border-light)",
      }}
    >
      <div style={{ width: 12, height: 12, background: color }} />
      <span style={{ fontFamily: FONT_MONO, fontSize: "0.75rem" }}>{name}</span>
    </div>
  );
}
