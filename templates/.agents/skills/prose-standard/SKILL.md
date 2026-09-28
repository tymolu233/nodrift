---
name: prose-standard
description: Use when writing, reviewing, trimming, or auditing prose — comments, JSDoc, READMEs, prompts, descriptions, diagnostics, UI strings — to keep complete contracts, drop reasoning transcripts, and ship docs in the same commit as the code.
---

# Prose Standard

Comments and docs state complete contracts — never a reasoning transcript, never a restatement of the code. A contract is an obligation, invariant, precondition, postcondition, or compatibility promise that a caller, implementer, or maintainer relies on. This skill is editorial judgment, not a script; for AI-writing residue specifically, see [trim-cot-leakage](../trim-cot-leakage/SKILL.md).

## The complete-proposition rule

Before trimming any passage, enumerate its propositions and preserve every relevant one: actor and action; condition, timing, ordering; modality (must / may / never); negative guarantees and exceptions; ownership, side effects, failure modes, consequences. Remove adjectives, repetition, and narration only after every factual clause survives. A smaller word count alone is not an improvement.

Keep one complete local contract at the point of use — behavior, failure, ownership — and link to the owning document for rationale and extended examples. One explanation has one home; essential facts may repeat locally, derivations may not.

## Required coverage by location

Add or restore prose when code and types do not already communicate these:

- **Public API docs** — return distinctions, throws/rejections, side effects, ownership, timing, cancellation, durability; parameter and return meaning.
- **Internal comments** — non-obvious structure only: invariants, race ordering, ownership, security boundaries, surprising failure behavior. Delete control-flow narration and code restatement.
- **READMEs** — the consumer contract: configuration, semantics, failures, limitations, extension points.
- **Tests** — only non-obvious test design: why a fixture, platform accommodation, or indirect observation is necessary. Never a walkthrough.
- **Diagnostics** — name the failing subject, the violated rule, and the correction when it is non-obvious. Remove execution narration.
- **Prompts and visible strings** — wording is behavior; change it only with owning behavior evidence, updating the snapshot in the same commit.

## Words that fail review

Vague words hide missing facts. Replace each with the concrete actor, value, or condition:

- **"provenance" / "origin"** for data — name the actual producer (file, flag, request field).
- **"appropriate" / "proper" / "reasonable"** — state the criterion.
- **"currently" / "new" / "soon" / "recently"** — state the fact or the version; time words rot silently.
- **"etc."** — enumerate or delete.
- **"probably" / "should work"** — promote to a `TODO`/`FIXME` with an owner, or verify and delete.
- **"obviously" / "clearly"** — if it were, the sentence would be unnecessary.

## Format rules

- One paragraph per physical line; diffs stay sentence-sized (enforced by the `md-wrap` gate).
- Every file ends with exactly one newline.
- Present-tense current fact only. Change narration ("used to", "no longer") belongs in commit messages and decision records, not in docs.
- Every fact lives in exactly one place; everywhere else links to it.

## Workflow

1. Read the owning code or document before judging a passage.
2. Classify each candidate: keep, add, trim, restore, restructure, or defer. Apply clear edits; flag genuine trade-offs instead of weakening a fact to resolve them.
3. Docs ship in the same commit as the behavior change they describe — a doc-only follow-up PR is a bug.
4. After learning a new rule, re-check analogous passages; re-run the narrow prose gates: `anti-shishan check --only md-wrap,md-links,doc-budgets`.
