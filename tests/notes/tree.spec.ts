import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { NotesConfig } from '../../src/core/types.js'
import {
  NOTES,
  checkNotePath,
  isArchivedNotePath,
  isValidNoteDate,
  listNoteCandidatePaths,
  notesRootRel,
  parseNotePath,
  walkAgentNoteTree,
  walkNotesTreeStructure,
} from '../../src/notes/tree.js'

const CONFIG: NotesConfig = {
  root: '.agents/notes',
  classes: ['feature', 'bug-fix', 'simplification', 'architecture', 'process', 'testing'],
}

function repo(): string {
  return mkdtempSync(join(tmpdir(), 'govkit-tree-'))
}

function write(root: string, rel: string, content = 'x\n'): void {
  const abs = join(root, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

describe('notesRootRel', () => {
  it('normalizes backslashes and trailing slashes', () => {
    expect(notesRootRel({ ...CONFIG, root: 'docs\\notes\\' })).toBe('docs/notes')
    expect(notesRootRel(CONFIG)).toBe('.agents/notes')
  })
})

describe('isValidNoteDate', () => {
  it('accepts real calendar dates and rejects the rest', () => {
    expect(isValidNoteDate('2026-09-28')).toBe(true)
    expect(isValidNoteDate('2024-02-29')).toBe(true)
    expect(isValidNoteDate('2026-02-29')).toBe(false)
    expect(isValidNoteDate('2026-13-01')).toBe(false)
    expect(isValidNoteDate('2026-00-10')).toBe(false)
    expect(isValidNoteDate('2026-01-00')).toBe(false)
    expect(isValidNoteDate('26-01-01')).toBe(false)
    expect(isValidNoteDate('2026-1-1')).toBe(false)
  })
})

describe('NOTES', () => {
  it('lists the four lifecycles', () => {
    expect([...NOTES]).toEqual(['proposed', 'implemented', 'rejected', 'archived'])
  })
})

describe('checkNotePath', () => {
  it('parses a valid note path', () => {
    const check = checkNotePath('.agents/notes/implemented/feature/2026-09-28-add-gates.md', CONFIG)
    expect(check).toEqual({
      kind: 'note',
      entry: {
        lifecycle: 'implemented',
        class: 'feature',
        fileName: '2026-09-28-add-gates.md',
        date: '2026-09-28',
        slug: 'add-gates',
        relPath: '.agents/notes/implemented/feature/2026-09-28-add-gates.md',
      },
    })
  })

  it('ignores paths outside the notes root', () => {
    expect(checkNotePath('docs/whatever.md', CONFIG).kind).toBe('ignored')
  })

  it('ignores .zh.md copies without checking them', () => {
    expect(
      checkNotePath('.agents/notes/implemented/feature/2026-09-28-add-gates.zh.md', CONFIG).kind,
    ).toBe('ignored')
    expect(checkNotePath('.agents/notes/nowhere/feature/x.zh.md', CONFIG).kind).toBe('ignored')
  })

  it('ignores non-Markdown files (manifest.json among them)', () => {
    expect(checkNotePath('.agents/notes/archived/manifest.json', CONFIG).kind).toBe('ignored')
    expect(checkNotePath('.agents/notes/implemented/feature/notes.txt', CONFIG).kind).toBe('ignored')
  })

  it('ignores files at the notes root and anything under templates/', () => {
    expect(checkNotePath('.agents/notes/README.md', CONFIG).kind).toBe('ignored')
    expect(checkNotePath('.agents/notes/todo.md', CONFIG).kind).toBe('ignored')
    expect(checkNotePath('.agents/notes/templates/proposed.md', CONFIG).kind).toBe('ignored')
  })

  it('rejects files at the wrong depth', () => {
    const shallow = checkNotePath('.agents/notes/implemented/loose.md', CONFIG)
    expect(shallow).toMatchObject({ kind: 'invalid' })
    if (shallow.kind === 'invalid') expect(shallow.message).toContain('depth 2')
    const deep = checkNotePath('.agents/notes/implemented/feature/sub/2026-01-01-x.md', CONFIG)
    expect(deep).toMatchObject({ kind: 'invalid' })
    if (deep.kind === 'invalid') expect(deep.message).toContain('depth 4')
  })

  it('rejects unknown lifecycle folders with a move hint', () => {
    const check = checkNotePath('.agents/notes/draft/feature/2026-01-01-x.md', CONFIG)
    expect(check).toMatchObject({ kind: 'invalid' })
    if (check.kind === 'invalid') {
      expect(check.message).toContain('unknown lifecycle')
      expect(check.message).toContain('proposed, implemented, rejected, archived')
    }
  })

  it('rejects unknown class folders with a config-or-move hint', () => {
    const check = checkNotePath('.agents/notes/implemented/refactor/2026-01-01-x.md', CONFIG)
    expect(check).toMatchObject({ kind: 'invalid' })
    if (check.kind === 'invalid') {
      expect(check.message).toContain('notes.classes')
      expect(check.message).toContain('move the file')
    }
  })

  it('rejects bad filenames, bad dates, and bad slugs', () => {
    const name = checkNotePath('.agents/notes/implemented/feature/x.md', CONFIG)
    expect(name).toMatchObject({ kind: 'invalid' })
    if (name.kind === 'invalid') expect(name.message).toContain('yyyy-mm-dd-slug.md')
    const date = checkNotePath('.agents/notes/implemented/feature/2026-02-30-x.md', CONFIG)
    expect(date).toMatchObject({ kind: 'invalid' })
    if (date.kind === 'invalid') expect(date.message).toContain('not a real calendar date')
    const slug = checkNotePath('.agents/notes/implemented/feature/2026-01-01-Bad_Slug.md', CONFIG)
    expect(slug).toMatchObject({ kind: 'invalid' })
    if (slug.kind === 'invalid') expect(slug.message).toContain('lowercase')
    const dashes = checkNotePath('.agents/notes/implemented/feature/2026-01-01-a--b.md', CONFIG)
    expect(dashes.kind).toBe('invalid')
  })

  it('honors a configured root and class set', () => {
    const custom: NotesConfig = { root: 'docs/notes', classes: ['decision'] }
    expect(checkNotePath('docs/notes/proposed/decision/2026-01-01-x.md', custom).kind).toBe('note')
    expect(checkNotePath('docs/notes/proposed/feature/2026-01-01-x.md', custom).kind).toBe('invalid')
  })
})

describe('parseNotePath', () => {
  it('returns the entry for valid paths and undefined otherwise', () => {
    expect(parseNotePath('.agents/notes/rejected/process/2026-01-02-no-tabs.md', CONFIG)).toMatchObject({
      lifecycle: 'rejected',
      class: 'process',
      slug: 'no-tabs',
    })
    expect(parseNotePath('.agents/notes/README.md', CONFIG)).toBeUndefined()
    expect(parseNotePath('.agents/notes/implemented/feature/x.md', CONFIG)).toBeUndefined()
  })
})

describe('isArchivedNotePath', () => {
  it('recognizes files in the archived tree, valid filename or not', () => {
    expect(isArchivedNotePath('.agents/notes/archived/feature/2026-01-01-x.md', CONFIG)).toBe(true)
    expect(isArchivedNotePath('.agents/notes/archived/feature/not-dated.md', CONFIG)).toBe(true)
    expect(isArchivedNotePath('.agents/notes/implemented/feature/2026-01-01-x.md', CONFIG)).toBe(false)
    expect(isArchivedNotePath('.agents/notes/archived/feature/2026-01-01-x.zh.md', CONFIG)).toBe(false)
    expect(isArchivedNotePath('.agents/notes/archived/manifest.json', CONFIG)).toBe(false)
    expect(isArchivedNotePath('.agents/notes/archived/feature/sub/2026-01-01-x.md', CONFIG)).toBe(false)
  })
})

describe('walkAgentNoteTree', () => {
  it('returns nothing when the notes root is absent', () => {
    expect(walkAgentNoteTree(repo(), CONFIG)).toEqual([])
  })

  it('finds valid notes across lifecycles and skips everything else', () => {
    const root = repo()
    const valid = [
      '.agents/notes/proposed/feature/2026-01-01-alpha.md',
      '.agents/notes/implemented/bug-fix/2026-02-02-beta.md',
      '.agents/notes/rejected/process/2026-03-03-gamma.md',
      '.agents/notes/archived/architecture/2026-04-04-delta.md',
    ]
    for (const rel of valid) write(root, rel)
    write(root, '.agents/notes/implemented/bug-fix/2026-02-02-beta.zh.md')
    write(root, '.agents/notes/implemented/unknown-class/2026-01-01-x.md')
    write(root, '.agents/notes/draft/feature/2026-01-01-x.md')
    write(root, '.agents/notes/implemented/feature/2026-99-99-bad-date.md')
    write(root, '.agents/notes/implemented/feature/not-dated.md')
    write(root, '.agents/notes/implemented/feature/notes.txt')
    write(root, '.agents/notes/archived/manifest.json', '{}')
    write(root, '.agents/notes/templates/proposed.md')
    write(root, '.agents/notes/README.md')

    const entries = walkAgentNoteTree(root, CONFIG)
    expect(entries.map((entry) => entry.relPath)).toEqual([...valid].sort())
    const beta = entries.find((entry) => entry.slug === 'beta')
    expect(beta).toBeDefined()
    expect(beta?.absPath).toBe(join(root, '.agents/notes/implemented/bug-fix/2026-02-02-beta.md'))
    expect(beta).toMatchObject({ lifecycle: 'implemented', class: 'bug-fix', date: '2026-02-02' })
  })

  it('skips lifecycle entries that are files instead of folders', () => {
    const root = repo()
    write(root, '.agents/notes/implemented')
    write(root, '.agents/notes/proposed/feature/2026-01-01-alpha.md')
    expect(walkAgentNoteTree(root, CONFIG).map((entry) => entry.slug)).toEqual(['alpha'])
  })

  it('skips nested folders inside class folders', () => {
    const root = repo()
    write(root, '.agents/notes/implemented/feature/sub/2026-01-01-deep.md')
    write(root, '.agents/notes/implemented/feature/2026-01-02-shallow.md')
    expect(walkAgentNoteTree(root, CONFIG).map((entry) => entry.slug)).toEqual(['shallow'])
  })
})

describe('listNoteCandidatePaths', () => {
  it('returns nothing for a missing root and lists files under lifecycle folders recursively', () => {
    const empty = repo()
    expect(listNoteCandidatePaths(empty, CONFIG)).toEqual([])
    const root = repo()
    write(root, '.agents/notes/implemented/feature/2026-01-01-a.md')
    write(root, '.agents/notes/implemented/feature/sub/deep.md')
    write(root, '.agents/notes/implemented/loose.md')
    write(root, '.agents/notes/archived/manifest.json', '{}')
    write(root, '.agents/notes/README.md')
    write(root, '.agents/notes/draft/feature/2026-01-01-b.md')
    write(root, 'outside/root-file.md')
    expect(listNoteCandidatePaths(root, CONFIG)).toEqual([
      '.agents/notes/archived/manifest.json',
      '.agents/notes/implemented/feature/2026-01-01-a.md',
      '.agents/notes/implemented/feature/sub/deep.md',
      '.agents/notes/implemented/loose.md',
    ])
  })

  it('survives a lifecycle entry that is a file', () => {
    const root = repo()
    write(root, '.agents/notes/proposed')
    expect(listNoteCandidatePaths(root, CONFIG)).toEqual([])
  })
})

describe('walkNotesTreeStructure', () => {
  it('reports nothing for a missing root or a clean root', () => {
    expect(walkNotesTreeStructure(repo(), CONFIG)).toEqual([])
    const root = repo()
    write(root, '.agents/notes/README.md')
    write(root, '.agents/notes/templates/proposed.md')
    write(root, '.agents/notes/proposed/feature/2026-01-01-a.md')
    expect(walkNotesTreeStructure(root, CONFIG)).toEqual([])
  })

  it('flags unknown top-level folders and stray root files', () => {
    const root = repo()
    write(root, '.agents/notes/draft/feature/2026-01-01-a.md')
    write(root, '.agents/notes/scratch.md')
    const issues = walkNotesTreeStructure(root, CONFIG)
    expect(issues).toHaveLength(2)
    const folder = issues.find((issue) => issue.path.endsWith('draft'))
    expect(folder?.message).toContain('unknown notes folder')
    expect(issues.find((issue) => issue.path.endsWith('scratch.md'))?.message).toContain('only README.md')
  })
})
