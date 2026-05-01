"use client";

/**
 * /admin/fine-tunes (US-124 list)
 *
 * Lists all jobs. Live polling at 5s when any visible job is queued/validating/running.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  FONT_MONO,
  btnSmallStyle,
  statusPillStyle,
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
  candidate: { id: string; name: string; color: string } | null;
};

export default function FinetunesPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<() => void>();

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/fine-tunes", { cache: "no-store" });
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
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
          gap: "1rem",
          flexWrap: "wrap",
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
          fine-tunes
        </h1>
        <Link
          href="/admin/fine-tunes/new"
          style={{ ...btnSmallStyle, textDecoration: "none" }}
        >
          + start fine-tune
        </Link>
      </div>

      {loading ? (
        <p style={{ fontFamily: FONT_MONO, color: "var(--text-secondary)" }}>
          loading...
        </p>
      ) : jobs.length === 0 ? (
        <p style={{ fontFamily: FONT_MONO, color: "var(--text-secondary)" }}>
          no fine-tune jobs yet.{" "}
          <Link
            href="/admin/fine-tunes/new"
            style={{ color: "var(--text-primary)" }}
          >
            start one →
          </Link>
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {jobs.map((j) => (
            <li
              key={j.id}
              style={{
                borderTop: "1px solid var(--border-light)",
                padding: "1rem 0",
              }}
            >
              <Link
                href={`/admin/fine-tunes/${j.id}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                  alignItems: "baseline",
                }}
              >
                <span
                  style={{
                    fontFamily: '"Standard", sans-serif',
                    fontSize: "1rem",
                    fontWeight: 500,
                    flex: "1 1 200px",
                  }}
                >
                  {j.candidate?.name || "(no candidate)"}{" "}
                  <span
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: "0.85rem",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {j.provider} · {j.base_model} ·{" "}
                    {j.training_format.toUpperCase()}
                  </span>
                </span>
                <span style={statusPillStyle(j.status)}>
                  {j.status === "succeeded" ? "ready" : j.status}
                </span>
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: "0.8rem",
                    color: "var(--text-tertiary)",
                  }}
                >
                  {j.cost_usd !== null
                    ? `$${Number(j.cost_usd).toFixed(2)}`
                    : "-"}{" "}
                  · {formatDate(j.created_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
