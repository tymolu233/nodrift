/**
 * ratchet gate: forbidden patterns may only shrink, never grow. Each rule in
 * `gates.ratchet.rules` scans its files for a regex; occurrences not present
 * in the rule's baseline are new debt and fail, and baseline entries whose
 * occurrence vanished must be pruned so an inventory cannot silently re-admit
 * old debt elsewhere. Registering or pruning is explicit:
 * `anti-shishan ratchet update <id>`.
 */
import { isAbsolute } from 'node:path'
import type { Gate, GateContext, Violation } from '../core/types.js'
import { runRatchetVerify } from '../ratchet/update.js'
import type { RatchetRule } from '../ratchet/types.js'

/** Option keys this gate understands; anything else fails loud as misconfiguration. */
const KNOWN_OPTIONS = new Set(['enabled', 'rules'])

/** Keys one rule entry may carry. */
const KNOWN_RULE_KEYS = new Set(['id', 'pattern', 'files', 'baseline', 'flags'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Read and validate `options.rules` as a ratchet rule list.
 * @throws Error naming the offending rule when the list is missing, holds an
 *   unknown key, duplicates an id, or has an invalid pattern, flags, file
 *   globs, or baseline path.
 */
export function parseRules(options: Record<string, unknown>): RatchetRule[] {
  const raw = options['rules']
  if (raw === undefined) throw new Error('ratchet: rules is required (a list of {id, pattern, files, baseline[, flags]})')
  if (!Array.isArray(raw)) throw new Error('ratchet: rules must be a list')
  const rules: RatchetRule[] = []
  for (const [index, value] of raw.entries()) {
    const where = `ratchet: rules[${index}]`
    if (!isRecord(value)) throw new Error(`${where} must be an object`)
    for (const key of Object.keys(value)) {
      if (!KNOWN_RULE_KEYS.has(key)) throw new Error(`${where}: unknown key "${key}" (known: id, pattern, files, baseline, flags)`)
    }
    const { id, pattern, files, baseline, flags } = value
    if (typeof id !== 'string' || id.length === 0) throw new Error(`${where}.id must be a non-empty string`)
    if (rules.some((rule) => rule.id === id)) throw new Error(`ratchet: duplicate rule id "${id}"`)
    if (typeof pattern !== 'string') throw new Error(`ratchet: rule "${id}" pattern must be a regular-expression string`)
    if (flags !== undefined && typeof flags !== 'string') throw new Error(`ratchet: rule "${id}" flags must be a string`)
    try {
      new RegExp(pattern, flags ?? '')
    } catch (error) {
      throw new Error(`ratchet: rule "${id}" has an invalid pattern/flags: ${(error as Error).message}`)
    }
    if (!Array.isArray(files) || files.some((glob) => typeof glob !== 'string')) {
      throw new Error(`ratchet: rule "${id}" files must be a list of glob strings`)
    }
    if (files.length === 0) {
      throw new Error(`ratchet: rule "${id}" files must not be empty — an empty list would silently scan the whole repo; say what you mean`)
    }
    if (typeof baseline !== 'string' || baseline.length === 0 || isAbsolute(baseline)
      || baseline.split('/').includes('..') || baseline.includes('\\')) {
      throw new Error(`ratchet: rule "${id}" baseline must be a repo-relative path with forward slashes`)
    }
    rules.push(flags === undefined ? { id, pattern, files, baseline } : { id, pattern, files, baseline, flags })
  }
  return rules
}

function assertKnownOptions(options: Record<string, unknown>): void {
  for (const key of Object.keys(options)) {
    if (!KNOWN_OPTIONS.has(key)) {
      throw new Error(`ratchet: unknown option key "${key}" (known: enabled, rules)`)
    }
  }
}

/** The ratchet gate. */
export const ratchetGate: Gate = {
  id: 'ratchet',
  doc: 'Proves each forbidden-pattern rule kept or shrank its acknowledged baseline and that baseline holds no vanished entries. Does not prove the pattern is gone — acknowledged debt stays until retired.',
  async run(ctx: GateContext) {
    assertKnownOptions(ctx.options)
    const rules = parseRules(ctx.options)
    const { results, scannedFiles } = runRatchetVerify(ctx.repoRoot, rules)
    const violations: Violation[] = []
    for (const { rule, diff } of results) {
      for (const hit of diff.added) {
        violations.push({
          gate: 'ratchet',
          file: hit.file,
          line: hit.line,
          message: `hits forbidden pattern "${rule.id}": ${hit.preview} — if this is intentional legacy debt, register it with \`anti-shishan ratchet update ${rule.id}\``,
        })
      }
      if (diff.stale.length > 0) {
        violations.push({
          gate: 'ratchet',
          file: rule.baseline,
          message: `rule "${rule.id}" baseline holds ${diff.stale.length} vanished occurrence(s) — run \`anti-shishan ratchet update ${rule.id}\` to prune the retired entries`,
        })
      }
    }
    return { violations, corpus: { admitted: scannedFiles } }
  },
}
