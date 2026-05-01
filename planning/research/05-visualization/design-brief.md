# Singulars Eval — Visualization Design Brief

**Author:** Data-viz designer
**Date:** 2026-04-30
**Audience:** Halim Madi
**Project:** Singulars / ground.exe model evolution chart

---

## The problem with loss curves

The default object an ML practitioner reaches for when asked "is the model getting better?" is a loss curve — `train_loss` and `eval_loss` plotted against `step`. For an engineer that picture is dense with information: convergence shape, overfitting onset, learning-rate decay artefacts. For an audience that came to a poetry performance, it is closer to a graph of a foreign currency they don't trade. The y-axis is unitless. The x-axis is in steps, not events they witnessed. Lower is better, which is the opposite of every chart they read in their daily life. And the underlying question the audience actually has — _did the model that read our votes get better at writing poems we'd vote for?_ — is exactly the question the loss curve cannot answer, because loss is computed on a held-out subset of the training corpus, not against the human-voted winners from the night.

The Singulars eval, as specified in `02-poetry-classifiers-and-eval-design.md`, is built around a unit that _does_ speak to that question: the four-tuple `(performance_slug, theme_slug, winner_poem, loser_poem)`, with the audience-voted winner as gold. The headline metric falls out: **pairwise win-rate against human-voted winners**, sliced per model and per performance. That metric maps onto a chart the audience already knows how to read — a percentage, on a 0-100% axis, plotted against events they personally attended. The five-second read becomes possible: _the line for ground.exe rises from carnation.exe to ground.exe; the lines for Claude Opus and GPT-5 stay flat. The model the audience trained is becoming the model they vote for._

That is the chart. Everything below is in service of making it visually unmistakable.

## What the audience walks away understanding in 5 seconds

View 1 — the **Model Evolution Chart** — is engineered around a single sentence the visitor should be able to speak after a glance:

> "The thing they're building keeps winning more, and the big closed-source models stay where they are."

To deliver that sentence in five seconds, three things have to be true on first paint:

1. **The ground.exe line is the most visually salient.** It is the only line that ends at the rightmost x-tick (June 12, 2026, ground.exe). Every other line either stops earlier (the previous fine-tunes, which are frozen at their performance) or runs flat across the whole plot (the closed-source baselines).
2. **The performance dots are colored.** Each performance has a brand color stored in `performances.color` (carnation `#F6009B`, versus `#FEE005`, reinforcement `#02F700`, hard `#2AA4DD`, reverse `#8B5CF6`, ground `#D97706`). When the visitor's eye lands on the chart, those dots are the only color in an otherwise monochrome plot — the rest of the page is black-on-white per the existing oulipo.xyz aesthetic. This is restraint as wayfinding: the colored dots are the _only_ attention attractors, and they correspond exactly to the events the visitor remembers.
3. **The y-axis is win-rate, labelled `vs. audience winners`.** Not "score." Not "accuracy." Not "metric." The phrase "vs. audience winners" makes the comparison concrete and earns the chart's claim — the line is rising against the very poems that beat the model on the night.

View 2 — the **Head-to-Head Matrix** — is the long-form companion. It exists so the curious visitor who liked View 1 can drill into _why_: which performances does ground.exe handle well, which does it still lose on. The headline insight is again colour-driven: cells corresponding to `(ground.exe, hard.exe)` and `(ground.exe, reverse.exe)` should be visibly more saturated than the same cells for `(carnation.exe v0, hard.exe)`. The matrix is restrained — it borrows the typographic conventions of a chess scoresheet rather than a heatmap dashboard.

View 3 — the **Admin Preview** — closes the loop. After every performance Halim runs an eval, sees a private preview of how the public chart will look with the new run, toggles which models or performances should be visible, marks the run as published, and the public site updates. This is where the artistic agency lives: the audience sees a curated story, not a streaming dashboard.

## Mobile vs. desktop considerations

The oulipo.xyz layout caps content at 800px and pads to 4rem. Both public views must work inside that container. View 1's line chart is the easier of the two; the chart has six x-ticks and a bounded y-range, so even at 360px wide each tick gets ~60px of horizontal space — readable, with rotated tick labels if needed. The legend moves below the plot at narrow widths.

View 2's matrix is the constrained case. With ~8 candidate models × 6 performances, a fully labelled grid is 48 cells. On desktop that's a comfortable 7-row × 6-col table at ~110px cell width. On mobile (<600px) the table needs to either (a) drop the closed-source baselines into a separate "Reference" subgroup that collapses by default, or (b) become horizontally scrollable with a sticky first column carrying model names. I've gone with (b) because the matrix's whole point is _comparing across the row_, and forcing the reader to swipe is a cleaner signal than hiding rows. The cells stay ~80px square at minimum so the win-rate number remains tappable. Tapping a cell still drills into theme-level results in a sheet that takes the full viewport.

