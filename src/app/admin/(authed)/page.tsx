/**
 * /admin dashboard (US-102, US-120, US-125).
 *
 * Server component: fetches counts + cost summary directly from Supabase via
 * the service-role client. Renders quickly with no client JS for the
 * read-only data; cost stat cards are interactive (Link) so they navigate.
 *
 * Phase 1 surface: counts + nav into the rest of the panel + a "no eval runs
 * yet" empty-state card. US-120/US-125 will fill in cost cards once eval and
 * fine-tune tables exist (post-migration).
 */

import Link from "next/link";
import { getServiceClient } from "@/lib/supabase";
import {
  FONT_MONO,
  sectionHeadingStyle,
  statCardStyle,
  statValueStyle,
  statLabelStyle,
} from "@/lib/admin-styles";

export const dynamic = "force-dynamic";

type Counts = {
  performances: number;
  themes: number;
  poems: number;
  poemsByHuman: number;
  poemsByMachine: number;
  votes: number; // audience votes (sum of poems.vote_count, includes paper ballots)
  votesOnline: number; // online-only votes (rows in singulars.votes)
  evalRuns: number | null; // null until US-100 migration applied
  fineTuneJobs: number | null;
  candidateModels: number | null;
};

type Costs = {
  evalMonth: number;
  evalYear: number;
  evalLatest: number | null;
  finetuneMonth: number;
  finetuneYear: number;
  finetuneLatest: number | null;
};

const TYPICAL_MONTH_USD = 5; // §10 cost summary baseline

async function fetchCosts(): Promise<Costs> {
  const supabase = getServiceClient();
  const empty: Costs = {
    evalMonth: 0,
    evalYear: 0,
    evalLatest: null,
    finetuneMonth: 0,
    finetuneYear: 0,
    finetuneLatest: null,
  };
  if (!supabase) return empty;

  const startMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString();
  const startYear = new Date(new Date().getFullYear(), 0, 1).toISOString();

  async function sumAndLatest(
    table: string,
  ): Promise<{ month: number; year: number; latest: number | null }> {
    const { data, error } = await supabase!
      .from(table)
      .select("cost_usd, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return { month: 0, year: 0, latest: null };
    type Row = { cost_usd: number | null; created_at: string };
    let month = 0;
    let year = 0;
    let latest: number | null = null;
    for (const r of (data || []) as Row[]) {
      const cost = Number(r.cost_usd) || 0;
      if (latest === null && cost > 0) latest = cost;
      if (r.created_at >= startYear) year += cost;
      if (r.created_at >= startMonth) month += cost;
    }
    return { month, year, latest };
  }

  const evalSummary = await sumAndLatest("eval_runs");
  const finetuneSummary = await sumAndLatest("fine_tune_jobs");

  return {
    evalMonth: evalSummary.month,
    evalYear: evalSummary.year,
    evalLatest: evalSummary.latest,
    finetuneMonth: finetuneSummary.month,
    finetuneYear: finetuneSummary.year,
    finetuneLatest: finetuneSummary.latest,
  };
}

function fmtUsd(n: number | null): string {
  if (n === null) return "-";
  return `$${n.toFixed(2)}`;
}

async function fetchCounts(): Promise<Counts> {
  const supabase = getServiceClient();
  if (!supabase) {
    return {
      performances: 0,
      themes: 0,
      poems: 0,
      poemsByHuman: 0,
      poemsByMachine: 0,
      votes: 0,
      votesOnline: 0,
      evalRuns: null,
      fineTuneJobs: null,
      candidateModels: null,
    };
  }

  // Helper that swallows "table does not exist" errors so this page renders
  // before US-100 migration lands.
  async function safeCount(table: string): Promise<number | null> {
    const { count, error } = await supabase!
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) return null;
    return count ?? 0;
  }

  async function safeCountFiltered(
    table: string,
    column: string,
    value: string,
  ): Promise<number | null> {
    const { count, error } = await supabase!
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(column, value);
    if (error) return null;
    return count ?? 0;
  }

  // Audience-vote tally: sum poems.vote_count across all poems. This is the
  // canonical number Halim writes / asks about because it includes paper
  // ballots from live shows merged in via apply_vote_override. The raw
  // singulars.votes row count is online-only and misses ~90% of live show
  // votes (which were on paper).
  async function sumVoteCount(): Promise<number> {
    const { data, error } = await supabase!
      .from("poems")
      .select("vote_count");
    if (error) return 0;
    return ((data || []) as { vote_count: number | null }[]).reduce(
      (s, r) => s + (Number(r.vote_count) || 0),
      0,
    );
  }

  const [
    performances,
    themes,
    poems,
    poemsByHuman,
    poemsByMachine,
    votesOnlineCount,
    votesAudience,
    evalRuns,
    fineTuneJobs,
    candidateModels,
  ] = await Promise.all([
    safeCount("performances"),
    safeCount("themes"),
    safeCount("poems"),
    safeCountFiltered("poems", "author_type", "human"),
    safeCountFiltered("poems", "author_type", "machine"),
    safeCount("votes"),
    sumVoteCount(),
    safeCount("eval_runs"),
    safeCount("fine_tune_jobs"),
    safeCount("candidate_models"),
  ]);

  return {
    performances: performances ?? 0,
    themes: themes ?? 0,
    poems: poems ?? 0,
    poemsByHuman: poemsByHuman ?? 0,
    poemsByMachine: poemsByMachine ?? 0,
    votes: votesAudience,
    votesOnline: votesOnlineCount ?? 0,
    evalRuns,
    fineTuneJobs,
    candidateModels,
  };
}

