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
import Win from "@/components/desktop/Win";


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

/** One count, as a tile. Links where there is somewhere to go. */
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
    <>
      <div className="sg-tile__v">{value === null ? "-" : value}</div>
      <span className="k sg-tile__k">{label}</span>
      {hint ? <span className="sg-tile__n">{hint}</span> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="sg-tile">
        {inner}
      </Link>
    );
  }
  return <div className="sg-tile">{inner}</div>;
}

export default async function AdminDashboardPage() {
  const [counts, costs] = await Promise.all([fetchCounts(), fetchCosts()]);
  const migrationApplied = counts.evalRuns !== null;
  const combinedMonth = costs.evalMonth + costs.finetuneMonth;
  const monthOverBudget = combinedMonth > TYPICAL_MONTH_USD * 2;

  return (
    <>
      <Win file="dashboard.txt" span="w--eight">
        <p className="k">singulars &middot; admin</p>
        <h1 className="disp">dashboard</h1>
        <p className="sub">
          Post-show ritual: enter votes, flip status, run eval, publish.
        </p>
      </Win>

      <Win file="data/" span="w--seven" meta="the archive">
        <div className="sg-tiles">
          <StatCard
            label="performances"
            value={counts.performances}
            href="/admin/performances"
          />
          <StatCard label="themes" value={counts.themes} href="/admin/themes" />
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
      </Win>

      <Win file="pipeline/" span="w--five" meta="eval">
        <div className="sg-tiles">
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

        {!migrationApplied ? (
          <p className="note">
            The eval pipeline migration is not applied yet. Run{" "}
            <code>planning/research/06-migration-evals.sql</code> via the
            supabase mcp or psql.
          </p>
        ) : counts.evalRuns === 0 ? (
          <p className="note">
            No eval runs yet.{" "}
            <Link href="/admin/eval-runs/new">start one &rarr;</Link>
          </p>
        ) : null}
      </Win>

      {migrationApplied ? (
        <Win
          file="spend/"
          span="w--eight"
          meta={`month to date ${fmtUsd(combinedMonth)}`}
        >
          <div className="sg-tiles">
            <StatCard
              label="eval, this month"
              value={fmtUsd(costs.evalMonth)}
              hint={`year ${fmtUsd(costs.evalYear)} · latest ${fmtUsd(costs.evalLatest)}`}
              href="/admin/eval-runs"
            />
            <StatCard
              label="fine-tune, this month"
              value={fmtUsd(costs.finetuneMonth)}
              hint={`year ${fmtUsd(costs.finetuneYear)} · latest ${fmtUsd(costs.finetuneLatest)}`}
              href={
                counts.fineTuneJobs !== null ? "/admin/fine-tunes" : undefined
              }
            />
          </div>
          <p className={monthOverBudget ? "sg-err" : "note"}>
            Combined month to date: {fmtUsd(combinedMonth)}
            {monthOverBudget
              ? `. Twice the typical ${fmtUsd(TYPICAL_MONTH_USD)} a month. Check eval runs and fine-tunes.`
              : ""}
          </p>
        </Win>
      ) : null}
    </>
  );
}