View 3 is admin-only and assumed desktop — Halim is editing this on a laptop after a show, not from his phone. The layout matches the existing `/theme-voting/admin` page: max-width 800px, the same `monoStyle` / `pageStyle` constants, the same checkbox-row affordance for toggling visibility. Buttons mirror `btnPrimaryStyle` and `btnSmallStyle` from that file exactly.

## Accessibility

Three concrete commitments:

1. **Color-blind safety.** The six performance colors as stored are not all distinguishable under deuteranopia or protanopia — `#02F700` (green) and `#FEE005` (yellow) collapse together, and `#F6009B` (pink) and `#D97706` (amber) drift toward the same earthy red. Color is therefore _redundant_: every line in View 1 carries a small text label at its right end with the model name, and every dot has the performance name underneath in monospace at the x-tick position. Color is wayfinding, not the only signal. View 2's cells encode win-rate twice — by hue saturation _and_ by the printed percentage in the cell. Anyone reading at all reads the number; the saturation is a glance-level cue.

2. **Screen-reader narration.** Each chart has a `<title>` and `<desc>` describing the headline insight in prose ("Model evolution chart. Win rate against audience-voted winners, plotted across six performances. Ground-dot-exe rises from forty-one to seventy-three percent; closed-source baselines stay between fifty-five and sixty-two percent.") — generated server-side from the same numbers the chart renders. The matrix uses `<table>` with proper `<th>` row/column headers, so a screen reader can navigate cell-by-cell and hear "ground.exe, hard.exe, sixty-eight percent." Hidden visually but exposed to AT.

3. **Contrast.** The performance colors at full saturation do not all meet WCAG AA against white. The codebase already solves this — `accessibleTextColor()` in `src/lib/color-utils.ts` darkens a color until it hits 4.5:1. Use it for any color that lands on text. Dot fills can stay at full saturation (3:1 minimum is enough for non-text UI per `accessibleUIColor()`). Hover states on dots use `accessibleTextColor()` for the surrounding tooltip text.

## Tone — this is art, not a dashboard

The thing the chart must _not_ look like is a Datadog overview. The existing oulipo.xyz aesthetic is the brief:

- **Generous whitespace.** The landing page (`src/app/page.tsx`) uses `padding: 4rem 2rem` and a max-width of 800px. The chart sits inside that, with no wrapping container chrome.
- **Mono labels at small sizes with letter-spacing.** Every label that names a category (`PERFORMANCE`, `WIN RATE %`, `MODEL`) is `"Diatype Mono Variable"` at 0.75rem, uppercase, with `letter-spacing: 0.05em`. This is the same convention used for the `statLabelStyle` in the admin page and the status pills on the landing page.
- **Terminal Grotesque for the page title only.** The chart itself does not need a chunky display font. The page header (`Model Evolution`) follows the same pattern as `Singulars` on the landing page — Terminal Grotesque, 4-7rem, 0.9 line-height — and then immediately the typography quiets down.
- **Black on white. No card backgrounds. No drop shadows. No gradients.** The single border of `1px solid var(--border-light)` (which is `rgba(0,0,0,0.12)`) is the entire visual containment system on the existing site. The charts use a single 1px axis line, tick marks, and that's it.
- **Color is reserved.** The whole page is grayscale until the performance dots appear. This mirrors the landing-page hero image — black-and-white by default, color on hover. The chart inherits the same conceit: color appears at the moments the audience created.
- **No animation on first load.** The line draws in instantly. No "easing" of bars from zero. Animation reads as marketing chrome on this site. Tooltips can fade, that's it.

The chart should feel like a page from a printed essay, not a live operations panel. If a visitor scrolled past it without realizing it was interactive, that would be acceptable; the static read is the primary read. Hover and tap are bonuses for the curious.

## What I am NOT building

A few choices made deliberately:

- **No loss curve, no perplexity, no train/eval split chart.** Those answer "is training going well?" — an engineering question the audience does not have. They live in the admin view at most, and even there I've opted to show _time since last eval_ and _last published run_ rather than internal training metrics.
- **No Elo / Bradley-Terry score.** Pairwise win rate is more legible. Elo deltas confuse a non-technical reader (why is Claude Opus at 1740? what does that mean?). Win rate is a percentage. Everyone reads percentages.
- **No "ground.exe is winning" celebration.** The chart shows the data; the visitor decides what it means. Halim's voice in the project is restrained and slightly skeptical of triumphalism. The chart matches that — no green checkmarks, no upward-pointing arrows, no comparative call-outs.

## How this hooks into the codebase

Both public views (1 and 2) drop into `/singulars/evolution` (or wherever Halim chooses to slot them — `/singulars/about/evolution` is also a fit). They consume the JSON shape specified in `data-spec.md`, which is fed by `/api/evals/results`. The admin view (3) lives at `/singulars/admin/evals` behind the same cookie auth used by `/api/themes/admin/auth`. All three views use the existing CSS variables and font stack — they do not introduce new design tokens. They use inline `React.CSSProperties` exactly as the rest of the codebase does.

The five-second read is the contract. Every other consideration — tooltip detail, mobile breakpoint, screen-reader narrative — exists to keep that contract honest under the conditions that don't get five seconds.
