---
name: pre-push-checks
description: Use before pushing, force-pushing, marking a PR ready, or claiming checks pass on a branch, to select the smallest tests and gates that cover the outgoing diff instead of reflexively running the full suite.
---

# Pre-Push Checks

Local checks exist to fail fast on what you changed; CI owns exhaustive coverage and the platform matrix. Run each relevant check once, then push. Never push and wait for CI to tell you something a local check would have caught. Git hooks run at most a narrow fixed floor (staged lint, whitespace); their green is necessary, never sufficient.

## Inspect the outgoing change

1. Confirm the checkout, branch, and the PR's live base ref — fetch it; never guess a base.

```sh
git status --short --branch
git diff --name-only origin/<base>...HEAD
```

2. Staged, unstaged, and untracked files that will join the push count as scope too. After merging a changed base, re-derive the scope and rerun only the checks the merge invalidated — not everything.

## Select the narrowest evidence

Match evidence to the surface the diff actually reaches:

- **Source behavior** — the owning test file or focused test name, through the project's real runner. Add adjacent tests only when a shared contract changed.
- **Docs, notes, prose** — `govkit check --only md-wrap,md-links,doc-budgets`, plus `note-format,note-classification,note-archive-seal` when `.agents/notes/` changed.
- **Config, manifests, gate wiring** — `govkit check` plus the build. A change to a gate must demonstrate red on an invalid case, not only green on the valid tree.
- **User- or model-visible output** — the snapshot or scenario owning that output, updated in the same change.
- **No local equivalent exists** — say so plainly and justify it; do not substitute the full suite as a reflex.

Never default to the full suite, and never re-run a check that already passed on the same tree merely because a push follows.

## Escalate from failure evidence

A failure widens the net: first the smallest test that reproduces it, then the packages the failing surface reaches, then — only when no narrower set is credible — the full local rehearsal. Escalation is driven by evidence, not anxiety.

## Handle failures

A relevant local failure stops the push. Fix it, or state the blocker plainly. "Environment-specific" is a claim that needs proof: record the exact command, the failing case, the platform mismatch, and which non-platform evidence still passes. Do not bypass a failing gate to push anyway — CI differing is a hypothesis to verify, never a detour around red.

## Push procedure

1. Run the selected checks once.
2. Commit; inspect anything a pre-commit fixer touched.
3. Push, then verify the remote ref matches local `HEAD`:

```sh
git rev-parse HEAD origin/$(git branch --show-current)
```

4. For PRs, inspect remote CI (`gh pr checks`). Report pending checks as pending; read failures before attributing them to the branch or the environment.

A history-rewriting push requires lease protection (`--force-with-lease=<branch>:<observed-oid>`); raw `--force` is never acceptable. After any rewritten push, re-fetch and re-audit checks and review threads — evidence from before the rewrite is not current.
