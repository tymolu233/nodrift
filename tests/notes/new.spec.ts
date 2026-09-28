import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { NotesConfig } from '../../src/core/types.js'
import { checkNoteFormat } from '../../src/notes/format.js'
import {
  IMPLEMENTED_SKELETON,
  PROPOSED_SKELETON,
  REJECTED_SKELETON,
  createNote,
} from '../../src/notes/new.js'
import { parseNotePath, type ParsedNotePath } from '../../src/notes/tree.js'

const CONFIG: NotesConfig = {
  root: '.agents/notes',
  classes: ['feature', 'bug-fix', 'simplification', 'architecture', 'process', 'testing'],
}

function repo(): string {
  return mkdtempSync(join(tmpdir(), 'govkit-new-'))
}

function write(root: string, rel: string, content: string): void {
  const abs = join(root, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

function read(root: string, rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

function mustParse(rel: string): ParsedNotePath {
  const entry = parseNotePath(rel, CONFIG)
  if (entry === undefined) throw new Error(`parseNotePath unexpectedly rejected ${rel}`)
  return entry
}

function skeletonPassesFormat(skeleton: string, lifecycle: 'proposed' | 'implemented' | 'rejected'): boolean {
  const root = repo()
  const rel = `.agents/notes/${lifecycle}/feature/2026-09-28-sample.md`
  write(root, rel, skeleton.replaceAll('<title>', 'Sample').replaceAll('<date>', '2026-09-28'))
  return checkNoteFormat(join(root, rel), mustParse(rel)).length === 0
}

describe('createNote', () => {
  it('creates a proposed note at the dated slug path', () => {
    const root = repo()
    const rel = createNote(root, CONFIG, { lifecycle: 'proposed', class: 'feature', title: 'My Idea!' })
    expect(rel).toMatch(/^\.agents\/notes\/proposed\/feature\/\d{4}-\d{2}-\d{2}-my-idea\.md$/)
    expect(existsSync(join(root, rel))).toBe(true)
    expect(mustParse(rel)).toMatchObject({ lifecycle: 'proposed', class: 'feature', slug: 'my-idea' })
    expect(read(root, rel)).toContain('# Agent Note: My Idea!')
  })

  it('honors an explicit date', () => {
    const root = repo()
    const rel = createNote(root, CONFIG, { lifecycle: 'proposed', class: 'feature', title: 'Dated', date: '2026-01-02' })
    expect(rel).toBe('.agents/notes/proposed/feature/2026-01-02-dated.md')
  })

  it('creates rejected notes under the rejected lifecycle', () => {
    const root = repo()
    const rel = createNote(root, CONFIG, { lifecycle: 'rejected', class: 'process', title: 'No, Tabs', date: '2026-03-04' })
    expect(rel).toBe('.agents/notes/rejected/process/2026-03-04-no-tabs.md')
    expect(read(root, rel).split('\n')[1]).toMatch(/^Status: rejected — .+$/)
  })

  it('produces notes conforming to the format checks', () => {
    const root = repo()
    for (const lifecycle of ['proposed', 'rejected'] as const) {
      const rel = createNote(root, CONFIG, { lifecycle, class: 'feature', title: 'Green Note' })
      expect(checkNoteFormat(join(root, rel), mustParse(rel))).toEqual([])
    }
  })

  it('rejects implemented and archived lifecycles', () => {
    const root = repo()
    expect(() => createNote(root, CONFIG, { lifecycle: 'implemented', class: 'feature', title: 'X' })).toThrow(
      /"proposed" or "rejected"/,
    )
    expect(() => createNote(root, CONFIG, { lifecycle: 'archived', class: 'feature', title: 'X' })).toThrow(
      /"proposed" or "rejected"/,
    )
  })

  it('rejects classes outside the configured set', () => {
    const root = repo()
    expect(() => createNote(root, CONFIG, { lifecycle: 'proposed', class: 'refactor', title: 'X' })).toThrow(
      /notes\.classes/,
    )
  })

  it('rejects non-calendar dates', () => {
    const root = repo()
    expect(() =>
      createNote(root, CONFIG, { lifecycle: 'proposed', class: 'feature', title: 'X', date: '2026-02-30' }),
    ).toThrow(/real yyyy-mm-dd calendar date/)
  })

  it('rejects titles with no slug-able characters', () => {
    const root = repo()
    expect(() => createNote(root, CONFIG, { lifecycle: 'proposed', class: 'feature', title: '！？' })).toThrow(
      /no letters or digits/,
    )
  })

  it('folds punctuation and case into single hyphens', () => {
    const root = repo()
    const rel = createNote(root, CONFIG, {
      lifecycle: 'proposed',
      class: 'testing',
      title: '  Foo — Bar_baz  qux ',
      date: '2026-05-06',
    })
    expect(rel).toBe('.agents/notes/proposed/testing/2026-05-06-foo-bar-baz-qux.md')
  })

  it('refuses to overwrite an existing note', () => {
    const root = repo()
    const options = { lifecycle: 'proposed', class: 'feature', title: 'Same', date: '2026-01-01' }
    createNote(root, CONFIG, options)
    expect(() => createNote(root, CONFIG, options)).toThrow(/already exists/)
  })

  it('prefers the repo template and replaces <title> and <date> tokens', () => {
    const root = repo()
    write(root, '.agents/notes/templates/proposed.md', '# Template: <title>\nDate: <date>\n<title> again\n')
    const rel = createNote(root, CONFIG, { lifecycle: 'proposed', class: 'feature', title: 'Templated', date: '2026-07-08' })
    expect(read(root, rel)).toBe('# Template: Templated\nDate: 2026-07-08\nTemplated again\n')
  })

  it('honors a configured notes root', () => {
    const root = repo()
    const custom: NotesConfig = { root: 'docs/notes', classes: ['decision'] }
    const rel = createNote(root, custom, { lifecycle: 'proposed', class: 'decision', title: 'Elsewhere', date: '2026-09-01' })
    expect(rel).toBe('docs/notes/proposed/decision/2026-09-01-elsewhere.md')
    expect(existsSync(join(root, rel))).toBe(true)
  })
})

describe('built-in skeletons', () => {
  it('PROPOSED_SKELETON satisfies the proposed format', () => {
    expect(skeletonPassesFormat(PROPOSED_SKELETON, 'proposed')).toBe(true)
  })

  it('IMPLEMENTED_SKELETON satisfies the implemented format', () => {
    expect(skeletonPassesFormat(IMPLEMENTED_SKELETON, 'implemented')).toBe(true)
  })

  it('REJECTED_SKELETON satisfies the rejected format verdict grammar', () => {
    expect(skeletonPassesFormat(REJECTED_SKELETON, 'rejected')).toBe(true)
  })
})
