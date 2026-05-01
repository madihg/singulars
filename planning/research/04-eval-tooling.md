# Eval Tooling for Singulars — Framework Comparison & Recommendation

**Date:** 2026-04-30
**Author:** Research subagent for Halim
**Goal:** Pick a CLI-first eval framework that Claude Code can drive end-to-end for the Singulars human-vs-machine poetry project — load themes/poems from Supabase, dispatch generations to Anthropic / OpenAI / Gemini / OpenRouter / local HF models, run a custom pairwise judge prompt, persist scores, and write back to Supabase after each performance.

---

## 1. Frameworks evaluated

I inspected each repo and its docs directly. Findings below come from the actual READMEs, GitHub API metadata, and primary doc pages — not marketing copy.

### Inspect AI (UK AI Security Institute)

- **Repo:** `UKGovernmentBEIS/inspect_ai`, MIT, 1,984 stars, last push **2026-04-30** (today). Active flagship project of the UK government AI safety lab.
- **Surface:** Python library + `inspect eval` / `inspect eval-set` / `inspect view` CLI. You write a `@task`-decorated Python file that returns `Task(dataset=..., solver=..., scorer=...)`.
- **Judge prompts:** Built-in `model_graded_qa()` and `model_graded_fact()` scorers take an arbitrary `template` and `instructions` string — fully custom prompts, with `model="anthropic/claude-..."` selectable per scorer (i.e. judge model is independent of the model under test). Easy to write a custom `@scorer` that does pairwise.
- **Pairwise:** Not first-class, but trivial to implement: a `Sample` carries both poems as fields, the scorer prompts the judge with both, and you parse `A`/`B`/`tie`. The `model_roles` feature is purpose-built for this (separate `candidate_a`, `candidate_b`, `judge` roles).
- **Data sources:** `csv_dataset()`, `json_dataset()`, `hf_dataset()` first-class; arbitrary Python callable returning `Sample[]` for Postgres/Supabase. Trivial to write a 10-line loader hitting `supabase-py`.
- **Multi-model:** Native providers for Anthropic, OpenAI, Google, Mistral, Bedrock, Azure, vLLM, Ollama, **OpenRouter**, **HuggingFace inference providers** (Cerebras/Groq/Together via HF), plus a Model API extension hook. Same eval run can hit several models via `--model anthropic/...,openai/...,google/...`.
- **Persistence:** `.eval` log files (zstd-compressed JSON, with a published JSON Schema + TypeScript bindings). `inspect_ai.log` Python API + `inspect log dump` CLI to print logs as JSON. Designed to be queried programmatically.
- **Visualisation hooks:** `inspect view` ships a local web UI, but the JSON log is the source of truth — you can pipe it anywhere (a Vercel dashboard, Supabase, Notion). `inspect_ai.analysis` module provides pandas-friendly aggregation.
- **Local vs hosted:** 100% open-source / local. No SaaS lock-in.
- **Maturity:** Active daily commits, used by AISI, Anthropic, METR; Hamel Husain's well-known [post](https://hamel.dev/notes/llm/evals/inspect.html) endorses it as the serious option for production evals.

### promptfoo

