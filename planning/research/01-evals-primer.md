# Evals, explained for someone who isn't an engineer

## 1. What an eval actually is

An eval is the test that decides whether the model got better. That's it. When an engineer says "we ran the eval," they mean: we took the new version of the model, ran it through a fixed set of inputs, scored its outputs against some standard, and compared the score to the old version. If the number went up, the change was an improvement. If it went down, it wasn't. Everything else — the rubrics, the judges, the dashboards — is just plumbing in service of that one decision. An eval is the scoreboard you trust enough to ship against. Without one, "the model feels better" is a vibe, not a result, and vibes don't survive a few weeks of training runs.[^1]

## 2. The two foundations: golden data and judges

Every eval rests on two things.

The first is **golden data**: examples of what good looks like. Think of a wine-tasting panel preparing for a competition. Before they judge a single bottle, they pull out reference wines — the canonical Burgundy, the textbook Riesling — and re-anchor their palates. Those references are the golden set. They're the fixed point the rest of the tasting is measured against. In an eval, golden data is your collection of inputs paired with outputs that you, a human you trust, have decided are correct or preferred. It's small, hand-built, and precious.

The second is the **classifier** or **judge**: the rule that decides if a given output is good. At a track meet, the timer is the judge. It doesn't care how the runner felt or whether they ran with style — it answers one question: did they cross the line faster than the last time? A judge in an eval plays the same role. Sometimes it's a piece of code (does this output contain the right keyword?), sometimes it's a human, and increasingly it's another LLM reading the output and rendering a verdict. The judge has to be cheap enough to run thousands of times and consistent enough that the same input gets the same answer.

You need both. Golden data without a judge is a museum — beautiful, useless. A judge without golden data is a referee who's never seen the rulebook.

## 3. Why naive LLM-as-judge is the most common failure mode

The seductive shortcut is: "Let's just ask GPT-4 if the output is good." It feels like magic. It's fast, it scales, it sounds reasonable when you read the prompt. And it is, more often than people admit, completely wrong.

The problem isn't that LLMs can't judge. They can. The problem is that an uncalibrated LLM judge is a referee whose biases you've never tested. It might prefer longer outputs. It might prefer outputs that sound like itself. It might be confidently wrong about whether a poem rhymes. You won't know, because you never compared its verdicts against a human standard.

The working bar in the field is roughly **80–90% agreement with human judges** — measured on a held-out set of examples humans have already labeled.[^2] Below that, you're not measuring quality, you're measuring the judge's idiosyncrasies. Above it, you've earned the right to use the judge at scale. The order matters: you build a small human-labeled set first, _then_ you check whether the LLM judge agrees with humans, _then_ you trust it. Skipping the middle step is the single most common way evals lie to the team running them.

## 4. Two scoring paradigms: absolute vs pairwise

Once you have a judge, you have to decide what question to put in front of it.

**Absolute scoring** asks the judge to look at one output at a time and rate it against a rubric. "On a scale of 1–5, how vivid is this poem's imagery?" One model, one rubric, one number. This works well when you have a clear, objective standard — code that compiles, an answer that matches a known fact, a translation graded against a reference. It struggles when the thing you care about is taste, because the judge's internal scale drifts: yesterday's 4 is today's 3, and you only notice when the trendline lies to you.

**Pairwise preference** sidesteps the drift problem. You show the judge two outputs — model A and model B, anonymized — and ask: which one is better? You don't ask for a number, just a winner. Aggregate enough of these and you get a ranking. Humans are dramatically more reliable at this kind of relative judgment than at giving absolute scores, and so are LLMs.[^3] It's also how chess ratings, sommelier panels, and most reinforcement-learning-from-human-feedback systems actually work under the hood.

For Singulars, pairwise is the natural choice. You're not asking the audience "rate this poem 1–10." You're asking "which of these two poems do you prefer?" — the human one or the machine one. Vote counts _are_ pairwise preferences. Your eval should ride that same rail: when you're testing whether a new version of ground.exe got better, the judge should be asked which of two candidate poems is the more compelling response to a given theme, not asked to assign a vividness score in a vacuum.

## 5. The judge-the-judge problem

Here is the loop, drawn out plainly:

