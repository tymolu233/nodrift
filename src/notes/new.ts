/**
 * Create proposed and rejected notes. The path and skeleton come from the
 * same contract the gates enforce, so a freshly created note is green.
 * Implemented notes record shipped decisions and are written directly;
 * archived notes are produced only by the archive workflow.
 *
 * A per-repo fill-in template at `<notes.root>/templates/<lifecycle>.md` wins
 * over the built-in skeleton; the literal tokens `<title>` and `<date>` are
 * replaced wherever they appear.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { NotesConfig } from '../core/types.js'
import { isValidNoteDate, notesRootRel } from './tree.js'

/** Built-in skeleton for a proposed note when the repo ships no template. */
export const PROPOSED_SKELETON = `# Agent Note: <title>
Status: proposed

## Problem

<the motivation, written to stand without the proposal>

## Proposal

<the intended change, concrete enough to act on>

## Alternatives considered

- **<alternative>** — <why it was considered, why it lost>

## Acceptance criteria

<the observable state that means done>

## Risks

<what could go wrong and what the change knowingly gives up>
`

/** Built-in implemented skeleton, exported for tests; createNote never emits it. */
export const IMPLEMENTED_SKELETON = `# Agent Note: <title>
Status: implemented

## Problem

<the motivation>

## Decision

<the shipped reality, present tense>

## Alternatives considered

- **<alternative>** — <why it was considered, why it lost>

## Consequences

<what the trade-off cost and bought>
`

/** Built-in skeleton for a rejected note when the repo ships no template. */
export const REJECTED_SKELETON = `# Agent Note: <title>
Status: rejected — <verdict>

## Problem

<the motivation at the time>

## Proposal

<the declined proposal, frozen>

## Alternatives considered

- **<alternative>** — <why it was considered, why it lost>

## Rejection rationale

<why it was declined, and what a re-proposal would have to answer>
`

/** Parameters for {@link createNote}; `date` defaults to today (UTC). */
export interface CreateNoteOptions {
  /** Only `proposed` and `rejected` notes are created through here. */
  lifecycle: string
  /** Must be a member of `notesConfig.classes`. */
  class: string
  /** Note title; the filename slug is derived from it. */
  title: string
  /** `yyyy-mm-dd` first-proposed date; defaults to today (UTC). */
  date?: string
}

/**
 * Create a note file and return its repo-relative path. Throws on an unknown
 * lifecycle or class, a non-calendar date, a title with no slug-able
 * characters, or an already-existing target file; never overwrites.
 */
export function createNote(
  repoRoot: string,
  notesConfig: NotesConfig,
  options: CreateNoteOptions,
): string {
  const { lifecycle, class: cls, title } = options
  if (lifecycle !== 'proposed' && lifecycle !== 'rejected') {
    throw new Error(
      `createNote: lifecycle must be "proposed" or "rejected" (got ${JSON.stringify(lifecycle)}); ` +
        'implemented notes record shipped decisions and are written directly, archived notes come from the archive workflow',
    )
  }
  if (!notesConfig.classes.includes(cls)) {
    throw new Error(
      `createNote: unknown class ${JSON.stringify(cls)} (known: ${notesConfig.classes.join(', ')}); ` +
        'add it to notes.classes in anti-shishan.yml to use it',
    )
  }
  const date = options.date ?? new Date().toISOString().slice(0, 10)
  if (!isValidNoteDate(date)) {
    throw new Error(`createNote: date must be a real yyyy-mm-dd calendar date (got ${JSON.stringify(options.date)})`)
  }
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (slug === '') {
    throw new Error(`createNote: title ${JSON.stringify(title)} has no letters or digits to build a filename slug from`)
  }
  const rootRel = notesRootRel(notesConfig)
  const relPath = `${rootRel}/${lifecycle}/${cls}/${date}-${slug}.md`
  const absPath = join(repoRoot, relPath)
  if (existsSync(absPath)) throw new Error(`createNote: ${relPath} already exists; notes are never overwritten`)

  const templateAbs = join(repoRoot, rootRel, 'templates', `${lifecycle}.md`)
  const skeleton = existsSync(templateAbs)
    ? readFileSync(templateAbs, 'utf8')
    : lifecycle === 'proposed'
      ? PROPOSED_SKELETON
      : REJECTED_SKELETON
  mkdirSync(dirname(absPath), { recursive: true })
  writeFileSync(absPath, skeleton.replaceAll('<title>', title).replaceAll('<date>', date))
  return relPath
}
