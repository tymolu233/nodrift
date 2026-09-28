/**
 * Regex scanning for ratchet rules: every line of every file admitted by a
 * rule's globs is tested, and each hit becomes an occurrence with a stable
 * content fingerprint.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { occurrenceFingerprint } from '../core/hash.js'
import { filterByGlobs, listRepoFiles } from '../core/walk.js'
import type { RatchetOccurrence, RatchetRule } from './types.js'

/** Result of scanning one rule across the repository. */
export interface RuleScan {
  /** Repo-relative files admitted by the rule's `files` globs, sorted for stable diffing. */
  scanned: string[]
  /** Every current occurrence, in file-then-line order. */
  occurrences: RatchetOccurrence[]
}

/** Preview length cap: reports and baselines stay single-line. */
const PREVIEW_MAX = 80

/**
 * Scan one rule across the repository.
 * A fresh RegExp is compiled per line so `g`/`y` flags never leak `lastIndex`
 * state between tests (a stateful shared regex would skip alternating hits).
 * @param repoRoot absolute repository root
 * @param rule rule to scan; callers validate pattern/flags before scanning
 * @returns the admitted files and every occurrence of the forbidden pattern in them
 */
export function scanRule(repoRoot: string, rule: RatchetRule): RuleScan {
  const files = filterByGlobs(listRepoFiles(repoRoot), rule.files).sort()
  const occurrences: RatchetOccurrence[] = []
  for (const file of files) {
    const lines = readFileSync(join(repoRoot, file), 'utf8').split('\n')
    lines.forEach((raw, index) => {
      if (!new RegExp(rule.pattern, rule.flags ?? '').test(raw)) return
      occurrences.push({
        file,
        line: index + 1,
        preview: raw.trim().slice(0, PREVIEW_MAX),
        fingerprint: occurrenceFingerprint(file, raw),
      })
    })
  }
  return { scanned: files, occurrences }
}
