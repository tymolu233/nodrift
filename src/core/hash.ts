/**
 * Content hashing shared by the ratchet baselines and the notes archive seal.
 * SHA-256 over raw bytes for seals; over a whitespace-normalized form for
 * ratchet fingerprints so re-indenting a line does not fake a "new" violation.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

/** SHA-256 hex of the file's exact bytes. */
export function sha256File(absPath: string): string {
  return createHash('sha256').update(readFileSync(absPath)).digest('hex')
}

/** SHA-256 hex of the exact string. */
export function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/**
 * Collapse all whitespace runs to one space and trim, so a fingerprint is
 * stable across reindentation and trailing-space edits but changes when any
 * non-whitespace character changes.
 */
export function normalizeForFingerprint(text: string): string {
  return text.replaceAll(/\s+/g, ' ').trim()
}

/**
 * Fingerprint of one ratchet occurrence: file identity plus normalized line
 * content. Moving the same text to another file IS a new fingerprint (a
 * reviewer should re-acknowledge the move); reformatting is not.
 */
export function occurrenceFingerprint(file: string, lineContent: string): string {
  return sha256Text(`${file} ${normalizeForFingerprint(lineContent)}`)
}
