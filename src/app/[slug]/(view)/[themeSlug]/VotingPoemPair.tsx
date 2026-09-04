"use client";

/**
 * One theme, two poems, one vote.
 *
 * The reskin touched markup only. The fingerprint, the three fetch calls
 * (/singulars/api/check-votes, /singulars/api/vote, /singulars/api/vote/undo),
 * the select-then-submit two-step, the preview behaviour on a closed duel and
 * the rule that the per-poem split stays hidden until the visitor has acted are
 * all exactly as they were.
 *
 * Two links that were written as plain anchors with a root-relative href are
 * now next/link. Under basePath "/singulars" a root-relative href on a plain
 * anchor is a real browser URL and lands on www.halimmadi.com, which 404s.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getFingerprint } from "@/lib/fingerprint";

interface Poem {
  id: string;
  performance_id: string;
  theme: string;
  theme_slug: string;
  text: string;
  author_name: string;
  author_type: "human" | "machine";
  vote_count: number;
  created_at: string;
}

interface VoteResult {
  success: boolean;
  duplicate: boolean;
  status: string;
  message: string;
  vote_counts: Record<string, number>;
  voted_poem_id: string | null;
}

interface VotingPoemPairProps {
  poems: Poem[];
  performanceColor: string;
  performanceStatus: "upcoming" | "training" | "trained";
  /** Where "read more about the piece" points: an on-page #about anchor when
   *  the perf has a description, else the performance page. */
  aboutHref: string;
  /** The currently-live (training) performance slug, for the "vote on the
   *  live one" note shown on closed/trained performances. */
  livePerfSlug?: string | null;
}

