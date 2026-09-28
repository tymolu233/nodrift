/**
 * Ratchet configuration and baseline file (de)serialization. A ratchet rule
 * forbids a pattern from growing: occurrences acknowledged in the baseline may
 * shrink or retire, never increase. Generalized from deepseek-harness
 * `verify-no-unknown-casts` (MIT) into a per-rule regex form.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** One forbidden-pattern rule from `gates.ratchet.rules`. */
export interface RatchetRule {
  /** Short rule id, used in baselines, messages, and `anti-shishan ratchet update <id>`. */
  id: string
  /** Regular expression source, tested per source line. */
  pattern: string
  /** Include globs selecting the scanned files. */
  files: string[]
  /** Repo-relative, forward-slash path of this rule's baseline JSON. */
  baseline: string
  /** Optional RegExp flags (default: none). */
  flags?: string
}

/** One occurrence of a forbidden pattern, found by scan or stored in a baseline. */
export interface RatchetOccurrence {
  /** Repo-relative, forward-slash file path. */
  file: string
  /** 1-based line number. */
  line: number
  /** Content hash from core/hash: stable across reindentation, changing with any non-whitespace edit. */
  fingerprint: string
  /** Line text trimmed and truncated to 80 characters, for reports and human baseline review. */
  preview: string
}

/** On-disk baseline: the acknowledged occurrence inventory of one rule. */
export interface BaselineFile {
  /** Id of the rule this baseline belongs to; a mismatch means the file was copied or the rule renamed. */
  rule: string
  /** ISO date (YYYY-MM-DD) of the last `ratchet update`. */
  updatedAt: string
  /** Acknowledged occurrences. */
  entries: RatchetOccurrence[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(absPath: string, reason: string): never {
  throw new Error(`ratchet: baseline ${absPath} is invalid: ${reason}`)
}

function parseEntry(value: unknown, index: number, absPath: string): RatchetOccurrence {
  if (!isRecord(value)) fail(absPath, `entries[${index}] must be an object`)
  const { file, line, fingerprint, preview } = value
  if (typeof file !== 'string' || file.length === 0) fail(absPath, `entries[${index}].file must be a non-empty string`)
  if (typeof line !== 'number' || !Number.isSafeInteger(line) || line <= 0) fail(absPath, `entries[${index}].line must be a positive integer`)
  if (typeof fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(fingerprint)) fail(absPath, `entries[${index}].fingerprint must be a lowercase sha256 hex`)
  if (typeof preview !== 'string') fail(absPath, `entries[${index}].preview must be a string`)
  return { file, line, fingerprint, preview }
}

/**
 * Read a baseline JSON file, treating a missing file as an empty inventory so
 * a rule can start without one. A malformed file throws — silent fallback
 * would let a corrupt baseline read as "no acknowledged debt".
 * @param absPath absolute path of the baseline file
 * @param ruleId id of the rule being verified or updated
 */
export function readBaseline(absPath: string, ruleId: string): BaselineFile {
  if (!existsSync(absPath)) return { rule: ruleId, updatedAt: '', entries: [] }
  let value: unknown
  try {
    value = JSON.parse(readFileSync(absPath, 'utf8'))
  } catch (error) {
    fail(absPath, `not valid JSON: ${(error as Error).message}`)
  }
  if (!isRecord(value)) fail(absPath, 'must be an object with rule, updatedAt, entries')
  if (value['rule'] !== ruleId) fail(absPath, `belongs to rule "${String(value['rule'])}", not "${ruleId}" (renamed rule? update the baseline file in the same change)`)
  if (typeof value['updatedAt'] !== 'string') fail(absPath, 'updatedAt must be a string')
  if (!Array.isArray(value['entries'])) fail(absPath, 'entries must be an array')
  return {
    rule: ruleId,
    updatedAt: value['updatedAt'],
    entries: (value['entries'] as unknown[]).map((entry, index) => parseEntry(entry, index, absPath)),
  }
}

/** Write a baseline file (2-space JSON, trailing newline), creating parent directories. */
export function writeBaseline(absPath: string, baseline: BaselineFile): void {
  mkdirSync(dirname(absPath), { recursive: true })
  // tmp + rename: a crash mid-write must never leave a torn baseline behind
  const tmp = `${absPath}.tmp`
  writeFileSync(tmp, `${JSON.stringify(baseline, null, 2)}\n`)
  renameSync(tmp, absPath)
}
