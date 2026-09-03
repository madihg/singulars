"use client";

/**
 * /admin/fine-tunes (US-124 list)
 *
 * Lists all jobs. Live polling at 5s when any visible job is queued/validating/running.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
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
  candidate: { id: string; name: string; color: string } | null;
};

export default function FinetunesPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<() => void>();

  const load = useCallback(async () => {
    const r = await fetch("/singulars/api/admin/fine-tunes", { cache: "no-store" });
    const j = await r.json();
    setJobs(j.jobs || []);
    setLoading(false);
  }, []);
  ref.current = load;

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const live = jobs.some(
      (j) =>
        j.status === "queued" ||
        j.status === "validating" ||
        j.status === "running",
    );
    if (!live) return;
    const t = setInterval(() => ref.current?.(), 5000);
    return () => clearInterval(t);
  }, [jobs]);

  return (
    <Win
      file="fine-tunes/"
      span="w--eight"
      meta={loading ? "loading" : `${jobs.length} jobs`}
    >
      <div className="sg-row sg-row--end" style={{ marginBottom: "0.9rem" }}>
        <Link className="btn btn--send" href="/admin/fine-tunes/new">
          start fine-tune
        </Link>
      </div>

      {loading ? (
        <p className="note" style={{ marginTop: 0 }}>
          Loading.
        </p>
      ) : jobs.length === 0 ? (
        <p className="note" style={{ marginTop: 0 }}>
          No fine-tune jobs yet.{" "}
          <Link href="/admin/fine-tunes/new">start one &rarr;</Link>
        </p>
      ) : (
        <>
          <div className="hdr">
            <span className="k">candidate</span>
            <span className="k">status</span>
            <span className="k">recipe</span>
            <span className="k">when</span>
          </div>
          {jobs.map((j) => (
            <Link
              className="sg-line sg-line--4"
              key={j.id}
              href={`/admin/fine-tunes/${j.id}`}
            >
              <span className="sg-line__n">
                {j.candidate?.name || "(no candidate)"}
              </span>
              <span className="fr__s">
                <span className="sg-pill" data-state={j.status}>
                  {j.status === "succeeded" ? "ready" : j.status}
                </span>
              </span>
              <span className="fr__w">
                {j.provider} · {j.base_model} · {j.training_format.toUpperCase()}
                {j.cost_usd !== null
                  ? ` · $${Number(j.cost_usd).toFixed(2)}`
                  : ""}
              </span>
              <span className="fr__d">{formatDate(j.created_at)}</span>
            </Link>
          ))}
        </>
      )}
    </Win>
  );
}