export default function VotingPoemPair({
  poems,
  performanceColor,
  performanceStatus,
  aboutHref,
  livePerfSlug,
}: VotingPoemPairProps) {
  const [hasVoted, setHasVoted] = useState(false);
  const [votedPoemId, setVotedPoemId] = useState<string | null>(null);
  const [selectedPoemId, setSelectedPoemId] = useState<string | null>(null);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [isVoting, setIsVoting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize vote counts from props
  useEffect(() => {
    const counts: Record<string, number> = {};
    poems.forEach((p) => {
      counts[p.id] = p.vote_count;
    });
    setVoteCounts(counts);
  }, [poems]);

  // Check for existing votes on mount
  useEffect(() => {
    async function checkExistingVotes() {
      try {
        const fp = await getFingerprint();
        const poemIds = poems.map((p) => p.id).join(",");
        const res = await fetch(
          `/singulars/api/check-votes?fingerprint=${fp}&poem_ids=${poemIds}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data.voted_poem_id) {
            setHasVoted(true);
            setVotedPoemId(data.voted_poem_id);
            if (data.vote_counts) {
              setVoteCounts(data.vote_counts);
            }
          }
        }
      } catch {
        // silently fail - user can still vote
      }
    }
    if (performanceStatus === "training") {
      checkExistingVotes();
    }
  }, [poems, performanceStatus]);

  // Step 1: tap a poem to SELECT it (a frame appears + a submit button). Tap
  // again to deselect. No vote is cast until "submit".
  const handleSelect = useCallback(
    (poemId: string) => {
      if (hasVoted || isVoting) return;
      setSelectedPoemId((prev) => (prev === poemId ? null : poemId));
      setErrorMsg(null);
    },
    [hasVoted, isVoting],
  );

  // Step 2: submit the selected poem.
  const handleSubmit = useCallback(async () => {
    const poemId = selectedPoemId;
    if (!poemId || hasVoted || isVoting) return;

    // Trained performance: voting is closed, so this is a PREVIEW only -
    // reveal the split locally, persist nothing. The note below points to
    // the live duel.
    if (performanceStatus === "trained") {
      setHasVoted(true);
      setVotedPoemId(poemId);
      return;
    }

    if (performanceStatus !== "training") return;

    setIsVoting(true);
    setErrorMsg(null);

    try {
      const fp = await getFingerprint();
      const res = await fetch("/singulars/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poem_id: poemId, fingerprint: fp }),
      });

      const data: VoteResult = await res.json();

      if (data.vote_counts) {
        setVoteCounts(data.vote_counts);
      }

      if (data.success || data.duplicate) {
        setHasVoted(true);
        setVotedPoemId(data.voted_poem_id);
      } else if (!data.success && !data.duplicate) {
        setErrorMsg(data.message || "Could not register vote");
      }
    } catch {
      setErrorMsg("Network error. Try again.");
    } finally {
      setIsVoting(false);
    }
  }, [selectedPoemId, hasVoted, isVoting, performanceStatus]);

  const handleUndo = useCallback(async () => {
    if (!votedPoemId || isVoting || performanceStatus !== "training") return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Undo your vote? You'll be able to vote again on this pair.",
      );
      if (!ok) return;
    }
    setIsVoting(true);
    setErrorMsg(null);
    try {
      const fp = await getFingerprint();
      const res = await fetch("/singulars/api/vote/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poem_id: votedPoemId, fingerprint: fp }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.vote_counts) setVoteCounts(data.vote_counts);
        setHasVoted(false);
        setVotedPoemId(null);
        setSelectedPoemId(null);
      } else {
        setErrorMsg(data.error || "Could not undo vote");
      }
    } catch {
      setErrorMsg("Network error. Try again.");
    } finally {
      setIsVoting(false);
    }
  }, [votedPoemId, isVoting, performanceStatus]);

  const isTrained = performanceStatus === "trained";
  // Clickable for a real vote (training) or a preview (trained), until acted.
  const canVote =
    (performanceStatus === "training" || isTrained) && !hasVoted && !isVoting;
  // The per-poem split is revealed only after the visitor acts.
  const showResults = hasVoted;
  const combinedTotal = poems.reduce(
    (s, p) => s + (voteCounts[p.id] ?? p.vote_count ?? 0),
    0,
  );

  return (
    <div>
      {/* One line before voting: the combined pair total and what to do.
          Never the per-poem split, so it cannot anchor voters. */}
      {!showResults && (
        <p className="sg-meta" style={{ marginTop: 0, marginBottom: "0.9rem" }}>
          <span>
            {combinedTotal} {combinedTotal === 1 ? "vote" : "votes"} on this pair
          </span>
          <span>
            {isTrained
              ? "tap a poem to see who the room voted for. this duel is closed."
              : "pick the poem you prefer, then submit your vote."}
          </span>
        </p>
      )}

      <div className="sg-duel">
        {poems.map((poem) => {
          const isVotedPoem = votedPoemId === poem.id;
          const isSelected = selectedPoemId === poem.id;
          const framed = isVotedPoem || isSelected;
          const count = voteCounts[poem.id] ?? poem.vote_count;

          return (
            <div
              key={poem.id}
              className={`sg-poem${framed ? " is-chosen" : ""}`}
              data-poem-id={poem.id}
              data-voteable={canVote ? "true" : undefined}
              onClick={() => canVote && handleSelect(poem.id)}
              role={canVote ? "button" : undefined}
              aria-label={canVote ? "select this poem" : undefined}
              aria-pressed={canVote ? isSelected : undefined}
              aria-disabled={canVote ? undefined : "true"}
              tabIndex={canVote ? 0 : undefined}
              onKeyDown={(e) => {
                if (canVote && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  handleSelect(poem.id);
                }
              }}
            >
              <p className="sg-poem__t">{poem.text}</p>

              {canVote && (
                <span className="sg-poem__pick">
                  {isSelected
                    ? "chosen"
                    : isTrained
                      ? "pick this one"
                      : "vote for this one"}
                </span>
              )}

              {/* Vote results - only after the visitor has acted. Hidden
                  pre-vote so the running tally cannot anchor the next
                  voter's choice. */}
              {showResults && (
                <div
                  className="sg-poem__f"
                  aria-live="polite"
                  aria-label={`${count} ${count === 1 ? "vote" : "votes"}${isVotedPoem ? ", your vote" : ""}`}
                >
                  <span className="k">
                    {count} {count === 1 ? "vote" : "votes"}
                  </span>
                  {isVotedPoem && (
                    <span className="k" style={{ color: "var(--acc)" }}>
                      your vote
                    </span>
                  )}
                  <span
                    className="sg-dots"
                    aria-hidden="true"
                    style={{ marginLeft: "auto" }}
                  >
                    {Array.from({ length: Math.min(count, 50) }).map((_, i) => (
                      <i
                        key={i}
                        style={{
                          background: performanceColor,
                          width: isVotedPoem && i === count - 1 ? 9 : 6,
                          height: isVotedPoem && i === count - 1 ? 9 : 6,
                        }}
                      />
                    ))}
                    {count > 50 && (
                      <span className="k" style={{ marginLeft: 4 }}>
                        +{count - 50} more
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit - appears once a poem is selected (step 2). */}
      {canVote && selectedPoemId && (
        <div className="sg-row sg-row--end" style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="btn btn--send"
            onClick={handleSubmit}
            disabled={isVoting}
          >
            {isVoting ? "submitting" : isTrained ? "see who won" : "submit my vote"}
          </button>
        </div>
      )}

      {isVoting && (
        <p className="k" aria-live="assertive" role="status" style={{ marginTop: "0.9rem" }}>
          registering your vote
        </p>
      )}

      {errorMsg && (
        <p className="sg-err" aria-live="assertive" role="alert">
          {errorMsg}
        </p>
      )}

      {hasVoted && performanceStatus === "training" && (
        <div className="sg-row" style={{ marginTop: "0.9rem" }}>
          <span className="k" aria-live="polite" role="status">
            vote recorded
          </span>
          <button
            type="button"
            className="btn"
            onClick={handleUndo}
            disabled={isVoting}
          >
            {isVoting ? "undoing" : "undo my vote"}
          </button>
        </div>
      )}

      {/* Trained / closed performance: the preview vote is not recorded.
          Point people at the live duel. */}
      {hasVoted && isTrained && (
        <div className="sg-row" style={{ marginTop: "0.9rem" }}>
          <span className="k">
            this duel is closed. your vote here is not recorded.
          </span>
          <Link className="btn" href={livePerfSlug ? `/${livePerfSlug}` : "/"}>
            vote on the live duel &rarr;
          </Link>
        </div>
      )}

      {/* After voting (or once results are final), invite the next step. */}
      {showResults && <PostVoteInvites aboutHref={aboutHref} />}
    </div>
  );
}

function PostVoteInvites({ aboutHref }: { aboutHref: string }) {
  return (
    <div style={{ marginTop: "1.6rem" }}>
      <div className="rule" />
      <p className="k">before you go</p>
      <div className="sg-row" style={{ marginTop: "0.6rem" }}>
        <Link className="btn" href="/theme-voting">
          suggest the next theme &rarr;
        </Link>
        {/* An "#about" anchor is same-page; anything else is a route, and a
            route href must go through next/link so basePath is applied. */}
        {aboutHref.startsWith("#") ? (
          <a className="btn" href={aboutHref}>
            read more about the piece &rarr;
          </a>
        ) : (
          <Link className="btn" href={aboutHref}>
            read more about the piece &rarr;
          </Link>
        )}
      </div>
      <p className="note" style={{ marginTop: "0.6rem" }}>
        Help choose what the poet and machine write on next.
      </p>
    </div>
  );
}
