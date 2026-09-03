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
import { formatDate } from "@/lib/admin-format";
import Win from "@/components/desktop/Win";

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
    const r = await fetch(`/singulars/api/admin/fine-tunes/${id}`, { cache: "no-store" });
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
    const r = await fetch(`/singulars/api/admin/fine-tunes/${id}/retry`, {
      method: "POST",
    });
    if (r.ok) {
      const j = await r.json();
      window.location.href = `/singulars/admin/fine-tunes/${j.id}`;
    }
  }

  if (loading || !job) {
    return (
      <Win file="fine-tune.txt" span="w--eight">
        <p className="note" style={{ marginTop: 0 }}>
          Loading.
        </p>
      </Win>
    );
  }

  const providerUrl =
    job.provider_job_id && PROVIDER_URLS[job.provider]
      ? PROVIDER_URLS[job.provider](job.provider_job_id)
      : null;

  return (
    <>
      <Win
        file="fine-tune.txt"
        span="w--eight"
        meta={job.status === "succeeded" ? "ready" : job.status}
      >
        <p className="k">
          {job.candidate ? (
            <i
              className="cdot"
              style={{ ["--c" as string]: job.candidate.color }}
            />
          ) : null}{" "}
          fine-tune job
        </p>
        <h1 className="h2">{job.candidate?.name || "(no candidate)"}</h1>
        <div className="rule" />

        <div className="sg-tiles">
          <Stat label="provider" value={job.provider} />
          <Stat label="base model" value={job.base_model} />
          <Stat label="format" value={job.training_format.toUpperCase()} />
          <Stat label="rows" value={job.n_training_rows ?? "-"} />
          <Stat
            label="cost"
            value={
              job.cost_usd !== null
                ? `$${Number(job.cost_usd).toFixed(2)}`
                : "-"
            }
          />
          <Stat label="started" value={formatDate(job.created_at)} />
          <Stat
            label="finished"
            value={job.finished_at ? formatDate(job.finished_at) : "-"}
          />
        </div>

        {job.status === "succeeded" && job.candidate ? (
          <div className="sg-row sg-row--between" style={{ marginTop: "1rem" }}>
            <span className="k">{job.candidate.name} is ready</span>
            <Link
              className="btn btn--send"
              href={`/admin/eval-runs/new?candidate=${job.candidate.slug}`}
            >
              run eval &rarr;
            </Link>
          </div>
        ) : null}

        {job.status === "failed" && job.error_message ? (
          <>
            <p className="sg-err">{job.error_message}</p>
            <div className="sg-row" style={{ marginTop: "0.6rem" }}>
              <button type="button" className="btn" onClick={retry}>
                retry
              </button>
            </div>
          </>
        ) : null}

        {providerUrl ? (
          <div className="sg-row" style={{ marginTop: "1rem" }}>
            <a
              className="btn"
              href={providerUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              view on {job.provider} &#x2197;
            </a>
          </div>
        ) : null}
      </Win>

      {job.hyperparameters ? (
        <Win file="hyperparameters/" span="w--five">
          <div className="sg-tablewrap">
            <table className="sg-table">
              <tbody>
                {Object.entries(job.hyperparameters).map(([k, v]) => (
                  <tr key={k}>
                    <td className="sg-num">{k}</td>
                    <td className="sg-num">{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Win>
      ) : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="sg-tile">
      <div className="sg-tile__v" style={{ fontSize: "1rem" }}>
        {value}
      </div>
      <span className="k sg-tile__k">{label}</span>
    </div>
  );
}
