/**
 * Agent adapters: metadata and selection policy for `nodrift init --agents`.
 *
 * Every adapter installs one short pointer stub at its agent ecosystem's
 * native project-level location (registered as a real template under
 * templates/agents/<id>/ and listed in the manifest's "agentStubs") naming
 * the constitution (`AGENTS.md`), the notes root (`.agents/notes/`), and the
 * skills tree. The registry is a closed set — adapter ids appear in --agents
 * and nodrift.yml, so unknown ids fail loud at resolution; adding an agent
 * means one entry here, one stub template tree, and one manifest line.
 */

/** One supported agent ecosystem. */
export interface AgentAdapter {
  /** Id used by `--agents` and nodrift.yml `agents:` (lowercase slug). */
  readonly id: string
  /** Repo-relative install location of the adapter's stub file. */
  readonly target: string
  /**
   * When set, every `.agents/skills/` template is additionally copied under
   * this prefix: Claude Code discovers project skills only in `.claude/skills`,
   * and the mirror keeps `.agents/skills/` the single source of truth.
   */
  readonly skillsMirror?: string
}

/** The closed adapter set, in help-text order. */
export const AGENT_ADAPTERS: readonly AgentAdapter[] = [
  { id: 'claude', target: 'CLAUDE.md', skillsMirror: '.claude/skills' },
  { id: 'cursor', target: '.cursor/rules/nodrift.mdc' },
  { id: 'copilot', target: '.github/copilot-instructions.md' },
  { id: 'gemini', target: 'GEMINI.md' },
  { id: 'windsurf', target: '.windsurf/rules/nodrift.md' },
]

/** Valid adapter ids, in registry order. */
export const AGENT_IDS: readonly string[] = AGENT_ADAPTERS.map((adapter) => adapter.id)

/** Templates-tree prefix under which adapter stubs ship (`agents/<id>/<file>`). */
export const AGENT_STUBS_PREFIX = 'agents/'

/** Templates-tree prefix of the canonical skills tree a skillsMirror copies. */
export const SKILLS_TEMPLATE_PREFIX = '.agents/skills/'

/** Look up one adapter by id; unknown ids come back undefined for callers that validate. */
export function agentAdapter(id: string): AgentAdapter | undefined {
  return AGENT_ADAPTERS.find((adapter) => adapter.id === id)
}

/** Templates-tree prefix holding one adapter's stub files. */
export function agentStubPrefix(id: string): string {
  return `${AGENT_STUBS_PREFIX}${id}/`
}

/**
 * Validate ids against the closed set, de-duplicated in first-use order.
 * @throws Error naming the unknown ids and the full valid set
 */
export function validateAgentIds(ids: string[]): string[] {
  const unique = [...new Set(ids)]
  const unknown = unique.filter((id) => !AGENT_IDS.includes(id))
  if (unknown.length > 0) {
    throw new Error(`unknown agent id(s) ${unknown.map((id) => JSON.stringify(id)).join(', ')} (valid: ${AGENT_IDS.join(', ')})`)
  }
  return unique
}

/**
 * Resolve which adapters `nodrift init` installs.
 *
 * Precedence: `--agents` (a comma-separated list, trimmed, empties dropped)
 * beats the `agents:` list in nodrift.yml, which beats the empty default —
 * today's generic AGENTS.md-only install. Errors are loud and name the valid
 * set; the empty result is an explicit choice, never a silent fallback.
 *
 * @param input raw `--agents` flag value, undefined when the flag is absent
 * @param configAgents normalized `agents:` from nodrift.yml, undefined when absent
 * @returns validated adapter ids in selection order
 */
export function resolveAgentIds(input: string | undefined, configAgents: string[] | undefined): string[] {
  if (input !== undefined) {
    return validateAgentIds(input.split(',').map((part) => part.trim()).filter((part) => part.length > 0))
  }
  if (configAgents !== undefined) return validateAgentIds(configAgents)
  return []
}
