# Agent Note: shitcode v0.1 design
Status: implemented

## Problem

DeepSeek Harness ran 19,358 commits in 3.5 months with heavy AI authorship without decaying, because its rules are executable and its memory is institutional — but that system is entangled with one stack (Cordis, pnpm workspaces, a ~300-package monorepo), and nothing portable existed that a small or non-TypeScript project could adopt on day one.

## Decision

anti-shitcode-kit ships a two-layer package: a hand-copiable static template layer plus an `shitcode` CLI carrying the mechanisms that cannot live in files, with mechanisms ported from deepseek-harness (MIT; see NOTICE) and generalized: the notes lifecycle tree with strict in-file format and a sealed append-only archive (`src/notes/`, from scripts/agent-note-tree.ts and the verify-agent-note/archived-agent-notes gates); Markdown wrap/link gates and word budgets with a 5%-headroom ratchet (`src/gates/`, from the verify-md/doc-budgets gates); a generic ratchet pairing a regex rule with SHA-256 occurrence fingerprints and a baseline JSON (`src/ratchet/`, generalizing verify-no-unknown-casts); the corpus sentinel, which fails any gate admitting fewer files than its `minCorpus` (`src/runner/runner.ts` — the harness rule "a gate whose discovery narrows goes red" made structural); an explicit enabled-set, where a gate runs only when anti-shitcode.yml names it and unknown ids throw (`src/gates/registry.ts`); and the single-verdict CI pattern shipped as a workflow fragment (`templates/.github/workflows/ci-verdict.yml`).

## Alternatives considered

- **Fork the harness scripts tree** — most of its gates are Cordis/pnpm-bound, so a fork would ship the entanglement it claims to escape.
- **Static templates only** — the strongest mechanisms (ratchet baselines, archive sealing) are impossible without code.
- **Go/Rust single binary first** — real for cross-language reach, but the source material is TypeScript and the mdast ecosystem is mature; single-binary packaging stays on the roadmap.
- **Bilingual note triplets** — the harness's en/zh/i18n.yaml triple is its strongest repo-specific binding; v1 notes are single-file with sidecars optional.

## Consequences

The kit is its own first customer: every shipped gate runs on this repository, `npm run coverage` holds `src/**` at per-file 100%, and NOTICE plus this note carry the provenance map. The CLI was designed as `govkit` and renamed `shitcode` before first publication (2026-09-28) because npm already hosts an unrelated `govkit` package; the package name `anti-shitcode-kit` was free and its matching bin name gives `npx anti-shitcode-kit init` for new projects. An early `--level` installer split was reversed the same day — see [`2026-09-28-init-drops-levels.md`](../simplification/2026-09-28-init-drops-levels.md). Deferred to the roadmap: doc-code-block compilation, process-tree fail-fast for custom gates, bilingual pairing, copier distribution, recorded-session replay testing.
