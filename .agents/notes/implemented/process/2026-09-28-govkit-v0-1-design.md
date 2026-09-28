# Agent Note: govkit v0.1 design
Status: implemented

## Problem

DeepSeek Harness ran 19,358 commits in 3.5 months with heavy AI authorship without decaying, because its rules are executable and its memory is institutional — but that system is entangled with one stack (Cordis, pnpm workspaces, a ~300-package monorepo), and nothing portable existed that a small or non-TypeScript project could adopt on day one.

## Decision

anti-shishan-kit ships a two-layer package: a hand-copiable static template layer (L0) plus a `govkit` CLI carrying the mechanisms that cannot live in files (L1/L2), with mechanisms ported from deepseek-harness (MIT; see NOTICE) and generalized: the notes lifecycle tree with strict in-file format and a sealed append-only archive (`src/notes/`, from scripts/agent-note-tree.ts and the verify-agent-note/archived-agent-notes gates); Markdown wrap/link gates and word budgets with a 5%-headroom ratchet (`src/gates/`, from the verify-md/doc-budgets gates); a generic ratchet pairing a regex rule with SHA-256 occurrence fingerprints and a baseline JSON (`src/ratchet/`, generalizing verify-no-unknown-casts); the corpus sentinel, which fails any gate admitting fewer files than its `minCorpus` (`src/runner/runner.ts` — the harness rule "a gate whose discovery narrows goes red" made structural); an explicit enabled-set, where a gate runs only when govkit.yml names it and unknown ids throw (`src/gates/registry.ts`); and the single-verdict CI pattern shipped as a workflow fragment (`templates/.github/workflows/ci-verdict.yml`).

## Alternatives considered

- **Fork the harness scripts tree** — most of its gates are Cordis/pnpm-bound, so a fork would ship the entanglement it claims to escape.
- **Static templates only** — the strongest mechanisms (ratchet baselines, archive sealing) are impossible without code.
- **Go/Rust single binary first** — real for cross-language reach, but the source material is TypeScript and the mdast ecosystem is mature; single-binary packaging stays on the roadmap.
- **Bilingual note triplets** — the harness's en/zh/i18n.yaml triple is its strongest repo-specific binding; v1 notes are single-file with sidecars optional.

## Consequences

The kit is its own first customer: every shipped gate runs on this repository, `npm run coverage` holds `src/**` at per-file 100%, and NOTICE plus this note carry the provenance map. Deferred to the roadmap: doc-code-block compilation, process-tree fail-fast for custom gates, bilingual pairing, copier distribution, recorded-session replay testing.