function StatCard({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: string | number | null;
  href?: string;
  hint?: string;
}) {
  const inner = (
    <div style={{ ...statCardStyle, height: "100%" }}>
      <div style={statValueStyle}>
        {value === null ? <span style={{ opacity: 0.4 }}>-</span> : value}
      </div>
      <div style={statLabelStyle}>{label}</div>
      {hint ? (
        <div
          style={{
            ...statLabelStyle,
            marginTop: "0.5rem",
            textTransform: "none",
            letterSpacing: 0,
            color: "var(--text-secondary)",
            fontSize: "0.75rem",
          }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
  if (href) {
    return (
      <Link
        href={href}
        style={{ textDecoration: "none", color: "inherit", display: "block" }}
      >
        {inner}
      </Link>
    );
  }
  return inner;
}

async function fetchLivePerfSlug(): Promise<string | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("performances")
    .select("slug")
    .eq("status", "training")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { slug?: string } | null)?.slug ?? null;
}

export default async function AdminDashboardPage() {
  const [counts, costs, liveSlug] = await Promise.all([
    fetchCounts(),
    fetchCosts(),
    fetchLivePerfSlug(),
  ]);
  const migrationApplied = counts.evalRuns !== null;
  const combinedMonth = costs.evalMonth + costs.finetuneMonth;
  const monthOverBudget = combinedMonth > TYPICAL_MONTH_USD * 2;

  return (
    <div>
      <h1
        style={{
          fontFamily: '"Terminal Grotesque", sans-serif',
          fontSize: "4rem",
          lineHeight: 0.9,
          fontWeight: 400,
          margin: "0 0 0.5rem 0",
        }}
      >
        admin
      </h1>
      <p
        style={{
          fontFamily: FONT_MONO,
          fontSize: "0.95rem",
          color: "var(--text-secondary)",
          margin: "0 0 2.5rem 0",
        }}
      >
        post-show ritual: enter votes, flip status, run eval, publish.
      </p>

      <h2 style={{ ...sectionHeadingStyle, marginBottom: "1rem" }}>data</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "1rem",
          marginBottom: "2.5rem",
        }}
      >
        <StatCard
          label="performances"
          value={counts.performances}
          href="/admin/performances"
        />
        <StatCard
          label="themes"
          value={counts.themes}
          href="/admin/themes"
        />
        <StatCard
          label="poems"
          value={counts.poems}
          hint={`${counts.poemsByHuman} halim · ${counts.poemsByMachine} machine`}
        />
        <StatCard
          label="audience votes"
          value={counts.votes}
          hint={`${counts.votesOnline} online · ${counts.votes - counts.votesOnline} paper ballots`}
        />
      </div>

      <h2 style={{ ...sectionHeadingStyle, marginBottom: "1rem" }}>
        live stage
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
          marginBottom: "2.5rem",
        }}
      >
        {liveSlug ? (
          <>
            <a
              href={`/${liveSlug}/control`}
              style={{ ...statCardStyle, textDecoration: "none", color: "inherit", display: "block" }}
            >
              <div style={statValueStyle}>control →</div>
              <div style={statLabelStyle}>{liveSlug} · operator</div>
            </a>
            <a
              href={`/${liveSlug}/stage`}
              target="_blank"
              rel="noreferrer"
              style={{ ...statCardStyle, textDecoration: "none", color: "inherit", display: "block" }}
            >
              <div style={statValueStyle}>stage ↗</div>
              <div style={statLabelStyle}>{liveSlug} · venue screen</div>
            </a>
          </>
        ) : (
          <div
            style={{
              ...statCardStyle,
              fontFamily: FONT_MONO,
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
            }}
          >
            no performance is in &lsquo;training&rsquo; right now. flip one to
            training to drive its stage.
          </div>
        )}
      </div>

      <h2 style={{ ...sectionHeadingStyle, marginBottom: "1rem" }}>
        eval pipeline
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <StatCard
          label="candidate models"
          value={counts.candidateModels}
          href={migrationApplied ? "/admin/models" : undefined}
        />
        <StatCard
          label="eval runs"
          value={counts.evalRuns}
          href={migrationApplied ? "/admin/eval-runs" : undefined}
        />
        <StatCard
          label="fine-tune jobs"
          value={counts.fineTuneJobs}
          href={counts.fineTuneJobs !== null ? "/admin/fine-tunes" : undefined}
        />
      </div>

      {/* Cost cards (US-120, US-125) */}
      {migrationApplied ? (
        <>
          <h2 style={{ ...sectionHeadingStyle, marginBottom: "1rem" }}>
            spend
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "1rem",
              marginBottom: "0.75rem",
            }}
          >
            <StatCard
              label="eval - this month"
              value={fmtUsd(costs.evalMonth)}
              hint={`year ${fmtUsd(costs.evalYear)} · latest ${fmtUsd(costs.evalLatest)}`}
              href="/admin/eval-runs"
            />
            <StatCard
              label="fine-tune - this month"
              value={fmtUsd(costs.finetuneMonth)}
              hint={`year ${fmtUsd(costs.finetuneYear)} · latest ${fmtUsd(costs.finetuneLatest)}`}
              href={
                counts.fineTuneJobs !== null ? "/admin/fine-tunes" : undefined
              }
            />
          </div>
          <p
            style={{
              fontFamily: FONT_MONO,
              fontSize: "0.85rem",
              color: monthOverBudget ? "#92400e" : "var(--text-secondary)",
              border: monthOverBudget ? "1px solid #d97706" : "none",
              padding: monthOverBudget ? "0.5rem 0.75rem" : 0,
              marginTop: 0,
              marginBottom: "2.5rem",
            }}
          >
            combined month-to-date: {fmtUsd(combinedMonth)}
            {monthOverBudget
              ? ` · 2x typical (~${fmtUsd(TYPICAL_MONTH_USD)}/month). check eval-runs and fine-tunes.`
              : ""}
          </p>
        </>
      ) : null}

      {!migrationApplied ? (
        <div
          style={{
            border: "1px solid var(--border-light)",
            padding: "1rem 1.25rem",
            fontFamily: FONT_MONO,
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
            marginBottom: "2.5rem",
          }}
        >
          eval pipeline migration not yet applied. run{" "}
          <code style={{ color: "var(--text-primary)" }}>
            planning/research/06-migration-evals.sql
          </code>{" "}
          via the supabase mcp or psql.
        </div>
      ) : counts.evalRuns === 0 ? (
        <div
          style={{
            border: "1px solid var(--border-light)",
            padding: "1rem 1.25rem",
            fontFamily: FONT_MONO,
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
            marginBottom: "2.5rem",
          }}
        >
          no eval runs yet.{" "}
          <Link
            href="/admin/eval-runs/new"
            style={{ color: "var(--text-primary)" }}
          >
            start one →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
