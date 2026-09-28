---
name: trim-cot-leakage
description: Use when auditing or fixing prose that reads like a leaked reasoning transcript — dead design-session citations, change narration, references to uncommitted drafts, audit codes, review choreography, or planning residue in comments, docs, or decision records.
---

# Trimming Chain-of-Thought Leakage

AI-assisted authorship leaks the session into the text: citations only that session could resolve, narration of the change instead of the state, arguments with reviewers who have left. The fix is restate-then-delete: restate every surviving fact so it stands at HEAD, then delete the transcript around it. A passage with no surviving fact is deleted outright.

## The one test

Could a reader at HEAD — with no access to any session transcript, PR thread, or uncommitted draft — resolve every reference and verify every claim? If no, the passage is leakage. If yes, it clears this bar, though change narration still moves to its proper home (commit message, decision record, changelog).

## Taxonomy, with before/after

1. **Dead design-session citations** — `(decision 3)`, `(audit item B2)`, `design §4.7`, phase labels (`T4`, `W3`).
   - Before: `Uses the ring buffer chosen in (decision 3).`
   - After: `Uses the ring buffer specified in .agents/notes/implemented/architecture/2026-05-02-stream-buffer.md.` If no committed artifact owns the decision, delete the citation and let the fact stand alone.
2. **Change narration and version stamps** — "used to", "no longer", "the old X", "now", "this cut".
   - Before: `The cache used to be unbounded; it is now capped at 256 entries.`
   - After: `The cache holds at most 256 entries.`
3. **Uncommitted-draft references** — "see design §N", "the plan doc", working files that never landed.
   - Before: `Retry steps follow design §4.2.`
   - After: `Retry steps follow docs/recovery.md#retry-policy.` Cite a committed document by path, or restate the ladder itself.
4. **Audit codes and round ordinals** — `(item B2)`, `v5 of this note`, "review round 2".
   - Before: `Guard added in review round 2 (audit B2).`
   - After: `The guard rejects zero-length frames before allocation.` Keep the invariant, delete the archaeology.
5. **Reviewer-addressed justification** — comments arguing their own correctness.
   - Before: `This cast is safe — it simply narrows after validation, as discussed.`
   - After: `validateFrame() guarantees a positive length at this point.` State the invariant, or delete when the code shows it.
6. **Planning residue and hedges** — "probably fine for now", "should be enough", orphan deferrals.
   - Before: `Probably fine for now.`
   - After: `FIXME: bound unverified above 10^6 entries.` Promote to a marker with an owner, or verify and delete.

## What is not leakage

Apply these keep rules as written; unaided citation purges fail in both directions:

- **Issue references** — `#1470`, `TODO(name):` resolve at HEAD; keep them anywhere.
- **Suppression justifications** — lint-disable reasons, coverage-ignore comments, empty-catch explanations are required prose; fix a false reason, never delete it.
- **Counterfactual-present regression pins** — "without this check, empty frames allocate 4 GiB".
- **Measured bounds** — "(measured: 512 levels ≈ 0.15 s)"; the evidence word is load-bearing.
- **Runtime old/new states** — "the old connection drains before the new one accepts" describes a lifecycle, not history.
- **Merged evidence inside decision records and postmortems** — PR and issue citations are sanctioned there.

## Workflow

1. Audit read-only first: search the patterns above, then also read the densest prose in scope — batteries never catch everything.
2. Before deleting anything, enumerate the passage's propositions (see `prose-standard`) and restate the survivors.
3. Never touch sealed archives (`.agents/notes/archived/`) or vendored trees.
4. Verify: rerun the searches expecting only sanctioned keeps, then `govkit check --only md-wrap,md-links`.
