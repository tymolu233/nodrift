<!--
AGENTS.md template — installed by `anti-shishan init --level 1` or later, or copied
by hand. Replace every <placeholder>.

This file carries a word budget enforced by anti-shishan's doc-budgets gate (default
2000 words; the template ships far below). It ratchets: lowering needs no
ceremony once headroom reaches 5%; raising requires written justification in
the PR description. Keep rules to 1-3 lines and link their homes; detail never
lives here.
-->

# AGENTS.md

The hard rules of this repository, for humans and agents. Every rule fits in 1-3 lines and ends at a link to its home; this constitution holds pointers, not details.

## Commands

- Test: `<test command>` · Build: `<build command>` · Lint: `<lint command>`
- Pre-push: `anti-shishan check`, or the narrowest subset `anti-shishan check --only <gate>[,<gate>...]`

## Conventions

1. **Misconfiguration fails loud**: unknown keys, missing referents, and invalid values are load-time errors, never silent skips.
2. **An empty catch names its error** and states why ignoring it is safe; one `try` wraps exactly one statement.
3. **Every file ends with exactly one trailing newline.**
4. **Registrations are effects**: every contribution to a registry, subscription, or timer returns its disposer.
5. **Docs ship with their code**: a behavior change updates README/JSDoc in the same commit; comments state contracts, never narratives (`.agents/skills/prose-standard/SKILL.md`).

## One fact, one home

- Bugs and incidents → `docs/postmortem/`
- Decisions and the alternatives they beat → `.agents/notes/` (rules: `.agents/notes/README.md`)
- Processes, policies, and testing strategy → `docs/`
- Anything found twice becomes a link to its one home.

## Before you push

Run the checks that match the diff — never the full suite by reflex; CI owns exhaustive coverage (`.agents/skills/pre-push-checks/SKILL.md`). Do not push and wait for CI to tell you.

## The constitution rule

No rule in this file exceeds three lines. A candidate rule first lands in its home under `docs/` or a skill; promotion here is reserved for rules that are universal, mechanical, and enforced by a gate.
