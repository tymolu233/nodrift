/**
 * Post-init next steps: compute what still needs a human or an agent after
 * `nodrift init` from the target repository's actual state, instead of
 * reciting a static checklist. Each step names its owner (human vs agent) so
 * the output doubles as the first work order for the session's agent.
 *
 * Both entry documents are audited: README.md (written for humans) and
 * AGENTS.md (written for agents) are a pair, and both may carry leftover
 * `<...>` placeholders init could not render. When init installed agent
 * adapters, a leftover human step asks to record the selection in nodrift.yml
 * unless the config already records the same set.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfig } from '../core/config.js'

const ENTRY_DOCS = ['README.md', 'AGENTS.md'] as const

/**
 * Tokens that are template instructions or CLI usage notation, not holes:
 * `<placeholder>` is the meta-word in "replace every <placeholder>", and
 * `<gate>` appears in the `--only <gate>[,<gate>...]` usage example. Extend
 * this set when templates add more bracket-argument usage docs.
 */
const META_TOKENS = new Set(['<placeholder>', '<gate>'])

/** Detect leftover `<...>` placeholders in one file (tokens init could not render). */
function leftoverPlaceholders(absPath: string): string[] {
  if (!existsSync(absPath)) return []
  const content = readFileSync(absPath, 'utf8')
  const tokens = new Set<string>()
  for (const match of content.matchAll(/<[a-z][a-z -]{2,40}>/g)) {
    if (!META_TOKENS.has(match[0])) tokens.add(match[0])
  }
  return [...tokens].sort()
}

/** The agent selection recorded in nodrift.yml, undefined when missing or unreadable. */
function recordedAgents(targetDir: string): string[] | undefined {
  try {
    return loadConfig(targetDir).agents
  } catch {
    // A missing or not-yet-valid nodrift.yml records no selection; the
    // record-the-selection step below then stays eligible.
    return undefined
  }
}

/** True when the config records exactly this selection, order-insensitive. */
function sameSelection(recorded: string[], installed: string[]): boolean {
  return [...recorded].sort().join(',') === [...installed].sort().join(',')
}

/**
 * Compute post-init steps for the target repo.
 *
 * @param targetDir repository root init just installed into
 * @param installedAgents adapter ids this init run installed (empty for a
 *   generic AGENTS.md-only install)
 * @returns one line per remaining action; empty when init left nothing behind
 */
export function collectNextSteps(targetDir: string, installedAgents?: string[]): string[] {
  const steps: string[] = []

  if (!existsSync(join(targetDir, 'README.md'))) {
    steps.push('agent: create README.md — the human-facing entry doc is missing entirely (the agent-readable AGENTS.md is installed beside it)')
  }

  for (const doc of ENTRY_DOCS) {
    const tokens = leftoverPlaceholders(join(targetDir, doc))
    if (tokens.length > 0) {
      steps.push(`agent: fill ${doc} placeholder(s) ${tokens.join(' ')} — init renders only what it can detect from the repository`)
    }
  }

  steps.push('agent: trim nodrift.yml — budgets should name real files, and gates you do not want get `enabled: false`')

  if (installedAgents !== undefined && installedAgents.length > 0) {
    const recorded = recordedAgents(targetDir)
    if (recorded === undefined || !sameSelection(recorded, installedAgents)) {
      steps.push(`human: record the agent selection as \`agents: [${installedAgents.join(', ')}]\` in nodrift.yml so later init runs reproduce it without the --agents flag`)
    }
  }

  steps.push('agent: run `nodrift check` — the findings are the remaining to-do list (first-run red is the design)')
  // ci.yml and ci-verdict.yml both declare workflow name `ci`; verify-notes.yml repeats the note gates.
  steps.push('human: adopt `.github/workflows/ci-verdict.yml` as the only CI workflow — delete `.github/workflows/ci.yml` and `.github/workflows/verify-notes.yml` (no-CLI fallbacks; `ci.yml` uses the same workflow name `ci`) — and point branch protection at the single `all-checks-passed` check (needs repo settings access)')
  steps.push('human: commit the installed files and add nodrift as a devDependency so teammates run the same gates')

  return steps
}
