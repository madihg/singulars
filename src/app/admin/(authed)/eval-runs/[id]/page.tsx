"use client";

/**
 * /admin/eval-runs/[id] (US-108)
 *
 * Run detail. Header (status, win rate, judge, cost, started/finished + actions).
 * Per-theme rows: audience winner | audience loser | candidate poem, judge
 * rationale, confidence, position-swap-agreement flag.
 *
 * Position-bias warning when >30% of themes disagree under A/B swap.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  FONT_MONO,
  btnSmallStyle,
  statusPillStyle,
  backLinkStyle,
  formatDate,
} from "@/lib/admin-styles";
import { ConfirmModal } from "../../_components/ConfirmModal";
import { Toaster, useToasts } from "../../_components/Toaster";

type Score = {
  id: string;
  theme_slug: string;
  candidate_text: string;
  candidate_won: boolean;
  candidate_rank: number | null;
  judge_rationale: string | null;
  confidence: string | null;
  position_swap_agreement: boolean | null;
  audience_winner_text: string | null;
  audience_winner_type: string | null;
  audience_loser_text: string | null;
  audience_loser_type: string | null;
};

type Run = {
  id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  judge_model: string;
  n_themes: number;
  n_themes_completed: number;
  win_rate: number | null;
  cost_usd: number | null;
  duration_ms: number | null;
  started_at: string | null;
  finished_at: string | null;
  published: boolean;
  error_message: string | null;
  created_at: string;
  candidate_model: { id: string; name: string; color: string } | null;
  performance: { id: string; name: string; slug: string; color: string } | null;
};

export default function EvalRunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string) || "";

  const [run, setRun] = useState<Run | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/admin/eval-runs/${id}`, { cache: "no-store" });
    const j = await r.json();
    if (r.ok) {
      setRun(j.run);
      setScores(j.scores);
    }
    setLoading(false);
  }, [id]);
  useEffect(() => {
    if (id) load();
  }, [id, load]);

  // Live polling while pending/running
  useEffect(() => {
    if (!run) return;
    if (run.status !== "pending" && run.status !== "running") return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [run, load]);

  async function publish(next: boolean) {
    const r = await fetch(`/api/admin/eval-runs/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: next }),
    });
    if (r.ok) {
      push(next ? "published" : "unpublished", "success");
      load();
    } else {
      push("publish failed", "error");
    }
    setConfirmingPublish(false);
  }

  async function cancel() {
    const r = await fetch(`/api/admin/eval-runs/${id}/cancel`, {
      method: "POST",
    });
    if (r.ok) {
      push("cancelled", "success");
      load();
    } else {
      push("cancel failed", "error");
    }
    setConfirmingCancel(false);
  }

  async function rerun() {
    const r = await fetch(`/api/admin/eval-runs/${id}/rerun`, {
      method: "POST",
    });
    const j = await r.json();
    if (r.ok && j.id) {
      router.push(`/admin/eval-runs/${j.id}`);
    } else {
      push("rerun failed", "error");
    }
  }

  if (loading || !run) {
    return (
      <p style={{ fontFamily: FONT_MONO, color: "var(--text-secondary)" }}>
        loading...
      </p>
    );
  }

  const positionDisagreements = scores.filter(
    (s) => s.position_swap_agreement === false,
  ).length;
  const positionBias =
    scores.length > 0 && positionDisagreements / scores.length > 0.3;

  return (
    <div>
      <Link href="/admin/eval-runs" style={backLinkStyle}>
        ← eval runs
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
        <div>
          <h1
            style={{
              fontFamily: '"Diatype Variable", sans-serif',
              fontSize: "2rem",
              fontWeight: 700,
              margin: 0,
            }}
          >
            {run.candidate_model?.name || "?"}
          </h1>
          <p
            style={{
              fontFamily: FONT_MONO,
              fontSize: "1rem",
              color: "var(--text-secondary)",
              margin: "0.25rem 0 0 0",
            }}
          >
            on {run.performance?.name || "?"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {run.status === "running" || run.status === "pending" ? (
            <button
              onClick={() => setConfirmingCancel(true)}
              style={btnSmallStyle}
            >
              cancel
            </button>
          ) : null}
          <button onClick={rerun} style={btnSmallStyle}>
            rerun
          </button>
          {run.status === "completed" ? (
            <button
              onClick={() => setConfirmingPublish(true)}
              style={{
                ...btnSmallStyle,
                background: run.published
                  ? "transparent"
                  : run.candidate_model?.color || "#171717",
                color: run.published ? "var(--text-primary)" : "#fff",
                borderColor: run.candidate_model?.color || "#171717",
              }}
            >
              {run.published ? "unpublish" : "publish"}
            </button>
          ) : null}
        </div>
      </div>

      {/* Stat row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <Stat
          label="status"
          value={<span style={statusPillStyle(run.status)}>{run.status}</span>}
        />
        <Stat
          label="win rate"
          value={
            run.win_rate !== null
              ? `${(Number(run.win_rate) * 100).toFixed(0)}%`
              : "-"
          }
        />
        <Stat
          label="themes"
          value={`${run.n_themes_completed}/${run.n_themes}`}
        />
        <Stat label="judge" value={run.judge_model} small />
        <Stat
          label="cost"
          value={
            run.cost_usd !== null ? `$${Number(run.cost_usd).toFixed(2)}` : "-"
          }
        />
        <Stat
          label="started"
          value={run.started_at ? formatDate(run.started_at) : "-"}
        />
        <Stat
          label="finished"
          value={run.finished_at ? formatDate(run.finished_at) : "-"}
        />
      </div>

      {run.status === "failed" && run.error_message ? (
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
          {run.error_message}
        </div>
      ) : null}

      {positionBias ? (
        <div
          style={{
            background: "#fff3e0",
            border: "1px solid #d97706",
            padding: "0.75rem 1rem",
            marginBottom: "1.5rem",
            fontFamily: FONT_MONO,
            fontSize: "0.85rem",
            color: "#92400e",
          }}
        >
          judge appears position-biased - interpret win rate cautiously.{" "}
          {positionDisagreements} of {scores.length} themes disagreed under A/B
          swap.
        </div>
      ) : null}

      {/* Per-theme rows */}
      {scores.length === 0 ? (
        <p
          style={{
            fontFamily: FONT_MONO,
            color: "var(--text-secondary)",
          }}
        >
          {run.status === "pending"
            ? "queued..."
            : run.status === "running"
              ? "running..."
              : "no scores yet"}
        </p>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}
        >
          {scores.map((s) => (
            <ThemeRow
              key={s.id}
              score={s}
              accent={run.candidate_model?.color || "#171717"}
            />
          ))}
        </div>
      )}

      {confirmingPublish ? (
        <ConfirmModal
          title={run.published ? "unpublish this run?" : "publish this run?"}
          body={
            run.published
              ? "the data point disappears from the public chart within 60 seconds."
              : "the public chart will update within 60 seconds."
          }
          confirmLabel={run.published ? "unpublish" : "publish"}
          accentColor={run.candidate_model?.color || "#171717"}
          onCancel={() => setConfirmingPublish(false)}
          onConfirm={() => publish(!run.published)}
        />
      ) : null}
      {confirmingCancel ? (
        <ConfirmModal
          title="cancel this run?"
          body="partial scores keep, the runner stops between themes."
          confirmLabel="cancel run"
          destructive
          onCancel={() => setConfirmingCancel(false)}
          onConfirm={cancel}
        />
      ) : null}
      <Toaster toasts={toasts} dismiss={dismiss} />
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