- **Repo:** `promptfoo/promptfoo`, MIT, **20,748 stars**, last push 2026-04-30. Acquired by OpenAI in early 2026 but explicitly remains MIT and open-source.
- **Surface:** Pure CLI-first. `npm i -g promptfoo` (or `brew install promptfoo`, `pip install promptfoo`), then `promptfoo init`, `promptfoo eval`, `promptfoo view`. Configured via a single `promptfooconfig.yaml`.
- **Judge prompts:** First-class. `assert: { type: llm-rubric, value: "...prompt..." }` supports any rubric. The `provider` field on the assertion lets you pick the judge model independently.
- **Pairwise:** First-class via the dedicated `select-best` assertion type ("compare these N outputs and pick the best by criterion X"). Also documents an explicit pairwise pattern (run A-then-B and B-then-A, count agreement) as the recommended bias-control approach.
- **Data sources:** YAML/JSON/JSONL/CSV (`tests: file://themes.csv`), Google Sheets, dynamic Python/JS test generators (`tests: file://gen.py:make_tests`). No native Supabase plugin, but a 20-line Python or JS test-generator script hits Supabase trivially.
- **Multi-model:** Top-tier provider list — OpenAI, Anthropic, Gemini, Bedrock, Azure, Ollama, vLLM, Replicate, Together, **OpenRouter**, **HuggingFace inference**, plus arbitrary `python:` or `javascript:` custom providers. Listing several `providers:` in the config produces a side-by-side comparison matrix in one run.
- **Persistence:** Local SQLite by default (`~/.promptfoo/`). `promptfoo export -o results.json` produces a fully-structured JSON (per-row prompt, output, score, rubric reasoning, componentResults). `--output results.csv|.html|.json|.yaml` directly from `eval`.
- **Visualisation hooks:** Built-in `promptfoo view` web UI is excellent, but JSON/CSV export is trivial — feeds a custom dashboard with no friction. SQLite is queryable directly.
- **Local vs hosted:** Open-source, runs 100% locally. Optional team cloud at `promptfoo.app` for sharing.
- **Maturity:** Most-starred eval repo on GitHub by a wide margin; daily commits; used in production at OpenAI and Anthropic per the README. 251 open issues (high traffic, not stale).

### Braintrust

- **Repo:** SDKs in `braintrustdata/braintrust-sdk-{python,typescript,go,ruby}`, all open-source. Core platform is **closed-source SaaS** (`braintrust.dev`).
- **Surface:** `bt` CLI (curl-installable) plus `pip install "braintrust[cli]"`. You write Python/TS files and run `braintrust eval my_eval.py`.
- **Judge prompts:** Excellent — their `autoevals` library is open-source and ships pairwise-capable LLM judges out of the box.
- **Pairwise:** First-class via `autoevals.Battle` and `autoevals.LLMClassifier` with arbitrary prompts.
- **Data sources:** Datasets are a SaaS-side primitive; you upload from CSV/JSON/Pandas via SDK. Postgres/Supabase loading means writing a 10-line script to pump rows into a Braintrust dataset.
- **Multi-model:** AI proxy supports OpenAI, Anthropic, Google, OpenRouter, Together, Mistral, local via OpenAI-compatible endpoints — broad coverage.
- **Persistence:** **All scores live in Braintrust's cloud DB.** SDK can re-fetch them, but the canonical store is SaaS.
- **Visualisation hooks:** First-class web UI (this is the product). API to pull experiments back as JSON, but you're swimming upstream against the platform.
- **Local vs hosted:** **SaaS-only** for the core platform (free tier exists). Self-hosted is enterprise-tier, expensive, and still depends on Braintrust binaries.
- **Maturity:** Well-funded, active, but vendor-locked.

### Weights & Biases Weave

- **Repo:** `wandb/weave`, Apache-2.0, 1,089 stars, very active.
- **Surface:** Python/TS SDK (`@weave.op` decorator + `Evaluation(...)`). **Library-first, not CLI-first** — you write a Python file and run `python eval.py`. No `weave eval` CLI.
- **Judge prompts:** Custom `Scorer` classes; full freedom to write LLM-judge logic.
- **Pairwise:** Possible via custom Scorer; not a first-class primitive.
- **Data sources:** Anything you can read in Python — CSV, HF, Postgres. No declarative loaders.
- **Multi-model:** Whatever the user's code calls — anything goes (Anthropic, OpenAI, Gemini, OpenRouter, HF) but you wire it yourself.
- **Persistence:** **Tied to W&B cloud** — traces, scores, and datasets go to W&B by default. Self-hosting is enterprise.
- **Visualisation hooks:** Outstanding W&B UI, but exporting structured eval data to a custom dashboard means hitting their API.
- **Local vs hosted:** Effectively SaaS. Open-source SDK, closed-source backend.
- **Maturity:** Active, but W&B's strength is observability/tracing more than batch evals.

