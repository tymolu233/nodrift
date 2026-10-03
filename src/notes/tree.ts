/**
 * Agent Note tree: the single source of truth for note paths.
 *
 * A note lives at `<notes.root>/<lifecycle>/<class>/yyyy-mm-dd-slug.md` where
 * lifecycle is one of {@link NOTES} and class belongs to the configured closed
 * set. Importing this module is pure; every function takes the repository root
 * and the notes configuration explicitly.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { NotesConfig } from '../core/types.js'

/** The closed set of note lifecycles (top-level folders under the notes root). */
export const NOTES = ['proposed', 'implemented', 'rejected', 'archived'] as const

/** One note lifecycle folder name. */
export type NoteLifecycle = (typeof NOTES)[number]

/** A note path validated against the grammar, without a filesystem location. */
export interface ParsedNotePath {
  lifecycle: NoteLifecycle
  /** The path-encoded class; always a member of the configured class set. */
  class: string
  /** Bare file name, e.g. `2026-09-28-add-gates.md`. */
  fileName: string
  /** `yyyy-mm-dd` first-proposed date taken from the file name. */
  date: string
  /** Lowercase-hyphen topic taken from the file name. */
  slug: string
  /** Repo-relative forward-slash path. */
  relPath: string
}

/** A note discovered on disk: its parsed path plus where it was found. */
export interface NoteEntry extends ParsedNotePath {
  /** Absolute path of the note file. */
  absPath: string
}

/**
 * How a candidate path under the notes root classifies:
 * `note` — a valid note; `ignored` — not a note candidate (README, templates,
 * manifest.json, `.zh.md` copies, non-Markdown files, anything outside the
 * root); `invalid` — claims to be a note but breaks a structural rule.
 */
export type NotePathCheck =
  | { kind: 'note'; entry: ParsedNotePath }
  | { kind: 'ignored' }
  | { kind: 'invalid'; message: string }

/** A top-level structural problem under the notes root. */
export interface NotesTreeStructureIssue {
  /** Repo-relative forward-slash path of the offending entry. */
  path: string
  message: string
}

/** Slug grammar: lowercase letters/digits joined by single hyphens. */
export const NOTE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const NOTE_FILENAME_RE = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/
const IGNORED: NotePathCheck = { kind: 'ignored' }

/** Notes root as a repo-relative forward-slash path without a trailing slash. */
export function notesRootRel(notesConfig: NotesConfig): string {
  return notesConfig.root.replaceAll('\\', '/').replace(/\/+$/, '')
}

/** True for real `yyyy-mm-dd` calendar dates (rejects 2026-02-30 and kin). */
export function isValidNoteDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/**
 * Classify one repo-relative path against the note-path grammar. Files that do
 * not claim to be notes (`README.md`, anything under `templates/`, `.zh.md`
 * copies, non-Markdown files such as `archived/manifest.json`) are `ignored`;
 * Markdown files at a note position that break a rule are `invalid` with a
 * remediation message.
 */
export function checkNotePath(relPath: string, notesConfig: NotesConfig): NotePathCheck {
  const rootRel = notesRootRel(notesConfig)
  if (!relPath.startsWith(`${rootRel}/`)) return IGNORED
  const segs = relPath.slice(rootRel.length + 1).split('/')
  // relPath starts with `${rootRel}/`, so a '/' always exists to slice after.
  const fileName = relPath.slice(relPath.lastIndexOf('/') + 1)
  if (fileName.endsWith('.zh.md')) return IGNORED
  if (!fileName.endsWith('.md')) return IGNORED
  if (segs.length === 1) return IGNORED
  if (segs[0] === 'templates') return IGNORED
  if (segs.length !== 3) {
    return {
      kind: 'invalid',
      message: `expected <lifecycle>/<class>/yyyy-mm-dd-slug.md under ${rootRel} (got depth ${segs.length}); move the file into a class folder`,
    }
  }
  const [lifecycle, cls] = segs as [string, string, string]
  if (!(NOTES as readonly string[]).includes(lifecycle)) {
    return {
      kind: 'invalid',
      message: `unknown lifecycle folder "${lifecycle}" (known: ${NOTES.join(', ')}); move the file into a known lifecycle folder`,
    }
  }
  if (!notesConfig.classes.includes(cls)) {
    return {
      kind: 'invalid',
      message: `unknown class folder "${cls}": add it to notes.classes in nodrift.yml or move the file into a known class (known: ${notesConfig.classes.join(', ')})`,
    }
  }
  const match = NOTE_FILENAME_RE.exec(fileName)
  if (match?.[1] === undefined || match[2] === undefined) {
    return { kind: 'invalid', message: `filename must be yyyy-mm-dd-slug.md (got "${fileName}")` }
  }
  if (!isValidNoteDate(match[1])) {
    return { kind: 'invalid', message: `filename date ${match[1]} is not a real calendar date` }
  }
  if (!NOTE_SLUG_RE.test(match[2])) {
    return {
      kind: 'invalid',
      message: `slug "${match[2]}" must be lowercase letters/digits joined by single hyphens`,
    }
  }
  return {
    kind: 'note',
    entry: {
      lifecycle: lifecycle as NoteLifecycle,
      class: cls,
      fileName,
      date: match[1],
      slug: match[2],
      relPath,
    },
  }
}

