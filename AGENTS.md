# AGENTS.md

The hard rules of this repository, for humans and agents. Every rule fits in 1-3 lines and links its home; detail never lives here. anti-shishan-kit is both a product (the anti-shishan CLI + templates) and its own first customer: every mechanism it ships runs on this repository.

## Commands

- Test: `npm test` · Build: `npm run build` · Lint: `npm run lint` · Typecheck: `npm run typecheck`
- Coverage gate: `npm run coverage` — per-file 100% on `src/**`; an uncovered defensive line earns an `/* v8 ignore ... -- reason */` comment, never a lower threshold
- Self-governance: `npm run check` (builds, then runs anti-shishan on this repository)

## Conventions

1. **Misconfiguration fails loud**: unknown config keys, unknown gate ids, missing referents — load-time errors, never silent skips (`src/core/config.ts`, `src/gates/registry.ts`).
2. **A gate reports its corpus**: the runner fails any gate admitting fewer files than its `minCorpus` — a gate that found nothing to check reads red, not green (`src/runner/runner.ts`).
3. **Every gate names what it proves and does not prove** in its `doc` line: `anti-shishan check --list`.
4. **Every gate ships tests covering 100% of its module**; a gate without tests cannot be trusted (`tests/`).
5. **NodeNext ESM**: relative imports carry `.js`; strict + noUncheckedIndexedAccess, no unexplained `any` (tsconfig.json).
6. **Docs ship with their code** in the same commit; one physical line per Markdown paragraph.

## One fact, one home

- Decisions and the alternatives they beat → `.agents/notes/` (format governed by note-format)
- Frozen decisions → `.agents/notes/archived/` (sealed; append-only via note-archive-seal)
- Distribution content → `templates/` (installed copies stay byte-identical, rendered placeholders excepted)
- Process how-tos → `docs/`; agent operating skills → `templates/.agents/skills/`

## Before you push

`npm run coverage` and `npm run check` must both be green; CI reruns everything behind the single `all-checks-passed` verdict.
