"use client";

/**
 * /admin/fine-tunes/[id] (US-124 detail)
 *
 * Status, hyperparameters, training-data summary, cost-so-far, error_message
 * on failure, "view on provider" link. On succeeded, surfaces a "run eval?"
 * CTA that pre-fills /admin/eval-runs/new with the new candidate.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  FONT_MONO,
  btnSmallStyle,
  statusPillStyle,
  backLinkStyle,
  formatDate,
} from "@/lib/admin-styles";

type Job = {
  id: string;
  provider: string;
  base_model: string;
  training_format: "sft" | "dpo";
  status:
    | "queued"
    | "validating"
    | "running"
    | "succeeded"
    | "failed"
    | "cancelled";
  cost_usd: number | null;
  duration_ms: number | null;
  output_model_id: string | null;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
  hyperparameters: Record<string, unknown> | null;
  n_training_rows: number | null;
  source_performance_ids: string[];
  holdout_performance_ids: string[];
  provider_job_id: string | null;
  candidate: { id: string; slug: string; name: string; color: string } | null;
};

const PROVIDER_URLS: Record<string, (jobId: string) => string> = {
  openai: (id) => `https://platform.openai.com/finetune/${id}`,
  together: (id) => `https://api.together.xyz/playground/finetuning/${id}`,
};

export default function FinetuneDetailPage() {
  const params = useParams();
  const id = (params?.id as string) || "";
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/admin/fine-tunes/${id}`, { cache: "no-store" });
    const j = await r.json();
    if (r.ok) setJob(j.job);
    setLoading(false);
  }, [id]);
  useEffect(() => {
    if (id) load();
  }, [id, load]);

  // Live polling
  useEffect(() => {
    if (!job) return;
    if (
      job.status !== "queued" &&
      job.status !== "validating" &&
      job.status !== "running"
    )
      return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [job, load]);

  async function retry() {
    const r = await fetch(`/api/admin/fine-tunes/${id}/retry`, {
      method: "POST",
    });
    if (r.ok) {
      const j = await r.json();
      window.location.href = `/admin/fine-tunes/${j.id}`;
    }
  }

  if (loading || !job) {
    return (
      <p style={{ fontFamily: FONT_MONO, color: "var(--text-secondary)" }}>
        loading...
      </p>
    );
  }

  const providerUrl =
    job.provider_job_id && PROVIDER_URLS[job.provider]
      ? PROVIDER_URLS[job.provider](job.provider_job_id)
      : null;

  return (
    <div>
      <Link href="/admin/fine-tunes" style={backLinkStyle}>
        ← fine-tunes
      </Link>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
          margin: "1rem 0 1.5rem 0",
        }}
      >
        <h1
          style={{
            fontFamily: '"Diatype Variable", sans-serif',
            fontSize: "2rem",
            fontWeight: 700,
            margin: 0,
          }}
        >
          {job.candidate?.name || "(no candidate)"}
        </h1>
        <span style={statusPillStyle(job.status)}>
          {job.status === "succeeded" ? "ready" : job.status}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <Stat label="provider" value={job.provider} />
        <Stat label="base model" value={job.base_model} small />
        <Stat label="format" value={job.training_format.toUpperCase()} />
        <Stat label="rows" value={job.n_training_rows ?? "-"} />
        <Stat
          label="cost"
          value={
            job.cost_usd !== null ? `$${Number(job.cost_usd).toFixed(2)}` : "-"
          }
        />
        <Stat label="started" value={formatDate(job.created_at)} />
        <Stat
          label="finished"
          value={job.finished_at ? formatDate(job.finished_at) : "-"}
        />
      </div>

      {job.status === "succeeded" && job.candidate ? (
        <div
          style={{
            border: "1px solid #171717",
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <span style={{ fontFamily: FONT_MONO, fontSize: "0.9rem" }}>
            {job.candidate.name} is ready.
          </span>
          <Link
            href={`/admin/eval-runs/new?candidate=${job.candidate.slug}`}
            style={{
              ...btnSmallStyle,
              textDecoration: "none",
              background: job.candidate.color,
              color: "#fff",
              borderColor: job.candidate.color,
            }}
          >
            run eval →
          </Link>
        </div>
      ) : null}

      {job.status === "failed" && job.error_message ? (
        <div
          style={{
            border: "1px solid #dc2626",
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            fontFamily: FONT_MONO,
            fontSize: "0.85rem",
            color: "#dc2626",
          }}
        >
          {job.error_message}
          <div style={{ marginTop: "0.75rem" }}>
            <button onClick={retry} style={btnSmallStyle}>
              retry
            </button>
          </div>
        </div>
      ) : null}

      {/* Hyperparameters */}
      {job.hyperparameters ? (
        <section style={{ marginBottom: "2rem" }}>
          <h2
            style={{
              fontFamily: '"Diatype Variable", sans-serif',
              fontSize: "1.1rem",
              fontWeight: 700,
              margin: "0 0 0.75rem 0",
            }}
          >
            hyperparameters
          </h2>
          <table
            style={{
              fontFamily: FONT_MONO,
              fontSize: "0.85rem",
              borderCollapse: "collapse",
            }}
          >
            <tbody>
              {Object.entries(job.hyperparameters).map(([k, v]) => (
                <tr key={k}>
                  <td
                    style={{
                      padding: "0.25rem 1rem 0.25rem 0",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {k}
                  </td>
                  <td>{String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {providerUrl ? (
        <p style={{ fontFamily: FONT_MONO, fontSize: "0.85rem" }}>
          <a
            href={providerUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--text-primary)" }}
          >
            view on {job.provider} ↗
          </a>
        </p>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  small,
}: {
  label: string;
  value: React.ReactNode;
  small?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--text-tertiary)",
          marginBottom: "0.25rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: small ? "0.85rem" : "1.05rem",
          fontWeight: 500,
          wordBreak: "break-all",
        }}
      >
        {value}
      </div>
    </div>
  );
}
