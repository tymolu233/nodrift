# Agent Note: init --agents agent adapters
Status: implemented

## Problem

Major agent ecosystems each read project-level instructions from their own location — Claude Code reads `CLAUDE.md` and discovers project skills only under `.claude/skills/`, Cursor reads `.cursor/rules/*.mdc`, GitHub Copilot reads `.github/copilot-instructions.md`, Gemini CLI reads `GEMINI.md`, Windsurf reads `.windsurf/rules/` — so an AGENTS.md-only install leaves users of those agents without native wiring: their agent never sees the constitution, the notes root, or the skills unless a human hand-copies pointers by trial and error.

## Decision

`nodrift init` gains an agent-adapter feature keyed by a closed registry (`src/init/agents.ts`: claude, cursor, copilot, gemini, windsurf) that resolves the selection by strict precedence — `--agents <id,id>` beats the `agents:` list in nodrift.yml, which beats the empty default meaning a generic AGENTS.md-only install — with unknown ids failing loud and naming the valid set at every entry point (flag parsing, config load, scaffold). Each selected adapter installs a short pointer stub from `templates/agents/<id>/` to its native location through the same skip/force/config-preservation semantics as base files, and claude additionally mirrors the canonical `.agents/skills/` tree into `.claude/skills/` at scaffold time. Stubs only point: read `AGENTS.md` as the constitution, notes live agent-neutral in `.agents/notes/` (rules in `.agents/notes/README.md`), skills live where this agent reads them. The manifest carries an `agentStubs` array that the embedded-template codegen set-equality-checks against the `templates/agents/**` tree, so a stub added without registry/manifest, or a manifest line without a file, fails the build.

## Alternatives considered

- **Interactive TTY picker** — deferred: the flag satisfies the "可选" requirement without a prompting dependency or a TTY assumption in CI, and a picker can later read the same registry without changing resolution semantics.
- **Duplicate skills as second copies in the templates tree** — rejected: two checked-in copies of every SKILL.md drift apart with the first edit; mirroring at scaffold time keeps `.agents/skills/` the single source of truth and the mirror byte-identical on every install.
- **Per-agent notes roots** — rejected: no mainstream agent has a native notes convention, so all adapters deliberately point at the one agent-neutral `.agents/notes/` root.
- **Symlink stubs to AGENTS.md** — rejected: symlinks are fragile on Windows checkouts and break zip-based distributions, so each stub is a real file carrying its own pointer text.

## Consequences

Adding a new agent is one registry entry in `src/init/agents.ts`, one stub tree under `templates/agents/<id>/`, and one line in `templates/manifest.json`'s `agentStubs`; the codegen fails the build until all three agree. nodrift.yml's `agents:` records the selection so a bare `nodrift init` reproduces it, and init prints a human next step to record the selection whenever a non-empty install is not yet reflected there. The e2e lifecycle proves `--agents claude` installs `CLAUDE.md` plus the `.claude/skills/` mirror next to the main set and skips idempotently on rerun.
