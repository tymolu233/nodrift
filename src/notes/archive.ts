/**
 * The frozen archive: implemented notes sealed under `<root>/archived/<class>/`.
 *
 * `<root>/archived/manifest.json` records, per notes-root-relative key
 * (`archived/<class>/<file>.md`), `{ sha256, gitBlob? }` of the sealed file.
 * The manifest is append-only: seal verification never rewrites it and the
 * archive workflow refuses to append while the existing seal is broken.
 * `gitBlob` is recorded best-effort and compared only when git can answer.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { gitAvailable, gitBlobHash } from '../core/git.js'
import { sha256File } from '../core/hash.js'
import type { NotesConfig, Violation } from '../core/types.js'
import { checkNoteFormat } from './format.js'
import { notesRootRel, parseNotePath, walkAgentNoteTree } from './tree.js'

const MANIFEST_FILE = 'manifest.json'
const SHA256_RE = /^[0-9a-f]{64}$/
const ARCHIVED_LINE_RE = /^Archived: \d{4}-\d{2}-\d{2}$/

/** One sealed manifest value; `gitBlob` is absent when git could not answer. */
export interface ArchiveSealEntry {
  sha256: string
  gitBlob?: string
}

/** The frozen-content manifest: notes-root-relative note key to its seal. */
export type ArchiveManifest = Record<string, ArchiveSealEntry>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Parse a manifest document, throwing with the schema reason on any deviation. */
function parseManifest(text: string): ArchiveManifest {
  const value: unknown = JSON.parse(text)
  if (!isRecord(value)) throw new Error('expected a JSON object')
  const manifest: ArchiveManifest = {}
  for (const [key, seal] of Object.entries(value)) {
    if (!isRecord(seal) || typeof seal['sha256'] !== 'string' || !SHA256_RE.test(seal['sha256'])) {
      throw new Error(`entry ${JSON.stringify(key)} must carry a 64-hex sha256`)
    }
    if (seal['gitBlob'] !== undefined && typeof seal['gitBlob'] !== 'string') {
      throw new Error(`entry ${JSON.stringify(key)} must carry gitBlob as a string when present`)
    }
    const entry: ArchiveSealEntry = { sha256: seal['sha256'] }
    if (typeof seal['gitBlob'] === 'string') entry.gitBlob = seal['gitBlob']
    manifest[key] = entry
  }
  return manifest
}

function renderManifest(manifest: ArchiveManifest): string {
  return `${JSON.stringify(
    Object.fromEntries(Object.entries(manifest).sort(([left], [right]) => left.localeCompare(right))),
    null,
    2,
  )}\n`
}

/**
 * Verify the archive seal. Returns one violation per problem: a corrupt
 * manifest, a sealed note missing or changed, a manifest key that is not an
 * archived note path (this also blocks `../` traversal out of the root), an
 * archived note absent from the manifest, or an archived note without its
 * `Archived:` line. A repository without any archive is a green seal.
 */
export function verifyArchiveSeal(repoRoot: string, notesConfig: NotesConfig): (Violation & { file: string })[] {
  const rootRel = notesRootRel(notesConfig)
  const rootAbs = join(repoRoot, rootRel)
  const manifestRel = `${rootRel}/archived/${MANIFEST_FILE}`
  const manifestAbs = join(rootAbs, 'archived', MANIFEST_FILE)
  const violations: (Violation & { file: string })[] = []
  const fail = (message: string, file: string, line?: number): void => {
    violations.push({ gate: 'note-archive-seal', file, ...(line === undefined ? {} : { line }), message })
  }

  let manifest: ArchiveManifest = {}
  if (existsSync(manifestAbs)) {
    try {
      manifest = parseManifest(readFileSync(manifestAbs, 'utf8'))
    } catch (error) {
      fail(`archived/manifest.json is corrupt: ${(error as Error).message}; repair it to match the sealed files`, manifestRel)
    }
  }

  const canGit = gitAvailable(repoRoot)
  for (const [key, seal] of Object.entries(manifest)) {
    const rel = `${rootRel}/${key}`
    const parsed = parseNotePath(rel, notesConfig)
    if (parsed === undefined || parsed.lifecycle !== 'archived') {
      fail(`manifest key ${JSON.stringify(key)} is not an archived note path; remove the entry`, manifestRel)
      continue
    }
    const abs = join(rootAbs, key)
    if (!existsSync(abs)) {
      fail(`sealed note ${rel} is missing but still listed in the manifest; restore the file`, rel)
      continue
    }
    if (sha256File(abs) !== seal.sha256) {
      fail(`sealed note ${rel} changed after sealing; archived notes are frozen — keep facts current in an active note instead`, rel)
    }
    if (canGit && seal.gitBlob !== undefined && gitBlobHash(repoRoot, rel) !== seal.gitBlob) {
      fail(`sealed note ${rel} no longer matches its recorded git blob`, rel)
    }
  }

  for (const note of walkAgentNoteTree(repoRoot, notesConfig)) {
    if (note.lifecycle !== 'archived') continue
    if (!(note.relPath.slice(rootRel.length + 1) in manifest)) {
      fail(`archived note ${note.relPath} is not sealed in manifest.json; seal it with the archive workflow`, note.relPath)
    }
    const noteContent = readFileSync(note.absPath, 'utf8')
    // An empty file has zero lines; ''.split('\n') would pretend one exists.
    const noteLines = noteContent === '' ? [] : noteContent.split('\n')
    if (!ARCHIVED_LINE_RE.test(noteLines[2] ?? '')) {
      fail(`archived note ${note.relPath} must carry \`Archived: YYYY-MM-DD\` on line 3`, note.relPath, 3)
    }
  }
  return violations
}

