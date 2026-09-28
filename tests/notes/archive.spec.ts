import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sha256File } from '../../src/core/hash.js'
import type { NotesConfig } from '../../src/core/types.js'
import { archiveNote, verifyArchiveSeal } from '../../src/notes/archive.js'

const CONFIG: NotesConfig = {
  root: '.agents/notes',
  classes: ['feature', 'bug-fix', 'simplification', 'architecture', 'process', 'testing'],
}

function repo(git = false): string {
  const root = mkdtempSync(join(tmpdir(), 'nodrift-archive-'))
  if (git) execFileSync('git', ['init'], { cwd: root, stdio: 'ignore' })
  return root
}

function write(root: string, rel: string, content: string): void {
  const abs = join(root, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

function read(root: string, rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

const IMPLEMENTED_NOTE = `# Agent Note: Add the seal
Status: implemented

## Problem

Archive had no seal.

## Decision

A manifest now seals archived notes.

## Alternatives considered

- **Trust git history** — too easy to rewrite.

## Consequences

Archived files are frozen.
`

const IMPLEMENTED_REL = '.agents/notes/implemented/process/2026-09-28-add-the-seal.md'
const ARCHIVED_REL = '.agents/notes/archived/process/2026-09-28-add-the-seal.md'
const MANIFEST_REL = '.agents/notes/archived/manifest.json'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

describe('archiveNote', () => {
  it('moves the note into archived/, inserts the Archived line, and seals it', () => {
    const root = repo()
    write(root, IMPLEMENTED_REL, IMPLEMENTED_NOTE)
    const target = archiveNote(root, IMPLEMENTED_REL, CONFIG)
    expect(target).toBe(ARCHIVED_REL)
    expect(existsSync(join(root, IMPLEMENTED_REL))).toBe(false)
    const lines = read(root, ARCHIVED_REL).split('\n')
    expect(lines[1]).toBe('Status: implemented')
    expect(lines[2]).toBe(`Archived: ${todayISO()}`)
    const manifest = JSON.parse(read(root, MANIFEST_REL)) as Record<string, { sha256?: string; gitBlob?: string }>
    expect(Object.keys(manifest)).toEqual(['archived/process/2026-09-28-add-the-seal.md'])
    expect(manifest['archived/process/2026-09-28-add-the-seal.md']?.sha256).toBe(
      sha256File(join(root, ARCHIVED_REL)),
    )
    expect(manifest['archived/process/2026-09-28-add-the-seal.md']?.gitBlob).toBeUndefined()
    expect(verifyArchiveSeal(root, CONFIG)).toEqual([])
  })

  it('records the git blob when git can answer', () => {
    const root = repo(true)
    write(root, IMPLEMENTED_REL, IMPLEMENTED_NOTE)
    archiveNote(root, IMPLEMENTED_REL, CONFIG)
    const manifest = JSON.parse(read(root, MANIFEST_REL)) as Record<string, { gitBlob?: string }>
    expect(manifest['archived/process/2026-09-28-add-the-seal.md']?.gitBlob).toMatch(/^[0-9a-f]{40}$/)
    expect(verifyArchiveSeal(root, CONFIG)).toEqual([])
  })

  it('moves a same-stem .zh.md copy along, without sealing it', () => {
    const root = repo()
    write(root, IMPLEMENTED_REL, IMPLEMENTED_NOTE)
    write(root, IMPLEMENTED_REL.replace(/\.md$/, '.zh.md'), '# zh\n')
    archiveNote(root, IMPLEMENTED_REL, CONFIG)
    expect(existsSync(join(root, ARCHIVED_REL.replace(/\.md$/, '.zh.md')))).toBe(true)
    expect(existsSync(join(root, IMPLEMENTED_REL.replace(/\.md$/, '.zh.md')))).toBe(false)
    expect(verifyArchiveSeal(root, CONFIG)).toEqual([])
  })

  it('leaves the .zh.md copy behind when the archive slot already has one', () => {
    const root = repo()
    write(root, IMPLEMENTED_REL, IMPLEMENTED_NOTE)
    const sourceZh = IMPLEMENTED_REL.replace(/\.md$/, '.zh.md')
    write(root, sourceZh, '# zh new\n')
    write(root, ARCHIVED_REL.replace(/\.md$/, '.zh.md'), '# zh old\n')
    archiveNote(root, IMPLEMENTED_REL, CONFIG)
    expect(read(root, ARCHIVED_REL.replace(/\.md$/, '.zh.md'))).toBe('# zh old\n')
    expect(existsSync(join(root, sourceZh))).toBe(true)
  })

  it('appends to an existing manifest without touching earlier seals', () => {
    const root = repo()
    write(root, IMPLEMENTED_REL, IMPLEMENTED_NOTE)
    archiveNote(root, IMPLEMENTED_REL, CONFIG)
    const secondRel = '.agents/notes/implemented/process/2026-09-01-second.md'
    write(root, secondRel, IMPLEMENTED_NOTE)
    archiveNote(root, secondRel, CONFIG)
    expect(Object.keys(JSON.parse(read(root, MANIFEST_REL)) as Record<string, unknown>)).toEqual([
      'archived/process/2026-09-01-second.md',
      'archived/process/2026-09-28-add-the-seal.md',
    ])
    expect(verifyArchiveSeal(root, CONFIG)).toEqual([])
  })

  it('refuses to archive anything but implemented notes', () => {
    const root = repo()
    const proposed = '.agents/notes/proposed/feature/2026-09-28-idea.md'
    write(root, proposed, IMPLEMENTED_NOTE.replace('Status: implemented', 'Status: proposed'))
    expect(() => archiveNote(root, proposed, CONFIG)).toThrow(/only implemented notes/)
    expect(existsSync(join(root, proposed))).toBe(true)
  })

  it('refuses a path that is not a note at all', () => {
    const root = repo()
    expect(() => archiveNote(root, 'docs/random.md', CONFIG)).toThrow(/not a valid note path/)
  })

  it('refuses a note that violates the format and leaves it in place', () => {
    const root = repo()
    const broken = IMPLEMENTED_NOTE.replace('## Alternatives considered\n\n- **Trust git history** — too easy to rewrite.\n\n', '')
    write(root, IMPLEMENTED_REL, broken)
    expect(() => archiveNote(root, IMPLEMENTED_REL, CONFIG)).toThrow(/violates the note format/)
    expect(existsSync(join(root, IMPLEMENTED_REL))).toBe(true)
  })

  it('refuses to append while the existing seal is broken', () => {
    const root = repo()
    write(root, ARCHIVED_REL, IMPLEMENTED_NOTE.replace(
      'Status: implemented',
      'Status: implemented\nArchived: 2026-09-01',
    ))
    write(root, MANIFEST_REL, '{ not json')
    write(root, IMPLEMENTED_REL, IMPLEMENTED_NOTE)
    expect(() => archiveNote(root, IMPLEMENTED_REL, CONFIG)).toThrow(/seal is broken/)
    expect(existsSync(join(root, IMPLEMENTED_REL))).toBe(true)
    expect(existsSync(join(root, ARCHIVED_REL))).toBe(true)
  })

  it('refuses to overwrite an existing archived file', () => {
    const root = repo()
    write(root, IMPLEMENTED_REL, IMPLEMENTED_NOTE)
    archiveNote(root, IMPLEMENTED_REL, CONFIG)
    write(root, IMPLEMENTED_REL, IMPLEMENTED_NOTE)
    expect(() => archiveNote(root, IMPLEMENTED_REL, CONFIG)).toThrow(/already exists/)
  })
})

describe('verifyArchiveSeal', () => {
  it('is green on a repository without any archive', () => {
    expect(verifyArchiveSeal(repo(), CONFIG)).toEqual([])
  })

  it('flags a corrupt manifest', () => {
    const root = repo()
    write(root, MANIFEST_REL, '{ not json')
    const violations = verifyArchiveSeal(root, CONFIG)
    expect(violations.map((v) => v.message).join('\n')).toContain('corrupt')
    expect(violations[0]).toMatchObject({ gate: 'note-archive-seal', file: MANIFEST_REL })
  })

  it('flags manifest entries outside the schema', () => {
    const root = repo()
    write(root, MANIFEST_REL, JSON.stringify(['not-an-object']))
    expect(verifyArchiveSeal(root, CONFIG).map((v) => v.message).join('\n')).toContain('expected a JSON object')
    rmSync(join(root, MANIFEST_REL))
    write(root, MANIFEST_REL, JSON.stringify({ 'archived/feature/2026-01-01-x.md': 'just-a-string' }))
    expect(verifyArchiveSeal(root, CONFIG).map((v) => v.message).join('\n')).toContain('64-hex sha256')
    rmSync(join(root, MANIFEST_REL))
    write(
      root,
      MANIFEST_REL,
      JSON.stringify({ 'archived/feature/2026-01-01-x.md': { sha256: 'a'.repeat(64), gitBlob: 42 } }),
    )
    expect(verifyArchiveSeal(root, CONFIG).map((v) => v.message).join('\n')).toContain('gitBlob as a string')
  })

  it('flags manifest keys that are not archived note paths', () => {
    const root = repo()
    write(root, MANIFEST_REL, JSON.stringify({ 'implemented/feature/2026-01-01-x.md': { sha256: 'a'.repeat(64) } }))
    expect(verifyArchiveSeal(root, CONFIG).map((v) => v.message).join('\n')).toContain('not an archived note path')
  })

  it('flags a sealed file that went missing', () => {
    const root = repo()
    write(
      root,
      MANIFEST_REL,
      JSON.stringify({ 'archived/feature/2026-01-01-gone.md': { sha256: 'a'.repeat(64) } }),
    )
    const violations = verifyArchiveSeal(root, CONFIG)
    expect(violations.map((v) => v.message).join('\n')).toContain('is missing')
  })

  it('flags a sealed file whose bytes changed', () => {
    const root = repo()
    write(root, IMPLEMENTED_REL, IMPLEMENTED_NOTE)
    archiveNote(root, IMPLEMENTED_REL, CONFIG)
    write(root, ARCHIVED_REL, `${read(root, ARCHIVED_REL)}tampered\n`)
    const messages = verifyArchiveSeal(root, CONFIG).map((v) => v.message).join('\n')
    expect(messages).toContain('changed after sealing')
  })

  it('flags a changed git blob when git recorded one', () => {
    const root = repo(true)
    write(root, IMPLEMENTED_REL, IMPLEMENTED_NOTE)
    archiveNote(root, IMPLEMENTED_REL, CONFIG)
    write(root, ARCHIVED_REL, `${read(root, ARCHIVED_REL)}tampered\n`)
    const messages = verifyArchiveSeal(root, CONFIG).map((v) => v.message).join('\n')
    expect(messages).toContain('git blob')
  })

  it('skips the git blob comparison when git cannot answer, even if a blob is recorded', () => {
    const root = repo()
    const archived = IMPLEMENTED_NOTE.replace('Status: implemented', 'Status: implemented\nArchived: 2026-09-01')
    write(root, ARCHIVED_REL, archived)
    write(
      root,
      MANIFEST_REL,
      JSON.stringify({
        'archived/process/2026-09-28-add-the-seal.md': {
          sha256: sha256File(join(root, ARCHIVED_REL)),
          gitBlob: '0'.repeat(40),
        },
      }),
    )
    expect(verifyArchiveSeal(root, CONFIG)).toEqual([])
  })

  it('flags an archived note that is not sealed', () => {
    const root = repo()
    write(root, ARCHIVED_REL, IMPLEMENTED_NOTE.replace('Status: implemented', 'Status: implemented\nArchived: 2026-09-01'))
    const messages = verifyArchiveSeal(root, CONFIG).map((v) => v.message).join('\n')
    expect(messages).toContain('not sealed')
  })

  it('flags an archived note truncated above line 3', () => {
    const root = repo()
    write(root, ARCHIVED_REL, '')
    write(
      root,
      MANIFEST_REL,
      JSON.stringify({
        'archived/process/2026-09-28-add-the-seal.md': { sha256: sha256File(join(root, ARCHIVED_REL)) },
      }),
    )
    const messages = verifyArchiveSeal(root, CONFIG).map((v) => v.message).join('\n')
    expect(messages).toContain('Archived: YYYY-MM-DD')
  })

  it('flags an archived note without an Archived line', () => {
    const root = repo()
    write(root, ARCHIVED_REL, IMPLEMENTED_NOTE)
    write(
      root,
      MANIFEST_REL,
      JSON.stringify({
        'archived/process/2026-09-28-add-the-seal.md': { sha256: sha256File(join(root, ARCHIVED_REL)) },
      }),
    )
    const messages = verifyArchiveSeal(root, CONFIG).map((v) => v.message).join('\n')
    expect(messages).toContain('Archived: YYYY-MM-DD')
  })
})
