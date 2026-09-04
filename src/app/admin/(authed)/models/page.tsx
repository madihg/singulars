"use client";

/**
 * /admin/models (US-105)
 *
 * Lists candidate_models. "show archived" toggle. Per row: name, family, color
 * swatch, is_public toggle, archive button, edit link.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Win from "@/components/desktop/Win";
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
      ? "/singulars/api/admin/candidate-models?include_archived=true"
      : "/singulars/api/admin/candidate-models";
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
      `/singulars/api/admin/candidate-models/${m.id}/toggle-public`,
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
    const res = await fetch(`/singulars/api/admin/candidate-models/${m.id}`, {
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
    <>
      <Win
        file="models/"
        span="w--eight"
        meta={loading ? "loading" : `${models.length} candidates`}
      >
        <div className="sg-row sg-row--between" style={{ marginBottom: "1rem" }}>
          <button
            type="button"
            className="btn"
            aria-pressed={includeArchived}
            onClick={() => setIncludeArchived((v) => !v)}
          >
            show archived
          </button>
          <Link className="btn btn--send" href="/admin/models/new">
            new model
          </Link>
        </div>

        {loading ? (
          <p className="note" style={{ marginTop: 0 }}>
            Loading.
          </p>
        ) : models.length === 0 ? (
          <p className="note" style={{ marginTop: 0 }}>
            No candidate models yet.
          </p>
        ) : (
          <>
            <div className="hdr">
              <span className="k">model</span>
              <span className="k">visibility</span>
              <span className="k">family</span>
              <span className="k">actions</span>
            </div>
            {models.map((m) => (
              <div
                className="sg-line sg-line--4"
                key={m.id}
                style={{ opacity: m.archived ? 0.55 : 1 }}
              >
                <span className="sg-line__n">
                  <i className="cdot" style={{ ["--c" as string]: m.color }} />
                  {m.name}
                </span>
                <span className="fr__s">
                  <span
                    className="sg-pill"
                    data-state={m.is_public ? "published" : "draft"}
                  >
                    {m.is_public ? "public" : "private"}
                  </span>
                </span>
                <span className="fr__w">
                  {m.family} · {m.slug}
                </span>
                <span className="sg-line__a">
                  <button
                    type="button"
                    className="btn"
                    aria-pressed={m.is_public}
                    onClick={() => togglePublic(m)}
                  >
                    {m.is_public ? "make private" : "make public"}
                  </button>
                  <Link className="btn" href={`/admin/models/${m.id}`}>
                    edit
                  </Link>
                  {!m.archived ? (
                    <button
                      type="button"
                      className="btn btn--danger"
                      onClick={() => setConfirmArchive(m)}
                    >
                      archive
                    </button>
                  ) : null}
                </span>
              </div>
            ))}
          </>
        )}
      </Win>

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
    </>
  );
}
