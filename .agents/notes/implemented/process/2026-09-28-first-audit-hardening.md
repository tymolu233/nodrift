# Agent Note: first audit hardening
Status: implemented

## Problem

The project's own doctrine says gates need tests and docs prove their bounds — but until the first external-style audit (four parallel passes: src correctness, test quality, packaging/security, docs consistency), nobody had checked whether the kit obeys itself.

## Decision

All S1/S2 findings were fixed the same day rather than scheduled: `git ls-files` now runs with `-z` and NUL splitting (quotePath-on made non-ASCII filenames vanish from every gate's corpus — Chinese filenames had been silently exempt from all checks); `listRepoFiles` falls back to the walk when git cannot answer; notes format and archive tolerate CRLF and preserve endianness on seal writes; the seal manifest and ratchet baselines write atomically (tmp+rename); `shitcode note reseal` was added as the recovery path for a torn seal (previously a permanent deadlock); the note-format gate now really bans `## Proposal`/`## Plan` plan-state headings in implemented notes (docs had claimed it; only the sh fallback did); archived-note content is asserted byte-identical save the inserted seal line; config validation rejects escaping `notes.root` and non-slug classes; `shitcode check` prints each failed gate's doc line; three published spots teaching the wrong `note new <class> <topic>` form were corrected to the flag form.

## Alternatives considered

- **Fix only S1 now, batch S2 later** — the S2 set (torn-seal deadlock, CRLF, plan-state) is exactly the "gate lies about its strength" class the kit exists to prevent in others; deferring them would be the most pointed self-contradiction possible.
- **Upgrade vitest to 5 now for the mocker CVE** — moderate, dev-only, never shipped to consumers; deferred to a deliberate major upgrade rather than rushed into this pass.
- **Re-teach the sh fallback full TS parity** — the sh scripts are explicit zero-dependency fallbacks with documented subset semantics; parity re-checks stay in the TS product.

## Consequences

337 tests all green with per-file 100% coverage intact; the tarball acceptance path re-verified; the notes tree gained this record. Open debts, deliberately parked: vitest major upgrade (dev-only CVE), an e2e journey inside a real git repository (git-mode corpus discovery is unit-tested but not e2e-tested), and a gen:templates tree→manifest freshness direction beyond output validation.