### OpenAI Evals

- **Repo:** `openai/evals`, 18,325 stars, last push 2026-04-14. Custom non-OSI license. **Not accepting custom-code evals** anymore — only YAML model-graded evals — and OpenAI has redirected attention to the in-dashboard evals product on platform.openai.com.
- **Surface:** `oaieval gpt-4 my_eval` after `pip install evals` and `git lfs pull` for the registry data. Heavy setup (Git-LFS).
- **Judge prompts:** Model-graded eval YAML templates only. Workable for pairwise but requires registry-style YAML conventions.
- **Pairwise:** Not idiomatic; you'd build a "modelgraded" comparison eval by hand.
- **Data sources:** JSONL through the registry. Postgres/Supabase requires custom completion-fn glue.
- **Multi-model:** Heavily OpenAI-centric. Other providers via "completion functions" but Anthropic/Gemini/OpenRouter aren't first-class.
- **Persistence:** Local JSONL log files, optional Snowflake export.
- **Visualisation hooks:** Bare-bones; designed as a benchmark-running tool, not a dashboard producer.
- **Local vs hosted:** Open-source repo, but the energy has moved to OpenAI's dashboard product.
- **Maturity:** Still alive but coasting — they explicitly tell contributors to use the dashboard. Not a vibrant choice in 2026.

### lm-evaluation-harness (EleutherAI)

