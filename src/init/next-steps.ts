/**
 * Post-init next steps: compute what still needs a human or an agent after
 * `anti-shishan init` from the target repository's actual state, instead of
 * reciting a static checklist. Each step names its owner (human vs agent) so
 * the output doubles as the first work order for the session's agent.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Detect leftover `<...>` placeholders in one file (tokens init could not render). */
function leftoverPlaceholders(absPath: string): string[] {
  if (!existsSync(absPath)) return []
  const content = readFileSync(absPath, 'utf8')
  const tokens = new Set<string>()
  for (const match of content.matchAll(/<[a-z][a-z -]{2,40}>/g)) {
    tokens.add(match[0])
  }
  return [...tokens].sort()
}

/**
 * Compute post-init steps for the target repo.
 *
 * @returns one line per remaining action; empty when init left nothing behind
 */
export function collectNextSteps(targetDir: string): string[] {
  const steps: string[] = []

  if (!existsSync(join(targetDir, 'README.md'))) {
    steps.push('agent: create README.md — doc-budgets budgets it and reports a missing referent until it exists')
  }

  const tokens = leftoverPlaceholders(join(targetDir, 'AGENTS.md'))
  if (tokens.length > 0) {
    steps.push(`agent: fill AGENTS.md placeholder(s) ${tokens.join(' ')} — init renders them only when the matching package.json script exists`)
  }

  steps.push('agent: trim anti-shishan.yml — budgets should name real files, and gates you do not want get `enabled: false`')
  steps.push('agent: run `anti-shishan check` — the findings are the remaining to-do list (first-run red is the design)')
  steps.push('human: merge `.github/workflows/ci-verdict.yml` into your CI and point branch protection at the single `all-checks-passed` check (needs repo settings access)')
  steps.push('human: commit the installed files and add anti-shishan-kit as a devDependency so teammates run the same gates')

  return steps
}
