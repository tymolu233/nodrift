# Agent Note: init drops the level system
Status: implemented

## Problem

The first public cut of `shitcode init` offered `--level 0|1|2` with an incremental file manifest, selling an "adoption gradient" at install time.

## Decision

`init` now installs the full manifest in one shot; the `--level` flag and level plumbing in the scaffold, CLI, tests, and templates are gone. The adoption gradient lives where it always belonged: `anti-shitcode.yml` lets each gate be disabled per config, and files that are not wanted can simply be deleted (init is idempotent, not a dependency).

## Alternatives considered

- **Keep three levels** — the real boundary is static-copy (no Node) versus CLI-installed, and that is a distribution choice, not an installer flag; L2's contents were mostly fallbacks-of-the-tool (no-Node scripts, static CI), i.e. the installer shipping substitutes for itself; and levels already manufactured one defect class — a level-1-installed file (the notes README) linking a level-2 file, the dead link caught during tarball acceptance.
- **Two modes (minimal/full)** — every L2 file is inert text (skills cost nothing until used), so the second mode would exist only to create the same link-drift risk again.

## Consequences

One template set, one manifest key (`files`), no level-crossing link class by construction; scaffold gained duplicate-entry validation instead. The README's "装进仓库的文件" section carries the philosophy: trim scope with `enabled: false` and file deletion, never with an installer flag. This note supersedes the level design recorded in [`2026-09-28-shitcode-v0-1-design.md`](../process/2026-09-28-shitcode-v0-1-design.md), which cross-links back here.
