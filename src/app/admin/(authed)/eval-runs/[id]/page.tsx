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
import { useParams, useRouter } from "next/navigation";
import { formatDate } from "@/lib/admin-format";
import Win from "@/components/desktop/Win";
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
    const r = await fetch(`/singulars/api/admin/eval-runs/${id}`, { cache: "no-store" });
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
    const r = await fetch(`/singulars/api/admin/eval-runs/${id}/publish`, {
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
    const r = await fetch(`/singulars/api/admin/eval-runs/${id}/cancel`, {
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
    const r = await fetch(`/singulars/api/admin/eval-runs/${id}/rerun`, {
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
      <Win file="eval-run.txt" span="w--eight">
        <p className="note" style={{ marginTop: 0 }}>
          Loading.
        </p>
      </Win>
    );
  }

  const positionDisagreements = scores.filter(
    (s) => s.position_swap_agreement === false,
  ).length;
  const positionBias =
    scores.length > 0 && positionDisagreements / scores.length > 0.3;
  const accent = run.candidate_model?.color || "var(--acc)";

  return (
    <>
      <Win
        file="eval-run.txt"
        span="w--eight"
        meta={run.published ? "published" : "draft"}
      >
        <p className="k">
          <i className="cdot" style={{ ["--c" as string]: accent }} /> eval run
        </p>
        <h1 className="h2">
          {run.candidate_model?.name || "?"} on {run.performance?.name || "?"}
        </h1>
        <div className="sg-row" style={{ marginTop: "0.8rem" }}>
          {run.status === "running" || run.status === "pending" ? (
            <button
              type="button"
              className="btn"
              onClick={() => setConfirmingCancel(true)}
            >
              cancel
            </button>
          ) : null}
          <button type="button" className="btn" onClick={rerun}>
            rerun
          </button>
          {run.status === "completed" ? (
            <button
              type="button"
              className={run.published ? "btn" : "btn btn--send"}
              aria-pressed={run.published}
              onClick={() => setConfirmingPublish(true)}
            >
              {run.published ? "unpublish" : "publish"}
            </button>
          ) : null}
        </div>

        <div className="rule" />

        <div className="sg-tiles">
          <Stat
            label="status"
            value={
              <span className="sg-pill" data-state={run.status}>
                {run.status}
              </span>
            }
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
          <Stat label="judge" value={run.judge_model} />
          <Stat
            label="cost"
            value={
              run.cost_usd !== null
                ? `$${Number(run.cost_usd).toFixed(2)}`
                : "-"
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
          <p className="sg-err">{run.error_message}</p>
        ) : null}

        {positionBias ? (
          <p className="note">
            The judge looks position-biased, so read the win rate carefully.{" "}
            {positionDisagreements} of {scores.length} themes disagreed under
            the A/B swap.
          </p>
        ) : null}
      </Win>

      <Win
        file="themes/"
        span="w--eight"
        meta={`${scores.length} scored`}
      >
        {scores.length === 0 ? (
          <p className="note" style={{ marginTop: 0 }}>
            {run.status === "pending"
              ? "Queued."
              : run.status === "running"
                ? "Running."
                : "No scores yet."}
          </p>
        ) : (
          scores.map((s) => <ThemeRow key={s.id} score={s} accent={accent} />)
        )}
      </Win>

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
    </>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="sg-tile">
      <div className="sg-tile__v" style={{ fontSize: "1rem" }}>
        {value}
      </div>
      <span className="k sg-tile__k">{label}</span>
    </div>
  );
}

/** One theme in the run: the three poems, the verdict, the rationale. */
function ThemeRow({ score, accent }: { score: Score; accent: string }) {
  const [showRationale, setShowRationale] = useState(false);
  return (
    <details className="file">
      <summary>
        <span className="fr__n">
          <i className="tri" aria-hidden="true" />
          {score.theme_slug}
        </span>
        <span className="fr__s">
          <span
            className="sg-pill"
            data-state={score.candidate_won ? "trained" : "draft"}
          >
            {score.candidate_won ? "candidate won" : "candidate lost"}
          </span>
        </span>
        <span className="fr__w">
          {score.candidate_rank !== null ? `rank ${score.candidate_rank}` : ""}
          {score.confidence ? ` · ${score.confidence}` : ""}
          {score.position_swap_agreement === false
            ? " · position swap disagreed"
            : ""}
        </span>
        <span className="fr__d">open</span>
      </summary>
      <div className="fr__b">
        <div className="sg-cards" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))" }}>
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
              type="button"
              className="btn"
              aria-expanded={showRationale}
              onClick={() => setShowRationale((v) => !v)}
            >
              {showRationale ? "hide rationale" : "show rationale"}
            </button>
            {showRationale ? (
              <p className="note" style={{ fontStyle: "italic" }}>
                {score.judge_rationale}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </details>
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
        borderLeft: `2px solid ${accent || "var(--hair)"}`,
        paddingLeft: "0.75rem",
        minWidth: 0,
      }}
    >
      <span className="k">{label}</span>
      <p className="sg-poem__t" style={{ marginTop: "0.4rem" }}>
        {text || "(missing)"}
      </p>
    </div>
  );
}