function ThemeRow({ score, accent }: { score: Score; accent: string }) {
  const [showRationale, setShowRationale] = useState(false);
  return (
    <div
      style={{
        borderTop: "1px solid var(--border-light)",
        paddingTop: "1.25rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "0.75rem",
          marginBottom: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <h3
          style={{
            fontFamily: '"Diatype Variable", sans-serif',
            fontSize: "1.1rem",
            fontWeight: 700,
            margin: 0,
          }}
        >
          {score.theme_slug}
        </h3>
        {score.candidate_rank !== null ? (
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: "0.75rem",
              color:
                score.position_swap_agreement === false
                  ? "#92400e"
                  : "var(--text-tertiary)",
            }}
          >
            rank {score.candidate_rank}
          </span>
        ) : null}
        {score.confidence ? (
          <span style={{ ...statusPillStyle("draft") }}>
            {score.confidence}
          </span>
        ) : null}
        <span style={{ marginLeft: "auto" }}>
          {score.candidate_won ? (
            <span style={statusPillStyle("trained")}>candidate won</span>
          ) : (
            <span style={statusPillStyle("draft")}>candidate lost</span>
          )}
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.25rem",
        }}
      >
        <PoemBlock
          label={`audience winner${score.audience_winner_type ? ` (${score.audience_winner_type})` : ""}`}
          text={score.audience_winner_text}
        />
        <PoemBlock
          label={`audience loser${score.audience_loser_type ? ` (${score.audience_loser_type})` : ""}`}
          text={score.audience_loser_text}
        />
        <PoemBlock
          label="candidate"
          text={score.candidate_text}
          accent={score.candidate_won ? accent : undefined}
        />
      </div>
      {score.judge_rationale ? (
        <div style={{ marginTop: "0.75rem" }}>
          <button
            onClick={() => setShowRationale((v) => !v)}
            style={{
              fontFamily: FONT_MONO,
              fontSize: "0.8rem",
              background: "transparent",
              border: "none",
              padding: 0,
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            {showRationale ? "- rationale" : "+ rationale"}
          </button>
          {showRationale ? (
            <p
              style={{
                fontFamily: '"Standard", sans-serif',
                fontStyle: "italic",
                fontSize: "0.95rem",
                color: "var(--text-secondary)",
                lineHeight: 1.7,
                marginTop: "0.5rem",
              }}
            >
              {score.judge_rationale}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PoemBlock({
  label,
  text,
  accent,
}: {
  label: string;
  text: string | null;
  accent?: string;
}) {
  return (
    <div
      style={{
        borderLeft: accent
          ? `2px solid ${accent}`
          : "2px solid rgba(0,0,0,0.12)",
        paddingLeft: "0.75rem",
      }}
    >
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--text-tertiary)",
          marginBottom: "0.5rem",
        }}
      >
        {label}
      </div>
      <p
        style={{
          fontFamily: '"Standard", sans-serif',
          fontSize: "0.95rem",
          lineHeight: 1.7,
          margin: 0,
          whiteSpace: "pre-line",
        }}
      >
        {text || "(missing)"}
      </p>
    </div>
  );
}
