"use client";

/**
 * /admin/models (US-105)
 *
 * Lists candidate_models. "show archived" toggle. Per row: name, family, color
 * swatch, is_public toggle, archive button, edit link.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { FONT_MONO, btnSmallStyle, statusPillStyle } from "@/lib/admin-styles";
import { ConfirmModal } from "../_components/ConfirmModal";
import { Toaster, useToasts } from "../_components/Toaster";

type Model = {
  id: string;
  name: string;
  slug: string;
  family: string;
  color: string;
  is_public: boolean;
  archived: boolean;
  api_endpoint: string | null;
  notes: string | null;
};

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmArchive, setConfirmArchive] = useState<Model | null>(null);
  const { toasts, push, dismiss } = useToasts();

  const load = useCallback(async () => {
    setLoading(true);
    const url = includeArchived
      ? "/api/admin/candidate-models?include_archived=true"
      : "/api/admin/candidate-models";
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    setModels(json.models || []);
    setLoading(false);
  }, [includeArchived]);

  useEffect(() => {
    load();
  }, [load]);

  async function togglePublic(m: Model) {
    const res = await fetch(
      `/api/admin/candidate-models/${m.id}/toggle-public`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: !m.is_public }),
      },
    );
    if (!res.ok) {
      push("toggle failed", "error");
    } else {
      push(
        `${m.name} is ${!m.is_public ? "public" : "private"}`,
        "success",
        m.color,
      );
      load();
    }
  }

  async function archive(m: Model) {
    const res = await fetch(`/api/admin/candidate-models/${m.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      push("archive failed", "error");
    } else {
      push(`archived ${m.name}`, "success");
      load();
    }
    setConfirmArchive(null);
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
        }}
      >
        <h1
          style={{
            fontFamily: '"Terminal Grotesque", sans-serif',
            fontSize: "3.5rem",
            lineHeight: 0.9,
            margin: 0,
          }}
        >
          models
        </h1>
        <Link
          href="/admin/models/new"
          style={{ ...btnSmallStyle, textDecoration: "none" }}
        >
          + new model
        </Link>
      </div>

      <button
        onClick={() => setIncludeArchived((v) => !v)}
        style={{
          fontFamily: FONT_MONO,
          fontSize: "0.8rem",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          opacity: includeArchived ? 1 : 0.5,
          color: "var(--text-secondary)",
          marginBottom: "1.5rem",
        }}
      >
        show archived {includeArchived ? "·" : ""}
      </button>

      {loading ? (
        <p style={{ fontFamily: FONT_MONO, color: "var(--text-secondary)" }}>
          loading...
        </p>
      ) : models.length === 0 ? (
        <p style={{ fontFamily: FONT_MONO, color: "var(--text-secondary)" }}>
          no candidate models yet.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {models.map((m) => (
            <li
              key={m.id}
              style={{
                borderTop: "1px solid var(--border-light)",
                padding: "1rem 0",
                opacity: m.archived ? 0.5 : 1,
                display: "flex",
                gap: "1rem",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div
                aria-label={`color ${m.color}`}
                style={{
                  width: 24,
                  height: 24,
                  background: m.color,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: '"Standard", sans-serif',
                    fontSize: "1rem",
                    fontWeight: 500,
                  }}
                >
                  {m.name}
                </div>
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: "0.8rem",
                    color: "var(--text-tertiary)",
                  }}
                >
                  {m.family} · {m.slug}
                </div>
              </div>
              <span
                style={statusPillStyle(m.is_public ? "published" : "draft")}
              >
                {m.is_public ? "public" : "private"}
              </span>
              <button onClick={() => togglePublic(m)} style={btnSmallStyle}>
                {m.is_public ? "make private" : "make public"}
              </button>
              <Link
                href={`/admin/models/${m.id}`}
                style={{ ...btnSmallStyle, textDecoration: "none" }}
              >
                edit
              </Link>
              {!m.archived ? (
                <button
                  onClick={() => setConfirmArchive(m)}
                  style={btnSmallStyle}
                >
                  archive
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {confirmArchive ? (
        <ConfirmModal
          title={`archive ${confirmArchive.name}?`}
          body="it disappears from the public chart and from new eval runs. existing eval runs keep their reference."
          confirmLabel="archive"
          accentColor={confirmArchive.color}
          destructive
          onCancel={() => setConfirmArchive(null)}
          onConfirm={() => archive(confirmArchive)}
        />
      ) : null}
      <Toaster toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
