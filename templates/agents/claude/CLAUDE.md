This file is the Claude Code stub installed by `nodrift init --agents claude`; it teaches Claude where this repository's governance lives.

@AGENTS.md

The import above pulls `AGENTS.md`, the repository constitution, into every session — treat its rules as binding and follow the links at each rule's end for detail.

Decision notes live in `.agents/notes/`; the format, lifecycle, and classification rules are in `.agents/notes/README.md`. Record durable decisions as notes there, never in chat.

Agent skills live in `.agents/skills/` and are mirrored into `.claude/skills/` by this install (both copies stay identical; the canonical copy is in `.agents/skills/`). Run the narrowest `nodrift check` before pushing.
