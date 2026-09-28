# Agent Note: rename to nodrift
Status: implemented

## Problem

The product name anti-shitcode-kit and its short bin name shitcode forced the word "shitcode" into every command line, CI log, and doc of any adopting repository — including corporate environments where that tone is unacceptable — costing adoption for zero benefit.

## Decision

The product is renamed from anti-shitcode-kit/shitcode to nodrift: package name, single bin `nodrift`, npm script, config file `nodrift.yml`, templates, CLI surface, docs, and tests all moved in one change with no backward-compatibility shims (the package was never published, so nothing external can break). The name reads what the kit fights: governance drift. npm availability of `nodrift` was verified on 2026-09-28.

## Alternatives considered

- **Keep shitcode** — rejected: the tone becomes part of every adopter's CI output and corporate documentation, a hard blocker in exactly the teams that need governance most.
- **anti-mess-kit** — rejected: 13 extra characters per CLI invocation versus `nodrift`, and "anti-mess" is a weaker description than a name standing on its own.
- **nomess / unmess** — rejected: less precise; the kit fights drift — rules quietly dying, baselines creeping, docs diverging from code — not generic mess.

## Consequences

Every reference inside the repository now says nodrift; the dated 2026-09-28 decision records keep their original wording as history, and the repository directory itself keeps its name. Historical references to the old names live only in those frozen notes and in this record.