1. You and a small group of trusted humans label a few hundred examples. For Singulars, "label" means picking which of two poems is better, on a fixed set of theme + poem-pair inputs. This is your **human-labeled golden set**.
2. You write the LLM judge — a prompt that takes a theme and two poems and returns a winner.
3. You run the LLM judge over the same examples the humans labeled. You compute one number: how often does the judge agree with the humans?
4. If the agreement is below your bar (say, 85%), you do not deploy the judge. You revise the prompt, the model, or the rubric, and try again. Sometimes you discover that the humans don't even agree with each other — that's a signal too.[^4]
5. Only when the judge clears the bar do you let it loose on thousands of new comparisons.

This is the part most teams skip, and it's the difference between an eval that tells the truth and an eval that tells a flattering story.

## 6. Common pitfalls in plain language

- **Mismatched golden set.** Your golden examples don't look like the inputs the model will actually see in the wild. If your judge has only seen sonnets but ground.exe is generating free verse, the judge has no idea what it's looking at.
- **Drift over time.** You built your golden set in March. By September, your sense of "good" has evolved, the model has evolved, the audience has evolved — but the golden set hasn't. Your eval is now grading against a stale standard.
- **Evaluator asymmetry.** The judge subtly prefers one of the two things it's comparing — longer outputs, outputs that sound more like the judge model itself, outputs in position A versus position B. Always shuffle, always test for this, and always run the comparison both ways.[^5]
- **Classifier hallucination.** The judge makes up a reason. It says "Poem B is better because it uses iambic pentameter" — and Poem B is in free verse. LLM judges hallucinate just like LLM writers do. Spot-checking a sample of judge verdicts by hand is non-negotiable.

## 7. How this maps to Singulars

You already have most of the pieces, you just have to recognize them.

Every performance — carnation.exe, versus.exe, reinforcement.exe, hard.exe, reverse.exe — produces a stream of pairwise preferences from real audiences voting on real poems against real themes. That is, in eval terms, a continuously growing **human-labeled golden set**, generated by exactly the population whose taste you're trying to model. Most teams pay for this; you stage it as art.

Each performance is a new fold of training data — a fresh slice the model hasn't seen yet, captured under different conditions, with a different audience, in a different room. Folds let you train on some performances and hold out others as a clean test set, which is how you avoid fooling yourself into thinking the model learned taste when it actually just memorized hard.exe.

The classifier for ground.exe is, naturally, an LLM judge — but a calibrated one. You take a held-out slice of audience votes, run a candidate judge prompt over the same theme+pair inputs, and only deploy the judge once it agrees with the audience often enough. From that point on, the judge can score thousands of new poem candidates per training run, and you only have to spot-check it. The audience built the standard; the judge scales it.

That's the whole stack: people vote, votes become the golden set, the LLM judge gets trained against that set, the eval rides on top, and ground.exe gets better — or doesn't — in a way you can actually measure.

---

## What to ask your eval engineer

- **Show me the golden set.** How many examples, who labeled them, and how representative are they of what the model will actually face on stage?
- **What's the judge-vs-human agreement rate?** If it's not 80%+, why are we trusting the judge's verdicts?
- **Absolute or pairwise — and why?** If we're chasing audience preference, the eval should be pairwise. If it isn't, defend the choice.
- **What's our drift plan?** When and how do we refresh the golden set, recalibrate the judge, and re-run the baseline so April's wins still mean something in October?

[^1]: Hamel Husain, "Your AI product needs evals" (2024) — the canonical argument that without an eval loop, ML teams optimize on intuition and ship regressions. https://hamel.dev/blog/posts/evals/

[^2]: Zheng et al., "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena" (NeurIPS 2023) — the paper that established the agreement-with-humans bar and showed strong LLM judges can hit ~80%+ agreement, comparable to human-human agreement. https://arxiv.org/abs/2306.05685

[^3]: Christiano et al., "Deep Reinforcement Learning from Human Preferences" (NeurIPS 2017) — the foundational result that pairwise preference data is more reliable than absolute scoring for training models toward human taste. https://arxiv.org/abs/1706.03741

[^4]: Eugene Yan, "Evaluating LLM-based applications" (2024) — practical writeup of the judge-the-judge loop, including the case where inter-human agreement bounds what's achievable. https://eugeneyan.com/writing/evals/

[^5]: Zheng et al. (op. cit.) document position bias, verbosity bias, and self-preference bias in LLM judges, with mitigations including swapping order and running both directions.
