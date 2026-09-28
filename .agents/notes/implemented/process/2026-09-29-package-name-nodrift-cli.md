# Agent Note: Package name nodrift-cli, bin stays nodrift
Status: implemented

## Problem

npm rejected the first publish of `nodrift`: the registry's similarity guard blocks new packages too close to an existing one (`no-drift`, unrelated third party). The guard triggers only at publish time; pre-publish 404 probes are necessary but not sufficient.

## Decision

Publish the package as `nodrift-cli`; keep the bin, the config filename, the template vocabulary, and the product name all as `nodrift`. The zero-install path becomes `npx nodrift-cli init`; inside any project that installed the package, `npx nodrift check` keeps working because npx resolves the local bin.

## Alternatives considered

- `@tymolu/nodrift` (scoped, npm's own suggestion): guaranteed publishable, but the zero-install command grows to `npx @tymolu/nodrift` and the brand splits across two namespaces.
- `unmess` / `stoprot` / other free names: short, but they abandon the drift vocabulary the whole docs surface already uses.
- Relocating all references to a new name: rejected; only the two install-path lines in README and the package metadata needed to move, everything else keys off the bin.

## Consequences

Neighbor scan 2026-09-29: `no-mess` exists (kills `nomess`); `umess` / `un-mess` / `de-mess` / `stop-rot` / `anti-drift` all free. If `nodrift-cli` is ever rejected too, the fallback is the scoped `@tymolu/nodrift` — no further rename of the bin, config, or templates.
