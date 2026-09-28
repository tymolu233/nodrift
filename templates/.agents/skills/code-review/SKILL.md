---
name: code-review
description: Use when reviewing a pull request — orients to a blocker-over-nit posture and the review checks code alone cannot show: docs parity, registration disposal, scenario-proving tests, decision-record upkeep.
---

# Code Review

Prioritize correctness, lifecycle, security, and broken required behavior over style. **A short review with one substantiated blocker beats a long list of nits.** Read the diff plus enough surrounding code to understand the design; a file list is not a review. Do not spend review comments on what a green gate already enforces — check `anti-shishan check --list` first.

## Sources of truth

- The repository constitution (`AGENTS.md`) and the docs it points to.
- `.agents/notes/` for decision rationale. Disagreement with a decision record is a design discussion: quote the record, argue from current evidence, and if the record loses, this PR updates it. It is never an automatic veto — and never silently ignored either.

## Blocking checklist

Block on any of these:

1. **Docs did not ship with the code.** Behavior, configuration, defaults, or errors changed without the owning README / docs / comments in the same diff.
2. **Registrations lack disposal.** Every new registry contribution, subscription, timer, or callback has its disposer — and a test that exercises the cleanup.
3. **Tests do not prove the scenario.** Assertions restate the implementation, mock the thing they claim to verify, or only raise coverage numbers. Require: the test fails on the intended regression and observes an externally visible effect. Coverage is necessary but not evidence the scenario is correct.
4. **The PR lies about its scope.** Unrelated refactors, drive-by formatting, more than one intent. Split it.
5. **A gate was removed or weakened without its justification.** Deleting a gate, widening an exclusion, raising a doc budget, or growing a ratchet baseline — each requires the written justification its config demands, in the PR description.
6. **A decision record went stale.** The change silently contradicts an active note in `.agents/notes/`; the note is updated or superseded in the same PR, facts kept current, links repaired.

## Manual checks the gates cannot do

- Trace both sides of every changed interface: errors, cancellation, ownership, disposal.
- For async setup, callbacks, processes, or teardown: races before publication, cancellation during awaits, quiescent cleanup.
- Map each abstraction to its current consumer; challenge speculative generality with the same force as dead code.
- Follow every denial path to the operation that enforces it, and look for callers that bypass it.
- Ask what evidence supports each new default, flag, or public API shape.

## What is not a blocker

Nits — naming you would have chosen differently, optional style, a reshuffle with no behavioral stake — are suggestions: phrase them as questions, mark them clearly, and let the author decline them freely. Never pad a review with nits to look thorough, and never mix them into a blocking thread where they dilute the one thing that must change.

## Reporting findings

State defect, location, impact, evidence. Localized defects go inline on the tightest diff range; cross-cutting concerns go in a PR-level comment. Separate blockers from suggestions explicitly — suggestions are free to decline, blockers name the rule or broken scenario they rest on.

When receiving review: verify each claim against the code before acting. Fix what is right, rebut what is wrong on technical grounds, and never perform agreement.
