/**
 * Per-call cost estimator for eval runs (US-107) and fine-tune jobs (US-123).
 * Numbers ground in research/06 §8 - approximate but stable enough for the
 * "estimated $X.XX" preview the form shows before submit.
 */

export type EvalEstimateInput = {
  n_themes: number;
  n_candidates: number;
  n_per_theme: number; // generations per theme per candidate
  judge_model: string; // provider:model
};

// Rough per-million-token costs in USD. Used only for the estimator.
const TOKEN_COST_PER_M_USD: Record<string, { input: number; output: number }> =
  {
    "openai:gpt-5-5": { input: 1.5, output: 6.0 },
    "openai:gpt-4o-mini": { input: 0.15, output: 0.6 },
    "anthropic:messages:claude-opus-4-7": { input: 15, output: 75 },
    "anthropic:messages:claude-sonnet-4-7": { input: 3, output: 15 },
    "openrouter:google/gemini-3.1-pro": { input: 1.25, output: 5 },
    "openrouter:deepseek/deepseek-r1": { input: 0.55, output: 2.19 },
  };

const DEFAULT_COST = { input: 1.0, output: 4.0 };

const TOKENS_PER_GENERATION = 800; // poem out
const TOKENS_PER_JUDGE_INPUT = 1200; // theme + 3 poems
const TOKENS_PER_JUDGE_OUTPUT = 250; // ranking + rationale

export function estimateEvalCostUsd({
  n_themes,
  n_candidates,
  n_per_theme,
  judge_model,
}: EvalEstimateInput): number {
  const judge = TOKEN_COST_PER_M_USD[judge_model] || DEFAULT_COST;
  // Generation cost: assume avg per candidate (use default rate).
  const genIn = TOKENS_PER_JUDGE_INPUT;
  const genOut = TOKENS_PER_GENERATION;
  const genCostPer =
    (genIn / 1_000_000) * DEFAULT_COST.input +
    (genOut / 1_000_000) * DEFAULT_COST.output;

  // Judge cost: 2 calls (A/B swap).
  const judgeCostPer =
    2 *
    ((TOKENS_PER_JUDGE_INPUT / 1_000_000) * judge.input +
      (TOKENS_PER_JUDGE_OUTPUT / 1_000_000) * judge.output);

  const total =
    n_themes * n_candidates * n_per_theme * (genCostPer + judgeCostPer);
  return Math.max(total, 0);
}

export type FinetuneEstimateInput = {
  n_training_rows: number;
  tokens_per_row: number;
  n_epochs: number;
  provider: "openai" | "together" | "huggingface";
  base_model: string;
};

const FINETUNE_COST_PER_M: Record<string, number> = {
  "openai:gpt-4o-mini-2024-07-18": 3.0,
  "openai:gpt-4.1-2025-04-14": 25.0,
  "openai:gpt-3.5-turbo-1106": 8.0,
  "together:meta-llama/Llama-3.3-70B-Instruct": 5.0,
  "together:Qwen/Qwen3-14B": 1.0,
  "together:mistralai/Mistral-Nemo-Instruct-2407": 1.0,
  "huggingface:default": 0.5,
};

export function estimateFinetuneCostUsd(input: FinetuneEstimateInput): number {
  const key = `${input.provider}:${input.base_model}`;
  const rate =
    FINETUNE_COST_PER_M[key] ||
    FINETUNE_COST_PER_M[`${input.provider}:default`] ||
    1.0;
  const totalTokens =
    input.n_training_rows * input.tokens_per_row * input.n_epochs;
  return (totalTokens / 1_000_000) * rate;
}
