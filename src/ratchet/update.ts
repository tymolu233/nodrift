/**
 * The two ratchet exits, exposed as pure-ish functions the CLI wires directly:
 * verification (read-only: diff current occurrences against each baseline) and
 * update (rewrite each baseline from a fresh scan, pruning retired entries).
 */
import { join } from 'node:path'
import { scanRule } from './scan.js'
import type { RuleScan } from './scan.js'
import { readBaseline, writeBaseline } from './types.js'
import type { RatchetOccurrence, RatchetRule } from './types.js'

/**
 * Difference between a fresh scan and a stored baseline, keyed by fingerprint,
 * so a reformatted line (reindent, trailing whitespace) is neither new nor
 * retired — but the same text appearing in another file IS new.
 */
export interface BaselineDiff {
  /** Occurrences present now but absent from the baseline (new debt — fails the gate). */
  added: RatchetOccurrence[]
  /** Baseline entries whose occurrence vanished (retired debt — the baseline must be pruned). */
  stale: RatchetOccurrence[]
}

/**
 * Compare current occurrences against baseline entries by fingerprint set.
 * @param current occurrences from a fresh scan
 * @param baseline entries stored in the baseline file
 */
export function diffOccurrences(
  current: readonly RatchetOccurrence[],
  baseline: readonly RatchetOccurrence[],
): BaselineDiff {
  const baselineFingerprints = new Set(baseline.map((entry) => entry.fingerprint))
  const currentFingerprints = new Set(current.map((entry) => entry.fingerprint))
  return {
    added: current.filter((entry) => !baselineFingerprints.has(entry.fingerprint)),
    stale: baseline.filter((entry) => !currentFingerprints.has(entry.fingerprint)),
  }
}

/** Per-rule verification outcome. */
export interface RuleVerifyResult {
  rule: RatchetRule
  scan: RuleScan
  diff: BaselineDiff
}

/** Aggregate verification outcome across a rule set. */
export interface RatchetVerifyResult {
  results: RuleVerifyResult[]
  /** Total files scanned across all rules (a file scanned by two rules counts twice). */
  scannedFiles: number
}

/**
 * Verify every rule against its baseline without writing anything.
 * @param repoRoot absolute repository root
 * @param rules rules to verify
 * @returns per-rule scans and diffs; a missing baseline reads as empty debt
 */
export function runRatchetVerify(repoRoot: string, rules: readonly RatchetRule[]): RatchetVerifyResult {
  const results = rules.map((rule) => {
    const scan = scanRule(repoRoot, rule)
    const baseline = readBaseline(join(repoRoot, rule.baseline), rule.id)
    return { rule, scan, diff: diffOccurrences(scan.occurrences, baseline.entries) }
  })
  return { results, scannedFiles: results.reduce((total, result) => total + result.scan.scanned.length, 0) }
}

/** Outcome of rewriting one rule's baseline. */
export interface RuleUpdate {
  rule: RatchetRule
  /** Occurrences newly registered (were absent from the old baseline). */
  added: number
  /** Baseline entries pruned (their occurrence vanished). */
  removed: number
  /** Occurrences in the rewritten baseline. */
  total: number
}

/**
 * Rewrite one rule's baseline from a fresh scan, replacing the inventory
 * wholesale (which prunes vanished entries) and stamping today's ISO date.
 * @param repoRoot absolute repository root
 * @param rule rule to update
 * @returns registration counts for the CLI report
 */
export function updateBaseline(repoRoot: string, rule: RatchetRule): RuleUpdate {
  const abs = join(repoRoot, rule.baseline)
  const previous = readBaseline(abs, rule.id)
  const scan = scanRule(repoRoot, rule)
  const diff = diffOccurrences(scan.occurrences, previous.entries)
  writeBaseline(abs, {
    rule: rule.id,
    updatedAt: new Date().toISOString().slice(0, 10),
    entries: scan.occurrences,
  })
  return { rule, added: diff.added.length, removed: diff.stale.length, total: scan.occurrences.length }
}

/**
 * Update every rule's baseline; the `anti-shishan ratchet update <id>` CLI filters
 * the rule list first.
 * @param repoRoot absolute repository root
 * @param rules rules to update
 */
export function runRatchetUpdate(repoRoot: string, rules: readonly RatchetRule[]): RuleUpdate[] {
  return rules.map((rule) => updateBaseline(repoRoot, rule))
}
