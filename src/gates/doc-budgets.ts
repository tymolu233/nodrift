/**
 * doc-budgets gate: standing documents stay within word ceilings that ratchet
 * down. Budgets are a whitelist — only files listed in `options.budgets` are
 * checked; an entry whose file is missing fails the gate, because a budget
 * pointing at a dead path quietly stops guarding anything. Keeping a ceiling
 * requires at least 5% headroom over the actual word count: usage in the
 * (0.95 × ceiling, ceiling] band fails so budgets track the text instead of
 * silently becoming load-bearing.
 */
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import type { Gate, GateContext, Violation } from '../core/types.js'

/** Option keys this gate understands; anything else fails loud as misconfiguration. */
const KNOWN_OPTIONS = new Set(['enabled', 'budgets'])

/** Minimum free share of a budget: keeping a ceiling requires ≥5% headroom over actual usage. */
export const MIN_HEADROOM = 0.05

/**
 * `wc -w` equivalent: count whitespace-delimited tokens over the FULL text,
 * fenced code blocks included. Deliberately crude — any tool or CI log can
 * reproduce the number the same way (same rule as the deepseek-harness gate).
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Read and validate `options.budgets` as a Record of repo-relative
 * forward-slash path → positive integer word ceiling.
 * @throws Error naming the offending entry when budgets is missing, not a
 *   mapping, or holds an invalid path or ceiling.
 */
export function parseBudgets(options: Record<string, unknown>): Record<string, number> {
  const raw = options['budgets']
  if (raw === undefined) throw new Error('doc-budgets: budgets is required (mapping of repo-relative path to word ceiling)')
  if (!isRecord(raw)) throw new Error('doc-budgets: budgets must be a mapping of repo-relative path to word ceiling')
  const budgets: Record<string, number> = {}
  for (const [path, ceiling] of Object.entries(raw)) {
    if (path.length === 0 || isAbsolute(path) || path.split('/').includes('..') || path.includes('\\')) {
      throw new Error(`doc-budgets: budgets key "${path}" must be a repo-relative path with forward slashes`)
    }
    if (typeof ceiling !== 'number' || !Number.isInteger(ceiling) || ceiling <= 0) {
      throw new Error(`doc-budgets: ceiling for "${path}" must be a positive integer, got ${String(ceiling)}`)
    }
    budgets[path] = ceiling
  }
  return budgets
}

/** Classify one observed word count against its ceiling. */
export type BudgetStatus = 'ok' | 'headroom' | 'over'

/**
 * Judge one file's word count against its ceiling.
 * @returns 'over' above the ceiling; 'headroom' in the (95%, 100%] band where
 *   keeping the ceiling would leave < 5% free; 'ok' at or below 95%.
 */
export function budgetStatus(words: number, ceiling: number): BudgetStatus {
  if (words > ceiling) return 'over'
  if (words > ceiling * (1 - MIN_HEADROOM)) return 'headroom'
  return 'ok'
}

function assertKnownOptions(options: Record<string, unknown>): void {
  for (const key of Object.keys(options)) {
    if (!KNOWN_OPTIONS.has(key)) {
      throw new Error(`doc-budgets: unknown option key "${key}" (known: enabled, budgets)`)
    }
  }
}

/** The doc-budgets gate. */
export const docBudgetsGate: Gate = {
  id: 'doc-budgets',
  doc: 'Proves each listed file keeps its word count at or under 95% of its ceiling (budgets ratchet down; unlisted files are unchecked). Does not prove prose quality.',
  async run(ctx: GateContext) {
    assertKnownOptions(ctx.options)
    const budgets = parseBudgets(ctx.options)
    const entries = Object.entries(budgets).sort(([a], [b]) => a.localeCompare(b))
    const violations: Violation[] = []
    if (entries.length === 0) {
      violations.push({
        gate: 'doc-budgets',
        message: 'budgets is empty — the gate has nothing to enforce; add at least one "path: ceiling" entry in anti-shishan.yml or disable the gate',
      })
    }
    for (const [path, ceiling] of entries) {
      const abs = join(ctx.repoRoot, path)
      if (!existsSync(abs)) {
        violations.push({
          gate: 'doc-budgets',
          file: path,
          message: `budgeted file does not exist (renamed or deleted? update or remove the gates.doc-budgets.budgets entry in the same change)`,
        })
        continue
      }
      const words = countWords(readFileSync(abs, 'utf8'))
      const status = budgetStatus(words, ceiling)
      if (status === 'over') {
        violations.push({
          gate: 'doc-budgets',
          file: path,
          message: `${words} words exceeds the ${ceiling}-word ceiling — condense or relocate content (raising the ceiling requires justification)`,
        })
      } else if (status === 'headroom') {
        violations.push({
          gate: 'doc-budgets',
          file: path,
          message: `${words} of ${ceiling} words used, under the ceiling but above the 95% ratchet band — budgets ratchet down with ≥5% headroom: keep at most ${Math.floor(ceiling * (1 - MIN_HEADROOM))} words or adjust the ceiling`,
        })
      }
    }
    return { violations, corpus: { admitted: entries.length } }
  },
}