- **Repo:** `EleutherAI/lm-evaluation-harness`, MIT, 12,387 stars, last push 2026-04-30. CLI-first (`lm_eval --model ... --tasks ...`).
- **Surface:** `lm_eval run --model hf --tasks ... --output_path ...`. Designed for benchmark-style evals (MMLU, HellaSwag, etc.).
- **Judge prompts:** LLM-as-judge support is **explicitly a work-in-progress** (open issue #2233 outlines the plan but it's not landed). Pairwise is on the roadmap, not in main.
- **Pairwise:** No first-class support today.
- **Data sources:** HuggingFace datasets first-class. CSV/Postgres requires writing a custom task YAML.
- **Multi-model:** Excellent for HF/vLLM/local. API-model coverage exists (`--model openai-completions`, `local-completions` to vLLM/Anthropic via OpenAI-compatible proxies) but Anthropic-native is via OpenAI-compatible mode, not idiomatic.
- **Persistence:** JSON output files.
- **Visualisation hooks:** None built-in; raw JSON only.
- **Local vs hosted:** Pure OSS, local.
- **Maturity:** Bedrock for academic LLM evals, but optimised for **benchmark answer-key tasks** (multiple choice, exact match, log-likelihood), not creative-output LLM-judge evals. Wrong fit for poetry pairwise.

### Phoenix (Arize)

- **Repo:** `Arize-ai/phoenix`, **Elastic License v2** (not OSI-approved), 9,493 stars, last push 2026-04-30. Self-hostable via Docker.
- **Surface:** Python library + Phoenix CLI (`@arizeai/phoenix-cli`) + a heavy server. Trace/observability-first; evals are a feature alongside.
- **Judge prompts:** `arize-phoenix-evals` package with pre-built RAG / response evaluators; custom LLM-judge templates supported.
- **Pairwise:** Not first-class; achievable via custom evaluator.
- **Data sources:** Datasets are a Phoenix server primitive; CSV/Pandas upload via SDK.
- **Multi-model:** OpenInference instrumentation across most providers.
- **Persistence:** Phoenix server (Postgres backed if self-hosted, or SQLite in dev).
- **Visualisation hooks:** Phoenix UI is the visualisation; GraphQL/OpenAPI client to pull data out.
- **Local vs hosted:** Self-hostable, but the server is heavy. Not "single-CLI-command" simple.
- **Maturity:** Strong observability play; eval as a layer on top of tracing. Wrong centre of gravity for a batch poetry eval.

### Notable also-rans (searched, ruled out)

- **DeepEval (Confident AI)** — pytest-style, but heavily SaaS-tied for dashboards.
- **LangSmith** — closed SaaS, fine but locks into LangChain ecosystem.
- **Langfuse** — observability-first like Phoenix; eval is secondary.
- **OpenEvals (LangChain)** — pre-built scorer library but not a runner; meant to be embedded in other frameworks.
- **simple-evals (OpenAI)** — explicitly frozen as of mid-2025; reference impl only.

---

## 2. Comparison Table

| Dimension                  | Inspect AI                                                                | promptfoo                                                | Braintrust                       | W&B Weave                     | OpenAI Evals                       | lm-eval-harness                | Phoenix                            |
| -------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------- | ----------------------------- | ---------------------------------- | ------------------------------ | ---------------------------------- |
| **CLI ergonomics**         | Excellent (`inspect eval task.py --model ...`)                            | **Best-in-class** (`promptfoo eval`, single YAML)        | Good (`bt`/`braintrust eval`)    | Poor (lib-only, no eval CLI)  | OK (`oaieval`, heavy LFS setup)    | Good (`lm_eval run`)           | Heavy (server + CLI)               |
| **Custom judge prompts**   | Yes, `template` + `instructions` on `model_graded_qa`                     | **Yes, `llm-rubric` with arbitrary prompt**              | Yes, `autoevals` open-source     | Yes, custom `Scorer`          | YAML-only model-graded             | WIP (issue #2233)              | Yes, custom evaluators             |
| **Pairwise / comparative** | Easy via custom `@scorer` + `model_roles`                                 | **First-class `select-best`** + documented bias-control  | First-class (`autoevals.Battle`) | Custom Scorer                 | Hand-rolled YAML                   | None today                     | Custom evaluator                   |
| **Data sources**           | CSV / JSON / HF native + Python callable for Supabase                     | YAML / CSV / JSON / Sheets / **`file://gen.py` dynamic** | SDK upload to SaaS dataset       | Anything in Python            | JSONL via Git-LFS registry         | HF first-class                 | SDK upload to server               |
| **Multi-model dispatch**   | Anthropic, OpenAI, Google, OpenRouter, HF, vLLM, Bedrock, Ollama (native) | Same list, **plus declarative matrix in YAML**           | Broad via AI proxy               | Whatever you call             | OpenAI-centric                     | HF + OpenAI-compat             | OpenInference                      |
| **Persistence**            | Local `.eval` files (zstd JSON, schema'd)                                 | **Local SQLite + JSON/CSV/HTML export**                  | Braintrust cloud DB              | W&B cloud                     | Local JSONL / Snowflake            | JSON files                     | Phoenix server (Postgres)          |
| **Visualisation hooks**    | JSON Schema + `inspect_ai.analysis` pandas API + local UI                 | **JSON/CSV/HTML out, pipes to anything**                 | API to fetch back from SaaS      | W&B UI + API                  | None                               | None                           | GraphQL + UI                       |
| **Local vs hosted**        | OSS / local                                                               | **OSS / local** (optional cloud)                         | SaaS-first                       | SaaS-first                    | OSS but coasting                   | OSS / local                    | Self-host possible (ELv2, not OSI) |
| **Maturity (Apr 2026)**    | 1.9k stars, daily commits, AISI-backed, Hamel-endorsed                    | **20.7k stars, daily commits, owned by OpenAI, MIT**     | Active SaaS                      | Active, observability-leaning | 18k stars but stagnating direction | 12.4k stars, benchmark-focused | 9.5k stars, observability-focused  |

---

## 3. Top Recommendation: **promptfoo**

Pick **promptfoo**. It's the clearest fit for the way Halim actually works (Claude Code in a shell, single-command iteration, no boilerplate Python scaffolding).

**Why promptfoo wins for Singulars specifically:**

1. **Single-command CLI is genuinely single-command.** `promptfoo init && promptfoo eval && promptfoo view` is the entire ceremony. Claude Code can `Bash` a one-liner and get a result. Inspect AI requires you to author and maintain a Python `@task` file — fine for an engineer, more friction for a non-engineer driving via Claude.

2. **Pairwise scoring is first-class.** `select-best` and `llm-rubric` cover the exact human-vs-machine pattern Singulars needs, with documented bias controls (run A-then-B and B-then-A, count agreement). No custom scorer code to write.

3. **The YAML config file IS the experiment record.** A non-engineer can read it. Halim can diff `promptfooconfig.yaml` between performances to see what changed, and Claude Code can edit YAML far more reliably than it edits Python eval scaffolds.

4. **Multi-model matrix is declarative.** Want to compare Claude 4.5 vs GPT-5 vs Gemini 2.5 vs the locally-fine-tuned hard.exe model? Add four lines under `providers:`. Inspect needs a comma-separated `--model` arg; promptfoo gives you the matrix view for free.

5. **Output → Supabase is a 10-line script.** `promptfoo eval -o results.json` produces a cleanly-shaped JSON with per-row scores, rubric reasoning, and prompt provenance. A tiny Node or Python post-step writes those rows into a `singulars_eval_runs` Supabase table. **This is the post-performance write-back path.** Compare to Braintrust/Weave where the data is held in their cloud first.

6. **Maturity and licensing.** 20,748 stars (3rd most-starred LLM repo on GitHub), MIT, used in production at OpenAI and Anthropic. The OpenAI acquisition in 2026 came with a public, written commitment to keep promptfoo MIT and open — a much better risk profile than betting on Braintrust's SaaS roadmap.

7. **Custom Python provider for the local hard.exe model.** When the locally fine-tuned poet needs to be one of the candidates, `providers: [{ id: 'file://hard_exe.py' }]` calls a Python function — same eval, no special runner.

**Where Supabase write-back lives:** A `defaultTest.transform` or a post-eval `node scripts/persist.js` step reads the JSON, inserts into Supabase via `@supabase/supabase-js`. The performance trigger is just running the same command after each performance, then committing the YAML config.

---

## 4. Runner-up: **Inspect AI**

Switch to Inspect AI if any of the following becomes true:

- **You start needing real Python in the eval loop.** Multi-step solvers (retrieval, tool use, sandboxed code execution), agentic flows, or chain-of-thought scoring — all of which Inspect handles natively. promptfoo can do these via custom JS providers but you're swimming against the current.
- **You need rigorous, schema'd logs that can be replayed and audited.** Inspect's `.eval` log format with a published JSON Schema is built for safety-team workflows. AISI uses it for frontier-model evals; that's a stronger guarantee than promptfoo's SQLite.
- **You add a second eval surface beyond pairwise** — say, a fact-checking eval against the human poem, or a stylistic-distance eval — and the eval logic gets gnarly enough that Python beats YAML.

Inspect would be the better choice for someone like Hamel Husain (engineer-author writing custom solvers); it's the slightly worse choice for Halim's Claude-Code-driven workflow today, but the migration path is clean (both are Python-friendly, both export structured JSON).

---

## 5. Day-One Workflow (5–7 commands Halim runs in Claude Code)

Goal: from a fresh `singulars/` repo with Supabase creds in `.env.local` to a printed first eval comparing two candidate models on hard.exe themes.

```bash
# 1. Install promptfoo globally (one time, persists across sessions)
npm install -g promptfoo

# 2. Scaffold an evals directory inside the repo
mkdir -p evals && cd evals && promptfoo init --no-interactive

# 3. Pull themes + human poems from Supabase into a CSV (Claude Code writes this script)
node ../scripts/pull-themes.mjs hard.exe > themes.csv
# script: SELECT theme, human_poem FROM performances p JOIN poems pm ON pm.performance_id = p.id WHERE p.slug = 'hard.exe' AND pm.author = 'human';

# 4. Replace promptfooconfig.yaml with the Singulars pairwise eval
#    (Claude Code writes this — see template below)

# 5. Run the eval (this is the load-bearing command; everything else is plumbing)
promptfoo eval -c promptfooconfig.yaml -o results.json

# 6. Print the comparison table to terminal + open the local UI
promptfoo view

# 7. Persist scores back to Supabase for the dashboard
node ../scripts/push-results.mjs results.json
```

### `evals/promptfooconfig.yaml` (the file Claude Code generates in step 4)

```yaml
description: Singulars pairwise — human poem vs candidate machine poems on hard.exe themes

prompts:
  - "Write a short poem on the theme: {{theme}}. No preamble, just the poem."

providers:
  - id: anthropic:messages:claude-sonnet-4-5-20251022
    label: claude-4.5
  - id: openai:chat:gpt-5-2026-03
    label: gpt-5
  - id: openrouter:google/gemini-2.5-pro
    label: gemini-2.5
  - id: file://providers/hard_exe.py # local fine-tuned model
    label: hard.exe

defaultTest:
  assert:
    - type: llm-rubric
      provider: anthropic:messages:claude-opus-4-5
      value: |
        You are judging two poems on the theme "{{theme}}".
        HUMAN POEM (reference):
        {{human_poem}}

        CANDIDATE POEM:
        {{output}}

        Rate the candidate 1-10 on: emotional resonance, formal craft,
        unexpectedness, and singular voice (not generic LLM cadence).
        Return JSON: { "score": <1-10>, "reasoning": "..." }.
        A score of 7+ means the candidate plausibly stands next to the human poem.

tests: file://themes.csv
```

For a true **A/B pairwise** vote (instead of absolute scoring against the human reference) swap the assertion for `select-best` and add the human poem as a fifth provider — promptfoo will pick the winner per theme and aggregate.

After step 7, the same `promptfoo eval` command becomes the post-performance trigger: run it once, push to Supabase, and the existing Singulars dashboard reads from the new rows.

---

## 6. Bottom-line recommendation

Use **promptfoo** today. It is the only tool in the field where Claude Code can take Halim from `git clone` to a real pairwise eval result against four models, with custom judge prompt and Supabase write-back, in under an hour and under 100 lines of glue code. Re-evaluate in 6 months — if the eval logic gets agentic or the audit/reproducibility requirements harden, port the YAML to an Inspect AI `@task` file.

---

## Sources

- [Inspect AI repo](https://github.com/UKGovernmentBEIS/inspect_ai) · [Inspect AI docs](https://inspect.aisi.org.uk/) · [Scorers reference](https://inspect.aisi.org.uk/scorers.html) · [Model providers](https://inspect.aisi.org.uk/providers.html) · [Hamel's review](https://hamel.dev/notes/llm/evals/inspect.html)
- [promptfoo repo](https://github.com/promptfoo/promptfoo) · [Model-graded metrics](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/) · [select-best](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/select-best/) · [LLM-rubric](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/) · [Output formats](https://www.promptfoo.dev/docs/configuration/outputs/) · [Python provider](https://www.promptfoo.dev/docs/providers/python/)
- [Braintrust eval SDK](https://www.braintrust.dev/docs/start/eval-sdk) · [autoevals](https://github.com/braintrustdata/autoevals)
- [W&B Weave evaluations](https://docs.wandb.ai/weave/guides/core-types/evaluations)
- [OpenAI Evals repo](https://github.com/openai/evals) · [OpenAI dashboard evals](https://platform.openai.com/docs/guides/evals)
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) · [LLM-as-judge issue #2233](https://github.com/EleutherAI/lm-evaluation-harness/issues/2233)
- [Phoenix repo](https://github.com/Arize-ai/phoenix) · [Phoenix evals](https://arize.com/docs/phoenix/evaluation/llm-evals)
