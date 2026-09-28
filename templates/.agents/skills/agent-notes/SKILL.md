---
name: agent-notes
description: Use when deciding, writing, updating, rejecting, superseding, or archiving decision records in .agents/notes/ — when a note is required, lifecycle and format rules, mandatory alternatives, supersession audits, and the archive semantics the anti-shishan note gates enforce.
---

# Agent Notes

A decision note records lasting rationale that code, tests, and docs cannot carry: the why, the alternatives that lost, and the obligations placed on later work. The tree's own README (`.agents/notes/README.md`) is the single authority on format; this skill is the working judgment.

## When to write one

- Write for a durable decision: why a boundary sits where it does, what was given up, what later changes must preserve.
- Exempt: mechanical edits, local UI changes, and anything a reader can discover from an entry-point comment or a search.
- A changed fact (path, default, rename) goes to the owning doc, or updates the owning note in the same PR — it never justifies a new note.
- Write or update the note **in the same PR as the implementation**, never after.

## Lifecycle

```
proposed ── ships ──▶ implemented ── superseded ──▶ archived (sealed)
   │
   └── premise gone ──▶ rejected
```

- Paths encode state: `{lifecycle}/{class}/yyyy-mm-dd-topic.md`; `class` comes from the closed set in `anti-shishan.yml` (`feature`, `bug-fix`, `simplification`, `architecture`, `process`, `testing` by default). The filename date is the first-proposed date.
- `proposed → implemented` rewrites `## Proposal` into a present-tense `## Decision` and folds `## Acceptance criteria` / `## Risks` into `## Consequences` — in the same PR that ships the work.
- `proposed → rejected` only appends the verdict to the `Status:` line and freezes the file.
- Archival inserts one `Archived: YYYY-MM-DD` line below `Status:` and moves the file under `archived/<class>/`. Nothing else may change.

## Mandatory sections

Every note opens with `## Problem` and carries `## Alternatives considered` — each genuine alternative and why it lost. **A decision recorded without what it beat invites re-litigation**: that re-litigation is the failure notes exist to prevent. Record only alternatives that were truly weighed; "do nothing" is not an alternative. Section skeletons: `.agents/notes/templates/`.

## Supersession audit on every new note

Before drafting, audit active notes covering the same decision, mechanism, or rejected alternative:

- Same decision, updated owner → edit the existing note; a duplicate is never created.
- Fully absorbed → consolidate: the new note preserves every unique rationale, alternative, and consequence of the old one *before* the old one is deleted. Git history is not the only copy of rationale.
- Partially superseded → keep both, cross-link, and update every fact in the old note that remains current.

Do not defer a known match to a later corpus audit.

## Archive and deletion semantics

- Archived notes are sealed and permanently non-authoritative: never edited, reformatted, or cited as current law; the archive-seal gate enforces append-only.
- Archival judges future guidance value — never word count, age, or a quota. Keep a note active while its alternatives, negative guarantee, ownership boundary, or reintroduction condition can still steer a future change.
- Never archive a proposed note: reject an obsolete proposal with an honest verdict.
- A rejected note lives only while the losing idea remains a tempting, plausible mistake; delete it when its premise has left the codebase, repairing inbound links in the same change.

## Commands

```sh
anti-shishan note new <class> <topic>   # scaffold from the lifecycle template, dated path
anti-shishan note archive <path>        # seal: insert Archived: and move under archived/<class>/
anti-shishan check --only note-format,note-classification,note-archive-seal
```

The gates check structure only. Semantic quality — a real problem, honest alternatives, consequences that include the costs — is the human checklist in `docs/notes-quality-gate.md`, and it never goes into a script.