/**
 * Parse a repo-relative path into a note, or return undefined when the path is
 * not a valid note path (any `ignored` or `invalid` outcome of
 * {@link checkNotePath}).
 */
export function parseNotePath(relPath: string, notesConfig: NotesConfig): ParsedNotePath | undefined {
  const check = checkNotePath(relPath, notesConfig)
  return check.kind === 'note' ? check.entry : undefined
}

function isDirectory(absPath: string): boolean {
  return existsSync(absPath) && statSync(absPath).isDirectory()
}

/**
 * Walk the notes tree and return every valid note, sorted by repo-relative
 * path. Only the three note levels are scanned; non-Markdown files, `.zh.md`
 * copies, and folders outside the lifecycle/class sets are excluded silently
 * (surfacing those is the classification gate's job).
 */
export function walkAgentNoteTree(repoRoot: string, notesConfig: NotesConfig): NoteEntry[] {
  const rootRel = notesRootRel(notesConfig)
  const entries: NoteEntry[] = []
  for (const lifecycle of NOTES) {
    const lifecycleAbs = join(repoRoot, rootRel, lifecycle)
    if (!isDirectory(lifecycleAbs)) continue
    for (const clsEntry of readdirSync(lifecycleAbs, { withFileTypes: true })) {
      if (!clsEntry.isDirectory() || !notesConfig.classes.includes(clsEntry.name)) continue
      const clsAbs = join(lifecycleAbs, clsEntry.name)
      for (const file of readdirSync(clsAbs, { withFileTypes: true })) {
        if (!file.isFile()) continue
        const relPath = `${rootRel}/${lifecycle}/${clsEntry.name}/${file.name}`
        const check = checkNotePath(relPath, notesConfig)
        if (check.kind !== 'note') continue
        entries.push({ ...check.entry, absPath: join(clsAbs, file.name) })
      }
    }
  }
  return entries.sort((left, right) => left.relPath.localeCompare(right.relPath))
}

/**
 * Every regular file under the known lifecycle folders, at any depth, as
 * repo-relative forward-slash paths (sorted). Feeds the classification gate so
 * malformed note paths are examined, not silently skipped. Files at the notes
 * root itself are not listed; they are structural matters reported by
 * {@link walkNotesTreeStructure}.
 */
export function listNoteCandidatePaths(repoRoot: string, notesConfig: NotesConfig): string[] {
  const rootRel = notesRootRel(notesConfig)
  const out: string[] = []
  const walk = (abs: string, rel: string): void => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const childRel = `${rel}/${entry.name}`
      if (entry.isDirectory()) walk(join(abs, entry.name), childRel)
      else if (entry.isFile()) out.push(childRel)
    }
  }
  for (const lifecycle of NOTES) {
    const lifecycleAbs = join(repoRoot, rootRel, lifecycle)
    if (isDirectory(lifecycleAbs)) walk(lifecycleAbs, `${rootRel}/${lifecycle}`)
  }
  return out.sort()
}

/**
 * Top-level structural problems under the notes root: folders that are not a
 * lifecycle or `templates/` (their notes would be invisible to the walk), and
 * files that are not `README.md`. A missing notes root is not a problem.
 */
export function walkNotesTreeStructure(repoRoot: string, notesConfig: NotesConfig): NotesTreeStructureIssue[] {
  const rootRel = notesRootRel(notesConfig)
  const rootAbs = join(repoRoot, rootRel)
  const issues: NotesTreeStructureIssue[] = []
  if (!isDirectory(rootAbs)) return issues
  const knownFolders = new Set<string>([...NOTES, 'templates'])
  for (const entry of readdirSync(rootAbs, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!knownFolders.has(entry.name)) {
        issues.push({
          path: `${rootRel}/${entry.name}`,
          message: `unknown notes folder "${entry.name}": lifecycle folders are ${NOTES.join(', ')} (plus templates/); move its notes into a lifecycle folder or remove it`,
        })
      }
    } else if (entry.isFile() && entry.name !== 'README.md') {
      issues.push({
        path: `${rootRel}/${entry.name}`,
        message: `unexpected file at the notes root (only README.md belongs here); notes live at <lifecycle>/<class>/yyyy-mm-dd-slug.md`,
      })
    }
  }
  return issues
}
