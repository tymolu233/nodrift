---
name: find-simplifications
description: Use when hunting evidence-backed simplifications — dead code, duplicated logic, speculative generality, or machinery whose maintenance cost exceeds its behavior — to write deletion proposals, and to distinguish intentional coexistence from rot.
---

# Finding Simplifications

A simplification removes a maintained obligation: an API, a representation, a lifecycle state, a configuration path, a dependency, a test, or a document. Prefer a few well-supported candidates over a count of deletions. This is guidance, not a checklist; a survey is not permission to implement its proposals.

## Establish scope and intent first

Read the constitution, the relevant docs, and active decision records in `.agents/notes/` before judging anything. Two similar implementations can be **intentional coexistence** — a documented seam, a compatibility tier — which is not rot. Rot is a difference no consumer can observe. Deleting a protected design requires explicit override; unused members *inside* a protected design remain fair candidates.

## Discovery questions

- **Does the feature have a complete effect path?** Trace producer → transformations → consumer → observable result. A field copied everywhere may still have no reader, no writer, or only implementations that reject it. Search constructors and discriminant emitters, not just callers.
- **Which distinctions change a consumer's action?** Internal states collapsing to one user-facing behavior are candidates; keep distinctions controlling authorization, durability, or ownership.
- **Could a smaller explicit behavior delete the subsystem?** A fixed constant, a caller-supplied value, or a reported error can replace generalized machinery. Name the capability given up — a production caller turns this from a deletion into a behavior decision.
- **Can the consumer read the authoritative value when needed?** Copies, caches, and ledgers beside an authoritative source collapse into derivation — once the required time of observation is established.
- **Is composition being mistaken for policy?** Optional presence or a caller flag can express availability without a registry; preserve operations whose ownership or timing genuinely differs.
- **Who owns the total maintenance cost?** Compare the whole removed system with the replacement, residual glue included. Moving complexity — or adding a gate to keep two definitions equal — is not removing it.

## Symmetry check

Parallel values should be parallel: sibling options with asymmetric defaults, one enum member handled differently with no reason on record, two branches doing the same work with different code. Unexplained asymmetry usually marks a missed extraction — or a deleted case whose twin survived. Asymmetry with a stated reason is a keep.

## Prove reachability

Search exact symbols, property reads and writes, discriminants, event and wire strings, config keys, and both `.method(` and `method(` forms. Tests and type declarations show a contract; they do not show a shipped producer or consumer. Follow generated artifacts to their consumers — a generated catalog read by a dynamic loader is product API, not a fixed call site. Classify examples and fixtures by their real entry point, not their directory name.

For each candidate, record: current owner, the effective producer/consumer path, what disappears, what remains, and the strongest reason to keep it. Then classify:

1. **Unreachable or unread** → removal.
2. **A narrower public behavior with a named loss** → a real decision, proposed honestly.
3. **A protected obligation or insufficient evidence** → keep; refresh evidence before re-proposing.

## Record and route

- A substantial proposal uses the decision-record format (`.agents/notes/templates/`) with concrete consumer evidence, the removed maintenance cost, the capability given up, and observable acceptance criteria.
- Small local improvements belong in actionable `TODO`/`FIXME` comments, not standalone design records.
- Every new record triggers the supersession audit (see the `agent-notes` skill); do not create duplicate notes to preserve candidate counts.
- Never describe an unverified search as exhaustive. Report the surveyed areas, the supported candidates, and the meaningful rejections.
