# Agent Notes — the decision-record mechanism

This directory is the home of decision records. The rules live only here; every other document links to this file. Companion workflow: `.agents/skills/agent-notes/SKILL.md`.

## Layout

```
.agents/notes/
├── README.md        # this file: format and rules (the sole authority)
├── proposed/        # proposals (never archived — advance or reject)
├── implemented/     # shipped decisions (present tense, current law)
├── rejected/        # declined proposals (frozen, guardrails against repetition)
├── archived/        # sealed implemented records (history, never current authority)
├── templates/       # the three fill-in templates, one per lifecycle
└── <class>/         # each lifecycle splits into the closed class set below
```

The path always reads `{lifecycle}/{class}/yyyy-mm-dd-topic.md`. Classes are a closed set (defaults; the live set is `notes.classes` in `anti-shishan.yml`):

| class | covers |
|---|---|
| `feature` | new user- or model-facing capability |
| `bug-fix` | defect fix or postmortem-driven gap closure |
| `simplification` | removal without added capability (behavior-preserving refactors land here) |
| `architecture` | module boundaries, package relations, runtime vocabulary |
| `process` | tooling, gates, and release workflow around the code |
| `testing` | test infrastructure and strategy |

Adding a class means editing the gate configuration deliberately — the set is closed on purpose.

## When to write one

- Only for lasting rationale that code, tests, and ordinary docs cannot carry: the why, what was given up, the obligations placed on later work.
- In the **same PR as the implementation**, never after the fact.
- Facts a reader can discover alone (entry-point comments, search, module docs) do not earn a note; only trade-offs and verdicts do.
- **Update the existing owner, never duplicate**: facts (paths, symbols, defaults) are edited in place; a reversed decision means a new note with cross-links both ways. A note is never edited into a different decision.
- Mechanical edits and local UI changes are exempt.

## Header block (gate-checked)

```markdown
# Agent Note: <title>

Status: proposed            | implemented | rejected — <one-line verdict>
(archived records insert `Archived: YYYY-MM-DD` immediately below the Status line)
```

Line 1 starts with `# Agent Note:`; `Status:` appears exactly once and agrees with the lifecycle folder. The filename date is the first-proposed date; git holds every later date.

## Body skeleton

- Every note opens with `## Problem` — motivation that stands without the solution.
- `proposed`: `## Proposal` + `## Alternatives considered` + `## Acceptance criteria` + `## Risks`.
- `implemented`: `## Decision` (**present tense**) + `## Alternatives considered` + `## Consequences`; plan-state headings (`## Proposal` / `## Plan` / `## Acceptance criteria`) are rejected by the gate.
- `rejected`: `## Problem` + the frozen `## Proposal` + `## Alternatives considered` + `## Rejection rationale` (why it lost, and what conditions would justify re-proposing).
- `## Alternatives considered` is mandatory in every lifecycle: list only alternatives genuinely weighed at the time. A decision recorded without what it beat invites re-litigation.

## Lifecycle

```
proposed ── ships ──▶ implemented ── superseded ──▶ archived (insert Archived: line only)
   │
   └── premise gone ──▶ rejected (a proposed note is never archived)
```

- **Archives are append-only and sealed**: never rewritten, never current authority; cross-links live in the new note, not in the archived one.
- **Rejected notes have a lifespan**: keep one only while the losing idea remains a tempting mistake; delete it when its premise is gone from the codebase, repairing inbound links in the same change.
- **Full supersession**: the new note absorbs every unique rationale of the old one before the old one may be consolidated away — git history is not the only copy of rationale.

## Gates and commands

`anti-shishan note new <class> <topic>` scaffolds a note from the templates; `anti-shishan note archive <path>` seals an implemented note; `anti-shishan check --only note-format,note-classification,note-archive-seal` checks paths and filenames, the header block, Status/folder agreement, archive seals, and the body skeleton. Without Node, `sh scripts/check-notes` covers the same structure. Semantic quality — real motivation, honest alternatives — is the human checklist in [docs/notes-quality-gate.md](../../docs/notes-quality-gate.md), and it never goes into a script.
