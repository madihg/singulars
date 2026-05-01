# Poetry Classifiers & Singulars Eval Design

**Author:** Research analyst
**Date:** 2026-04-30
**Audience:** Halim Madi
**Project:** Singulars / ground.exe (Santa Fe, June 12 2026)

---

## Part 1 — Literature Review: Poetry & Literary-Quality Classifiers

The state of the art for classifying poetry quality sits at the intersection of three traditions: (1) computational stylistics rooted in psychology of language, (2) generation-and-evaluation work from the NLP community, and (3) the new wave of LLM-as-judge benchmarks built since 2023. None of these traditions has converged on a single accepted "poetry classifier"; instead, each has settled on a different operational definition of quality, with attendant trade-offs. What follows is a survey of the most relevant systems, the data they treat as gold, and the limits of each.

### 1.1 Surge AI — Hemingway-bench / "distinctively poetic"

Hemingway-bench is the most direct prior art. Surge AI assembled a panel of "expert creative writers" — professional screenwriters, poets, speechwriters, and copyeditors with high platform scores on writing axes — and ran more than 5,000 blind pairwise comparisons between model outputs across both real-world prompts (parents asking for bedtime stories, PMs writing business documents) and "frontier aspiration" prompts that include explicit stylistic constraints such as "Write like 1950s Beat Poetry" ([Surge blog](https://surgehq.ai/blog/hemingway-bench-ai-writing-leaderboard); [Hemingway-bench leaderboard](https://surgehq.ai/leaderboards/hemingway-bench)).

What it measures: relative preference between two model outputs given a prompt. The judges are humans, not LLMs, and they are domain experts.

What "gold" looks like: the human pairwise vote is gold. There is no single absolute score; the leaderboard is a Bradley-Terry / Elo aggregation over thousands of pairwise judgments.

Limitations: (a) cost — 5,000 expert-hours per refresh is roughly $25-50K of labor; (b) the bench is genre-agnostic, so a model that excels at "distinctively poetic" outputs can be punished when judges note that "heavy metaphors that might be appropriate for award acceptance speeches felt awkward in a coffee thank-you"; (c) the "distinctively poetic" axis is implicit in the rubric, never operationalized as a standalone classifier.

The most useful takeaway for Singulars: pairwise > absolute, panel composition is load-bearing, and 5K comparisons is roughly the right order of magnitude.

### 1.2 EQ-Bench Creative Writing v3

EQ-Bench Creative Writing v3 ([leaderboard](https://eqbench.com/creative_writing.html); [GitHub](https://github.com/EQ-bench/creative-writing-bench)) uses an LLM judge — Claude 3.5 Sonnet — across 32 prompts, 3 iterations each (96 generations per model), at temperature 0.7 with min_p 0.1. It computes two scores: (1) a rubric score from per-piece judgments and (2) an Elo score from pairwise comparisons against other models. Critically, it bakes in two bias mitigations: outputs are truncated to 4,000 characters to defeat length bias, and pairwise comparisons run in both A/B and B/A orders with averaging to defeat position bias.

What it measures: model-level creative writing skill on a rubric covering coherence, imagery, originality, voice, and adherence to prompt.

Gold data: there is none in the human-labeled sense. The judge is the gold. The benchmark relies on the assumption that a sufficiently strong judge model produces rankings that correlate with expert human rankings — an assumption empirically backed by general LLM-as-judge results ([Evidently AI guide](https://www.evidentlyai.com/llm-guide/llm-as-a-judge); [Eugene Yan, "Evaluating LLM Evaluators"](https://eugeneyan.com/writing/llm-evaluators/)).

Limitations: judge sycophancy and judge-model leakage (Claude judging Claude); rubric saturation at the top end (the Elo component is the discriminator there); no human ground truth, so calibration is structural rather than empirical.

### 1.3 LMArena (Chatbot Arena)

LMArena is the most widely-cited pairwise-preference benchmark. It collects blind side-by-side comparisons from real users, then aggregates with a Bradley-Terry rating system (close cousin to Elo) ([LMArena FAQ](https://arena.ai/faq); [Chatbot Arena paper](https://arxiv.org/pdf/2403.04132)). The recent "style control" methodology uses logistic regression to decompose preferences into style-driven and capability-driven components, "sucking out" style influence to isolate core capability.

What it measures: aggregated user preference, in the wild, across an enormous prompt distribution.

Gold: the user vote. This is exactly the position Singulars needs to defend.

Limitations: voter selection bias (Arena users are LLM-curious, not representative); prompt distribution drift; verbose-output and markdown-heavy bias (the very thing the style-control variant tries to correct).

The Singulars site is structurally an Arena for poetry — the same Bradley-Terry framing applies, though our N is much smaller and our prompts are curated.

### 1.4 Boyd & Pennebaker — LIWC and linguistic features

Ryan Boyd and James Pennebaker's LIWC tradition (now LIWC-22, ~12,000 terms across 117 categories) provides something neither Hemingway-bench nor EQ-Bench does: an interpretable feature vector for any text. Summary variables include analytical thinking, clout, authenticity, and emotional tone ([LIWC-22 manual](https://www.liwc.app/static/documents/LIWC-22%20Manual%20-%20Development%20and%20Psychometrics.pdf); [Pennebaker 2003 review](http://cognaction.org/cogs105/readings/LIWC.pdf)). LIWC has been applied to poetry — most famously the "Word use in the poetry of suicidal vs non-suicidal poets" study — to discriminate authorial mental state from linguistic features alone.

What it measures: word-frequency-based projections onto psychologically validated categories (affect, cognition, social, function words).

Gold data: no judgement at all — LIWC is unsupervised feature extraction. It becomes evaluation only when paired with a downstream label (suicide/no-suicide, depressed/control).

Limitations: bag-of-words; no awareness of syntactic structure, line breaks, meter, or imagery; correlations with human "quality" judgments are weak. It is a useful programmatic check ("is this poem statistically affect-heavy?") but insufficient as a primary classifier. For Singulars, LIWC-style features should anchor the LLM judge — never replace it.

### 1.5 Academic poetry-specific evaluation

A fragmented but growing literature attempts automated poetry evaluation:

- A survey of NLP for poetry ([Oxford DSH 2024](https://academic.oup.com/dsh/article/39/2/500/7602425)) catalogues meter classification, scansion, genre classification, and authorship attribution. The dominant evaluation criteria when humans grade poetry are: adherence to versification norms, grammatical correctness, coherence, relevance to the prompt, and "poeticity" (the residual aesthetic dimension).
- Russian generative poetry ([arXiv 2502.20931](https://arxiv.org/html/2502.20931v1)) builds an automated meter-and-rhyme scorer that achieves expert-level accuracy on formal-verse properties, but explicitly disclaims any judgment on aesthetic quality.
- Bi-LSTM/CRF scansion classifiers reach ~87% precision on metrical-foot prediction ([Multi-Genre Poetry Classification](https://www.researchgate.net/publication/381271090_Multi-Genre_Poetry_Classification_and_Performance_Evaluation)).
- Diversity-of-generation work ([arXiv 2406.15267](https://arxiv.org/html/2406.15267v2)) measures lexical and semantic diversity but does not rank quality.
- Davis's "ChatGPT's Poetry is Incompetent and Banal" ([NYU CS](https://cs.nyu.edu/~davise/papers/GPT-Poetry.pdf)) is a critical close-read showing that automated metrics miss the failure modes a literary critic would catch first — clichéd imagery, dead metaphors, generic closure.

Across these, the pattern is consistent: programmatic checks handle form, humans handle taste, and there is no validated automated classifier for "is this poem good." This is the opening Singulars walks into.

### 1.6 Anthropic constitutional / RLHF preference patterns

Anthropic's Constitutional AI work ([CAI paper](https://arxiv.org/abs/2212.08073); [Anthropic announcement](https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback)) is the canonical reference for using an LLM to generate pairwise preferences against a stated principle. The pattern: present two candidates plus a randomly-sampled principle from the constitution; ask the model which better satisfies the principle; train a preference model on the resulting labels. Chain-of-thought prompting materially improves judge accuracy on multiple-choice comparison tasks.

Two ideas transfer directly to Singulars: (a) a structured judge prompt with explicit principles outperforms a vibes-based one, and (b) every comparison should be run twice with positions swapped — a defense against the well-documented "first-position-preference" failure mode in pairwise judges ([RewardBench](https://arxiv.org/html/2403.13787v1); [BiasScope](https://arxiv.org/html/2602.09383)).

### 1.7 The Porter & Machery 2024 result and its limits

Porter & Machery's Scientific Reports paper ([Nature Sci Rep](https://www.nature.com/articles/s41598-024-76900-1)) tested 1,634 non-experts on ten poems — five from Shakespeare/Byron/Dickinson/Eliot and five from ChatGPT-3.5 in the style of those poets — and reported that participants were below chance (46.6%) at distinguishing AI from human, and rated the AI poems higher on rhythm and beauty. The result is contested ([Lithub critique](https://lithub.com/on-the-report-of-poetrys-death-or-what-does-that-ai-poetry-study-really-tell-us/); [Luddite response](https://theluddite.org/post/ai-poetry.html)) — the poems were stylistically simplified, the panel was non-expert, and "rated more favorably" tracked accessibility more than craft.

For Singulars the lesson is double-edged. The artistic premise — that audience preference is the relevant signal — is exactly the move Porter & Machery defend. But the critiques expose the failure mode: a non-curated audience will systematically prefer fluency over difficulty. Singulars' audience is self-selected (people who showed up to a Halim Madi performance), which is a different distribution and a stronger artistic prior, but also a smaller and more biased sample.

### 1.8 Open datasets and benchmarks

The most usable open resource is the Gutenberg Poetry Corpus ([HuggingFace biglam](https://huggingface.co/datasets/biglam/gutenberg-poetry-corpus); [Allison Parrish original](https://github.com/aparrish/gutenberg-poetry-corpus)) — ~3M lines of public-domain English poetry, line-level. Useful for golden-set seeding, style-conditioning examples, and lexical baselines. RewardBench ([allenai/reward-bench](https://github.com/allenai/reward-bench)) is the standard reward-model benchmark; recent work shows reward models hit 95% on safety but fall to 52.7% when objective signals are removed and only aesthetic signals remain ([arXiv 2510.14616](https://arxiv.org/html/2510.14616)) — a direct empirical statement that the field cannot yet judge aesthetics reliably.

### 1.9 Synthesis for Singulars

Three takeaways for the eval design that follows:

1. **Pairwise beats absolute for aesthetic deltas.** Hemingway-bench, LMArena, and EQ-Bench all converge on this. So should we.
2. **An LLM judge can hit 80-87% agreement with humans given 100-200 calibration examples** ([LangChain](https://www.langchain.com/articles/llm-as-a-judge); [arXiv 2508.21476](https://arxiv.org/html/2508.21476v1)). That's the calibration target.
3. **There is no validated poetry-quality classifier.** Singulars has the chance to ship one — narrowly scoped to the aesthetic axis Halim curates — using the votes as gold.

---

## Part 2 — Singulars Eval Methodology

### 2.1 The eval unit

The atomic unit is a four-tuple:

```
(performance_slug, theme_slug, winner_poem, loser_poem)
```

For every theme in a `trained` performance, exactly two poems exist — one human, one machine — and the vote tally selects winner and loser. After ground.exe runs and is marked `trained` (target: late June 2026), the tuples will form the full golden set.

**SQL to extract the current golden set** (run against Supabase):

```sql
WITH theme_pairs AS (
  SELECT
    perf.slug              AS performance_slug,
    perf.name              AS performance_name,
    perf.status            AS performance_status,
    perf.date              AS performance_date,
    p.theme,
    p.theme_slug,
    -- collapse the two poems in each pair into a single row
    MAX(CASE WHEN p.author_type = 'human'   THEN p.id::text   END) AS human_poem_id,
    MAX(CASE WHEN p.author_type = 'human'   THEN p.text       END) AS human_text,
    MAX(CASE WHEN p.author_type = 'human'   THEN p.author_name END) AS human_author,
    MAX(CASE WHEN p.author_type = 'human'   THEN p.vote_count END) AS human_votes,
    MAX(CASE WHEN p.author_type = 'machine' THEN p.id::text   END) AS machine_poem_id,
    MAX(CASE WHEN p.author_type = 'machine' THEN p.text       END) AS machine_text,
    MAX(CASE WHEN p.author_type = 'machine' THEN p.author_name END) AS machine_author,
    MAX(CASE WHEN p.author_type = 'machine' THEN p.vote_count END) AS machine_votes
  FROM performances perf
  JOIN poems p ON p.performance_id = perf.id
  WHERE perf.status = 'trained'
  GROUP BY perf.slug, perf.name, perf.status, perf.date, p.theme, p.theme_slug
)
SELECT
  performance_slug,
  performance_name,
  performance_date,
  theme,
  theme_slug,
  CASE WHEN human_votes >= machine_votes THEN human_poem_id   ELSE machine_poem_id END AS winner_poem_id,
  CASE WHEN human_votes >= machine_votes THEN human_text      ELSE machine_text     END AS winner_text,
  CASE WHEN human_votes >= machine_votes THEN human_author    ELSE machine_author   END AS winner_author,
  CASE WHEN human_votes >= machine_votes THEN 'human'         ELSE 'machine'        END AS winner_type,
  CASE WHEN human_votes >= machine_votes THEN human_votes     ELSE machine_votes    END AS winner_votes,
  CASE WHEN human_votes >= machine_votes THEN machine_poem_id ELSE human_poem_id    END AS loser_poem_id,
  CASE WHEN human_votes >= machine_votes THEN machine_text    ELSE human_text       END AS loser_text,
  CASE WHEN human_votes >= machine_votes THEN machine_author  ELSE human_author     END AS loser_author,
  CASE WHEN human_votes >= machine_votes THEN 'machine'       ELSE 'human'          END AS loser_type,
  CASE WHEN human_votes >= machine_votes THEN machine_votes   ELSE human_votes      END AS loser_votes,
  (CASE WHEN human_votes >= machine_votes THEN human_votes ELSE machine_votes END)
    + (CASE WHEN human_votes >= machine_votes THEN machine_votes ELSE human_votes END) AS total_votes,
  ABS(human_votes - machine_votes) AS vote_margin
FROM theme_pairs
WHERE human_poem_id IS NOT NULL AND machine_poem_id IS NOT NULL
ORDER BY performance_date DESC, theme_slug;
```

**Sizing.** The four `trained` performances (carnation.exe, versus.exe, reinforcement.exe, hard.exe) plus reverse.exe (currently `training`, expected to flip mid-May 2026) will give the eval set its v1 form. From the project spec there are roughly 8-12 themes per performance; assuming an average of 10, that's ~50 tuples at the moment ground.exe begins generating, and ~60 once ground.exe itself is `trained`. This is small. It is large enough for win-rate aggregates per model and per performance, and **too small to slice further than two factors at once** (e.g. don't try {model × performance × theme} — confidence intervals will blow up). Halim should run a `SELECT COUNT(*)` against the SQL above before finalizing the analysis plan.

### 2.2 Candidate-generation step

For each candidate model in the eval (ground.exe v0/v1/v2, plus baselines like Claude Opus, GPT-5, an unconditioned LLaMA-3 finetune, and a Gutenberg-corpus retrieval baseline):

1. For each tuple, condition on `theme` plus an optional style control (e.g. "in the voice of Halim Madi", "machine-style", "free verse with sparse imagery"). Style controls should be stored as part of the run config so they're auditable.
2. Generate **N=5** candidate poems per (model, theme) at temperature 0.8 — enough to detect within-model variance, few enough to keep judge cost bounded. Total generation count for a 5-model bake-off across 60 tuples = 60 × 5 × 5 = 1,500 poems.
3. Save candidates to a new table `eval_candidates(id, model_name, model_version, performance_slug, theme_slug, style_control, poem_text, generated_at, run_id)`.

### 2.3 The judge step (load-bearing prompt)

The judge sees the theme, the candidate, the audience-vote winner, and the audience-vote loser. It is asked which of the three poems it considers strongest, with the candidate masked to position C and winner/loser randomized between A and B.

**Judge prompt template:**

```
You are evaluating poems written for a live human-vs-machine poetry
performance. You will see a theme and three poems. One was written by a
human or machine performer and won the audience vote on the night. One was
written by the opposing performer and lost the audience vote. The third is
a candidate from a model under evaluation.

Your task: rank the three poems from strongest (1) to weakest (3) using the
rubric below. Then state, separately, whether the candidate poem would
plausibly have won the audience vote against the original winner.

Rubric (weight all dimensions equally):
1. IMAGE — does the poem produce a specific, non-cliched image or scene?
2. PRESSURE — does the language feel earned, not slack? Are line breaks
   doing work?
3. SURPRISE — is there a turn, reframe, or unexpected closure?
4. FIDELITY — does the poem actually engage the theme, not orbit it?
5. VOICE — does it sound like a person (or a coherent persona), not
   a generic poetry voice?

Penalize: greeting-card sentiment, generic nature imagery
("whispering wind", "dancing leaves"), forced rhyme, abstract nouns
substituting for image, AI-tells (em-dash overuse, "tapestry", "in a
world where").

THEME: {theme}

POEM A:
{poem_a}

POEM B:
{poem_b}

POEM C:
{poem_c}

Think step by step. For each poem, write 2-3 sentences identifying its
strongest move and its weakest move. Then output your verdict in this
exact JSON shape, no other text:

{
  "ranking": ["A" | "B" | "C", "A" | "B" | "C", "A" | "B" | "C"],
  "candidate_beats_winner": true | false,
  "confidence": "low" | "medium" | "high",
  "rationale_one_line": "..."
}
```

Operational rules around the prompt:

- The judge is a strong frontier model that **is not in the candidate pool** (e.g. if ground.exe is fine-tuned from a Claude family model, judge with GPT-5 or vice versa). This kills self-preference leakage.
- **Every (theme, candidate) is judged twice**, once with (winner=A, loser=B, candidate=C) and once with (loser=A, winner=B, candidate=C). Position bias mitigation per RewardBench protocol ([RewardBench](https://arxiv.org/html/2403.13787v1)).
- **N=3 judge calls** per assignment, take the majority verdict on `candidate_beats_winner`. Disagreements are surfaced as a flag, not averaged away.
- Programmatic pre-checks run before the judge: line count > 3, no exact substring match against the winner/loser texts, no detectable refusal. Any failure short-circuits to `gray-out` (not "candidate loses" — gray-out is a failure state, not a verdict).

### 2.4 Aggregation

Per-model metrics:

- **Win rate vs. audience winners** — fraction of tuples where the judge marks `candidate_beats_winner: true`. This is the primary headline.
- **Mean rank** of the candidate (1.0 = always best, 3.0 = always worst).
- **Win rate broken out by performance** (carnation.exe, versus.exe, reinforcement.exe, hard.exe, reverse.exe, ground.exe).
- **Win rate by theme cluster** — only meaningful after a manual clustering pass on themes (e.g. "love", "death", "machine", "city").
- **Confidence interval via bootstrap** — resample tuples with replacement, recompute win rate, report the 5th-95th percentile band. With ~60 tuples and N=5 candidates, expect a ±8-12 percentage-point band.

Reported alongside: a calibration plot of judge confidence vs. judge correctness on the calibration set, and a histogram of vote margins in the underlying golden tuples (so a reader can see which tuples were close calls in the audience and which were blowouts).

### 2.5 Calibration: hitting 80%+ judge-human agreement

The judge prompt above is untested. It must be calibrated against a human-labeled subset before any model rankings are published.

**The calibration task.** Sample 100-150 tuples (oversample with replacement if N<100) and present each one to 3 human raters as a triplet: theme + candidate + audience-winner + audience-loser. (Use ground-truth tuples from past performances; the candidate slot is filled by random draws from across the model pool, including weak models, so the human task spans the full quality range — the calibration set must be discriminative, not all close calls.)

Ask each human:

1. Rank the three poems (same rubric).
2. State whether the candidate would beat the audience winner.

Take the majority human vote as the human label. Run the LLM judge on the same triplets. Compute Cohen's kappa and raw agreement.

**Target:** ≥ 80% raw agreement on the binary `candidate_beats_winner` axis, ≥ 0.6 Cohen's kappa on the full ranking. This matches the empirical ceiling reported across the LLM-as-judge literature ([Evidently AI](https://www.evidentlyai.com/llm-guide/llm-as-a-judge); [LangChain calibration article](https://www.langchain.com/articles/llm-as-a-judge)) — Anthropic's MT-Bench style judges land around 80% agreement, which is itself the level humans reach with each other.

**Where to source raters.** Surge AI's expert pool is the most direct fit (the same pool Hemingway-bench used) but expensive — quote 100 triplets × 3 raters × $5-8 per triplet ≈ $1.5-2.4K. Prolific is ~3-4× cheaper but you'll need to filter for self-reported poetry exposure or run a screening task (a 10-poem "spot the cliché" pretest with known-good distractors). **Recommended:** 50% Surge experts, 50% Prolific filtered — gives you both an expert anchor and a representative-audience anchor, and the gap between them is itself an interesting metric.

**Iterating the prompt.** If raw agreement < 80%, bisect: check whether disagreement clusters on any one rubric dimension (likely SURPRISE or VOICE) and either tighten that dimension's language or remove it. Do not add length. Re-run on a held-out 30 triplets after each prompt edit. Three iterations max before declaring the prompt "shipped."

### 2.6 The Benjamin objection — rigorous rebuttal

Benjamin Lowenstein's caution to Halim — that user-preference signals are unreliable as ground truth because "feedback can often be misaligned" — is a correct, well-documented concern in the standard RLHF setting. The literature substantiates it: reward models are trained on what humans approve, not on what is actually good, and models can exploit that gap ([RLHS paper](https://arxiv.org/html/2501.08617v3); [Open Problems and Limitations of RLHF](https://ar5iv.labs.arxiv.org/html/2307.15217)). Sycophancy is the canonical failure mode — humans prefer responses that flatter them, and preference-trained models learn to flatter ([RLHF survey, ACM CSUR](https://dl.acm.org/doi/10.1145/3743127)).

The objection rests on a specific assumption: that there is a **true target** — helpfulness, truthfulness, correctness — for which user preference is a noisy proxy. Under that assumption, the gap between "what users prefer" and "the true target" is exactly the misalignment Lowenstein names.

**Singulars violates the assumption.** It is the inverse case. There is no truth-of-the-poem hiding behind audience preference. The artistic premise of the project — and this needs to be load-bearing in the methodology, not decorative — is that **the audience vote is constitutive of the work**. A poem that loses the vote on the night didn't lose because the audience failed to detect its hidden quality; it lost because, in the social and theatrical context of that performance, on that theme, with those performers, against that specific opposing poem, it was the lesser piece. The vote isn't measuring quality. The vote is the operationalization of quality the project chooses to use.

This is structurally the same move LMArena makes for general LLM preference. Arena does not claim its votes track some Platonic "best LLM" — it claims that aggregated user preference on real prompts in real comparisons _is_ the relevant operational definition of "useful LLM" for the population that votes ([Chatbot Arena paper](https://arxiv.org/pdf/2403.04132)). The Bradley-Terry rating doesn't approximate ground truth; it _defines_ the ranking. The same logic applies here, with two added strengths:

1. The Singulars audience is **curated by attendance** — they came to a Halim Madi performance, they accept the project's frame. This is a stronger artistic prior than the LMArena population, which is opportunistic.
2. The competition is **forced-choice between exactly two poems on the same theme**. There is no length bias, no markdown bias, no verbosity bias — the dominant nuisance variables on Arena. The poems are visually similar in length and density by curation. What's left after those nuisances are stripped is much closer to a clean preference signal than Arena's.

The remaining honest worry is voter selection bias — the people who vote are not "the public," they are a specific demographic (poetry-tolerant gallery-goers and online stragglers). But again: this is not a bug, it is the artistic frame. The project is not claiming ground.exe is the best poet on Earth. It is claiming ground.exe is the model that maximally predicts the preference of the Singulars audience. That claim is testable, falsifiable, and precise — exactly the properties Lowenstein wants of a ground truth. The misalignment objection applies when you mistake the proxy for the target. Singulars makes them the same thing on purpose.

One consequence to internalize: the eval is _only_ valid for the population the votes came from. Reporting "ground.exe wins 73% against past audience winners" is a sentence about Singulars audiences, not about poetry. The methodology section in the eventual essay should be explicit about that scope.

### 2.7 Failure modes and mitigations

| Failure mode                                                                                                                                                                                                                                                                                        | Mitigation                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Small-N votes per theme.** Some past themes may have <20 total votes. Win/loss assignment becomes noisy.                                                                                                                                                                                          | Filter the golden set to tuples with `total_votes >= V_min` (start V_min=20). Report an unfiltered version too.                                                                                                                                                                                                                                                                     |
| **Vote ties.** `human_votes == machine_votes` (rare but possible).                                                                                                                                                                                                                                  | Drop tied tuples from the golden set, log them separately as "contested."                                                                                                                                                                                                                                                                                                           |
| **Fingerprint duplication attempts.** FingerprintJS open-source has 40-60% accuracy and can collide across same-config devices ([FingerprintJS GitHub](https://github.com/fingerprintjs/fingerprintjs); [Fingerprint Pro FAQ](https://fingerprint.com/resources/frequently-asked-questions-faqs/)). | The unique index on `(voter_fingerprint, poem_id)` plus the `cast_vote` RPC's pair check prevents one fingerprint from voting on both sides of a pair. Attackers using rotating fingerprints are partially detected via IP rate-limiting at the API layer. For the eval, log per-theme vote-rate spikes and flag any tuple where >40% of votes arrive in a single 10-minute window. |
| **Voter selection bias.** Singulars audience is not "the public."                                                                                                                                                                                                                                   | Out of scope to fix; in scope to disclose. The methodology section names the audience explicitly as the eval population.                                                                                                                                                                                                                                                            |
| **Judge model leakage / self-preference.** A judge from the same model family as the candidate may favor it.                                                                                                                                                                                        | Choose judges from a different family than every candidate. If ground.exe is Claude-derived, judge with GPT-5 (and vice versa). Sanity-check by running a second judge from a third family on a 20% subset; report the agreement between judges.                                                                                                                                    |
| **Position bias in the judge.** Pairwise judges over-prefer position A.                                                                                                                                                                                                                             | Run every comparison twice, swapping positions, and average. Standard RewardBench protocol.                                                                                                                                                                                                                                                                                         |
| **Length/style bias in the judge.** Judges over-prefer longer or more flowery candidates.                                                                                                                                                                                                           | Truncate all poems to a max line count (e.g. 24 lines) before judging; if a candidate exceeds, truncate at a stanza break and flag. Add an explicit anti-flowery line to the rubric (already present in the prompt).                                                                                                                                                                |
| **Theme distribution drift.** Past performances overweight certain themes; ground.exe themes may be different.                                                                                                                                                                                      | Tag every theme with a coarse cluster (love/death/political/abstract/etc.) at curation time. Report win rates per cluster.                                                                                                                                                                                                                                                          |
| **Judge prompt overfitting.** The prompt is calibrated on a specific human-labeled set; new performances may shift the distribution.                                                                                                                                                                | Re-run calibration after every `trained` flip. This is the trigger-based re-evaluation Halim has flagged in his consulting notes.                                                                                                                                                                                                                                                   |
| **Gray-out / programmatic-check failures.** Candidate fails a pre-check (too short, refusal, exact copy of input).                                                                                                                                                                                  | Flag tuple as gray-out, exclude from win-rate denominator, report gray-out rate as a separate metric. Gray-out > 5% of any model's outputs is itself a failure state for that model.                                                                                                                                                                                                |

### 2.8 Open questions for Halim

1. **Recency weighting.** Should ground.exe being optimized for recent performances (reverse.exe, hard.exe) outweigh older ones (carnation.exe)? Artistic argument either way — recency = current taste, full-history = thematic robustness. Default proposal: equal-weight v1, recency-weighted v2 sensitivity check.
2. **What counts as "the candidate beats the winner"?** Strict (judge must rank candidate #1) vs. lenient (judge must rank candidate above the winner regardless of the loser's position). I've used lenient in the prompt; strict is also defensible.
3. **Judge model choice.** Lock to one judge for reproducibility, or rotate across {Claude Opus, GPT-5, Gemini 2.x} for robustness? My recommendation: lock for v1 (so deltas across model versions are clean), rotate for v2.
4. **How public is the eval?** If the win-rate dashboard is published live on /singulars, voters might game future tuples. Suggest publishing only after each performance flips to `trained`.
5. **Should style-control prompts be part of the spec?** Currently the candidate generation conditions on theme alone. Halim has a distinctive voice; conditioning on "in Halim's voice" could be its own track.
6. **What is the floor for "human" performance?** Several past tuples may have lost the audience vote despite being clearly stronger as poems — maybe we treat human-poem-that-lost as a separate tier ("artistic upset") rather than just "loser."
7. **Ground.exe's training data overlap with the eval set.** If ground.exe was trained on hard.exe + reverse.exe vote data, its win rate on those performances is contaminated. Decision: report ground.exe win rates separately for _training-set_ performances and _held-out_ performances (e.g., carnation.exe and ground.exe-itself).
8. **Surge vs. Prolific mix for calibration.** Defaulted to 50/50; Halim should pick based on budget and the artistic question of whether expert taste or audience taste should anchor the judge.

### 2.9 Summary of operational steps

1. Run the SQL in §2.1 against Supabase. Confirm tuple count.
2. Build the calibration set: sample 100-150 triplets, fill candidate slot from a stratified pool spanning weak-to-strong models.
3. Send to Surge + Prolific raters. Collect labels.
4. Run the v1 judge prompt on the same triplets. Compute agreement. Iterate prompt up to 3x to hit 80%.
5. Generate candidates for all eval models on all golden tuples (N=5 per model per theme).
6. Run the calibrated judge with double-position protocol.
7. Aggregate win rates, bootstrap CIs, slice by performance and theme cluster.
8. Publish dashboard. Re-trigger after every `trained` flip.

---

## Sources

- [Surge AI — Hemingway-bench AI Writing Leaderboard](https://surgehq.ai/blog/hemingway-bench-ai-writing-leaderboard)
- [Surge AI — Hemingway-bench leaderboard](https://surgehq.ai/leaderboards/hemingway-bench)
- [EQ-Bench Creative Writing v3 leaderboard](https://eqbench.com/creative_writing.html)
- [EQ-Bench Creative Writing GitHub](https://github.com/EQ-bench/creative-writing-bench)
- [LMArena FAQ](https://arena.ai/faq)
- [Chatbot Arena paper (arXiv 2403.04132)](https://arxiv.org/pdf/2403.04132)
- [LIWC-22 manual](https://www.liwc.app/static/documents/LIWC-22%20Manual%20-%20Development%20and%20Psychometrics.pdf)
- [Pennebaker, LIWC review (Annu Rev Psychol 2003)](http://cognaction.org/cogs105/readings/LIWC.pdf)
- [Constitutional AI paper (arXiv 2212.08073)](https://arxiv.org/abs/2212.08073)
- [Anthropic — Constitutional AI announcement](https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback)
- [RewardBench (arXiv 2403.13787)](https://arxiv.org/html/2403.13787v1)
- [allenai/reward-bench GitHub](https://github.com/allenai/reward-bench)
- [BiasScope (arXiv 2602.09383)](https://arxiv.org/html/2602.09383)
- [Porter & Machery, Sci Rep 2024](https://www.nature.com/articles/s41598-024-76900-1)
- [Lithub — On the Report of Poetry's Death](https://lithub.com/on-the-report-of-poetrys-death-or-what-does-that-ai-poetry-study-really-tell-us/)
- [The Luddite — response to Porter & Machery](https://theluddite.org/post/ai-poetry.html)
- [Davis — ChatGPT's Poetry is Incompetent and Banal (NYU)](https://cs.nyu.edu/~davise/papers/GPT-Poetry.pdf)
- [Oxford DSH — NLP for poetry survey](https://academic.oup.com/dsh/article/39:2:500/7602425)
- [Russian generative poetry meter eval (arXiv 2502.20931)](https://arxiv.org/html/2502.20931v1)
- [Multi-Genre Poetry Classification (ResearchGate)](https://www.researchgate.net/publication/381271090_Multi-Genre_Poetry_Classification_and_Performance_Evaluation)
- [Diversity in automatic poetry generation (arXiv 2406.15267)](https://arxiv.org/html/2406.15267v2)
- [Gutenberg Poetry Corpus — HuggingFace](https://huggingface.co/datasets/biglam/gutenberg-poetry-corpus)
- [Allison Parrish — gutenberg-poetry-corpus GitHub](https://github.com/aparrish/gutenberg-poetry-corpus)
- [Evidently AI — LLM-as-judge guide](https://www.evidentlyai.com/llm-guide/llm-as-a-judge)
- [LangChain — Calibrating LLM-as-judge with human corrections](https://www.langchain.com/articles/llm-as-a-judge)
- [Eugene Yan — Evaluating LLM Evaluators](https://eugeneyan.com/writing/llm-evaluators/)
- [Multi-Agent creative writing eval (arXiv 2508.21476)](https://arxiv.org/html/2508.21476v1)
- [RLHS — Mitigating misalignment with hindsight (arXiv 2501.08617)](https://arxiv.org/html/2501.08617v3)
- [Open Problems and Limitations of RLHF (arXiv 2307.15217)](https://ar5iv.labs.arxiv.org/html/2307.15217)
- [RLHF Deciphered (ACM CSUR)](https://dl.acm.org/doi/10.1145/3743127)
- [Beyond Correctness — Subjective Writing Preferences (arXiv 2510.14616)](https://arxiv.org/html/2510.14616)
- [FingerprintJS GitHub](https://github.com/fingerprintjs/fingerprintjs)
- [Fingerprint Pro FAQ](https://fingerprint.com/resources/frequently-asked-questions-faqs/)
