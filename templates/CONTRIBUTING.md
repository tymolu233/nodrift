# Contributing — the one-page rules

Each rule is 1-3 lines and states only the hard requirement; explanation and examples live in the linked authority and are never repeated here.

## Hard rules

1. **CI is the only authority**: lint, typecheck, and tests are enforced in CI; the default branch is protected, direct pushes are forbidden.
2. **Strict by default**: full strict mode on; no new `as unknown` / `# type: ignore` escapes (existing debt enters a baseline freeze, see `docs/verify-rules.md`).
3. **Switch on discriminant tags**: closed unions end in an exhaustiveness check (`assertNever` or equivalent).
4. **Cross-module identifiers are named types** — never bare strings (branded type / newtype / class).
5. **Extension points over core edits**: new behavior hangs off interfaces, events, hooks; changing a core module updates the architecture doc in the same PR.
6. **Configuration resolves explicitly**: defaults live in one `resolve()` step; no scattered implicit `?? default`.
7. **Exceptions are never silent**: an empty catch names its error and why; one `try` wraps one statement.
8. **Docs state current fact only**: no "implemented!" / "used to" / "planned" status words; one fact has one home, everything else links to it.
9. **Decisions are recorded**: lasting architecture decisions are written to `.agents/notes/` in the same PR as their implementation (format and lifecycle: `.agents/notes/README.md`).
10. **Tests verify the world**: assertions go through real entry points and re-check external effects; mock only expensive or nondeterministic edges; user-visible output is pinned by snapshots.

## Authority documents

- Architecture map: `<docs/architecture.md>` (yours to write — not shipped)
- Testing policy: `<docs/testing.md>` (yours to write — not shipped)
- Mechanical-rule inventory: `docs/verify-rules.md`
- Decision notes: `.agents/notes/README.md`

> Word budget: this file stays at or under 800 words. Over budget? First relocate to the authority document, then compress; raising the budget is the last resort and is argued in the PR.