/**
 * Move one implemented note into the frozen archive and seal it. Refuses (by
 * throwing) when the path is not an implemented note, when the note fails the
 * format checks, when the existing seal is already broken, or when the target
 * exists — the archive never overwrites. On success the file moves to
 * `archived/<class>/` retaining its name, gains an `Archived: <today>` line on
 * line 3, a same-stem `.zh.md` copy rides along best-effort, and the manifest
 * gains one append-only entry. Returns the new repo-relative path.
 */
export function archiveNote(repoRoot: string, relPath: string, notesConfig: NotesConfig): string {
  const rootRel = notesRootRel(notesConfig)
  const entry = parseNotePath(relPath, notesConfig)
  if (entry === undefined) throw new Error(`archiveNote: ${relPath} is not a valid note path`)
  if (entry.lifecycle !== 'implemented') {
    throw new Error(`archiveNote: only implemented notes can be archived (got ${entry.lifecycle})`)
  }
  const formatViolations = checkNoteFormat(join(repoRoot, relPath), entry)
  if (formatViolations.length > 0) {
    throw new Error(
      `archiveNote: ${relPath} violates the note format; fix it before archiving:\n${formatViolations
        .map((violation) => `  - ${violation.message}`)
        .join('\n')}`,
    )
  }
  const sealViolations = verifyArchiveSeal(repoRoot, notesConfig)
  if (sealViolations.length > 0) {
    throw new Error(
      `archiveNote: the archive seal is broken; refusing to append:\n${sealViolations
        .map((violation) => `  - ${violation.file}: ${violation.message}`)
        .join('\n')}`,
    )
  }

  const targetRel = `${rootRel}/archived/${entry.class}/${entry.fileName}`
  const sourceAbs = join(repoRoot, relPath)
  const targetAbs = join(repoRoot, targetRel)
  if (existsSync(targetAbs)) throw new Error(`archiveNote: ${targetRel} already exists; archived notes are never overwritten`)
  mkdirSync(dirname(targetAbs), { recursive: true })
  renameSync(sourceAbs, targetAbs)
  const sourceZhAbs = `${sourceAbs.slice(0, -'.md'.length)}.zh.md`
  const targetZhAbs = `${targetAbs.slice(0, -'.md'.length)}.zh.md`
  if (existsSync(sourceZhAbs) && !existsSync(targetZhAbs)) renameSync(sourceZhAbs, targetZhAbs)

  const archivedLine = `Archived: ${new Date().toISOString().slice(0, 10)}`
  const lines = readFileSync(targetAbs, 'utf8').split('\n')
  lines.splice(2, 0, archivedLine)
  writeFileSync(targetAbs, lines.join('\n'))

  const manifestAbs = join(repoRoot, rootRel, 'archived', MANIFEST_FILE)
  const manifest: ArchiveManifest = existsSync(manifestAbs) ? parseManifest(readFileSync(manifestAbs, 'utf8')) : {}
  const seal: ArchiveSealEntry = { sha256: sha256File(targetAbs) }
  // Recorded only when the seal verifier will compare it: gitBlobHash can
  // answer outside a work tree (`git hash-object` needs no repo), but
  // verifyArchiveSeal compares blobs only where gitAvailable holds.
  const blob = gitAvailable(repoRoot) ? gitBlobHash(repoRoot, targetRel) : undefined
  if (blob !== undefined) seal.gitBlob = blob
  manifest[`archived/${entry.class}/${entry.fileName}`] = seal
  writeFileSync(manifestAbs, renderManifest(manifest))
  return targetRel
}
