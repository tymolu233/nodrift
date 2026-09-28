import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { NotesConfig } from '../../src/core/types.js'
import { archiveNote, resealArchive, verifyArchiveSeal } from '../../src/notes/archive.js'
import { createNote } from '../../src/notes/new.js'
import { checkNoteFormat } from '../../src/notes/format.js'
import { parseNotePath } from '../../src/notes/tree.js'

const CONFIG: NotesConfig = { root: '.agents/notes', classes: ['process'] }

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'anti-shishan-crlf-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function newNote(title: string, date = '2026-09-28'): string {
  return createNote(root, CONFIG, { lifecycle: 'proposed', class: 'process', title, date })
}

function writeFile(rel: string, content: string): string {
  const abs = join(root, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
  return abs
}

function readRel(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

describe('CRLF tolerance', () => {
  it('accepts a fully-CRLF note at checkNoteFormat', () => {
    const rel = newNote('Crlf Note')
    const abs = join(root, rel)
    writeFileSync(abs, readFileSync(abs, 'utf8').replaceAll('\n', '\r\n'))
    const entry = parseNotePath(rel, CONFIG)
    expect(entry?.lifecycle).toBe('proposed')
    expect(checkNoteFormat(abs, entry as NonNullable<typeof entry>)).toEqual([])
  })

  it('archive preserves the note CRLF line endings and seals exactly those bytes', () => {
    const proposed = newNote('Crlf Impl')
    const skeleton = readRel(proposed)
      .replace('Status: proposed', 'Status: implemented')
      .replace('## Proposal', '## Decision')
      .replace('## Acceptance criteria', '## Consequences')
      .replace('## Risks\n', '')
    rmSync(join(root, proposed), { force: true })
    const rel = '.agents/notes/implemented/process/2026-09-28-crlf-impl.md'
    writeFile(rel, skeleton.replaceAll('\n', '\r\n'))
    const target = archiveNote(root, rel, CONFIG)
    const bytes = readFileSync(join(root, target), 'utf8')
    expect(/(^|[^\r])\n/.test(bytes)).toBe(false)
    expect(bytes.split('\r\n')[2]).toMatch(/^Archived: \d{4}-\d{2}-\d{2}$/)
    expect(verifyArchiveSeal(root, CONFIG)).toEqual([])
  })
})

describe('archive content integrity', () => {
  it('archived content equals the original with exactly one line inserted at index 2', () => {
    const rel = newNote('Integrity Check')
    const original = readFileSync(join(root, rel), 'utf8')
      .replace('Status: proposed', 'Status: implemented')
      .replace('## Proposal', '## Decision')
      .replace('## Acceptance criteria', '## Consequences')
      .replace('## Risks\n', '')
    const implRel = '.agents/notes/implemented/process/2026-09-28-integrity-check.md'
    rmSync(join(root, rel), { force: true })
    writeFile(implRel, original)
    const target = archiveNote(root, implRel, CONFIG)
    const got = readFileSync(join(root, target), 'utf8').split('\n')
    const want = original.split('\n')
    expect(got[0]).toBe(want[0])
    expect(got[1]).toBe(want[1])
    expect(got[2]).toMatch(/^Archived: \d{4}-\d{2}-\d{2}$/)
    expect(got.slice(3)).toEqual(want.slice(2))
  })
})

describe('resealArchive', () => {
  it('rebuilds a deleted manifest and returns a green seal', () => {
    const proposed = newNote('Reseal Me')
    const skeleton = readRel(proposed)
      .replace('Status: proposed', 'Status: implemented')
      .replace('## Proposal', '## Decision')
      .replace('## Acceptance criteria', '## Consequences')
      .replace('## Risks\n', '')
    rmSync(join(root, proposed), { force: true })
    const implRel = '.agents/notes/implemented/process/2026-09-28-reseal-me.md'
    writeFile(implRel, skeleton)
    archiveNote(root, implRel, CONFIG)
    rmSync(join(root, '.agents/notes/archived/manifest.json'), { force: true })
    expect(verifyArchiveSeal(root, CONFIG).length).toBeGreaterThan(0)
    const resealed = resealArchive(root, CONFIG)
    expect(resealed).toEqual(['.agents/notes/archived/process/2026-09-28-reseal-me.md'])
    expect(verifyArchiveSeal(root, CONFIG)).toEqual([])
    expect(existsSync(join(root, '.agents/notes/archived/manifest.json'))).toBe(true)
  })

  it('refuses an archived note missing its Archived line', () => {
    const bad = '.agents/notes/archived/process/2026-09-28-half-moved.md'
    writeFile(bad, ['# Agent Note: Half Moved', 'Status: implemented', '', '## Problem', '', 'p', '', '## Decision', '', 'd', '', '## Alternatives considered', '', '- **x** — y', '', '## Consequences', '', 'c', ''].join('\n'))
    expect(() => resealArchive(root, CONFIG)).toThrow(/half-moved/)
  })

  it('refuses an archived note too short to carry a seal line', () => {
    const bad = '.agents/notes/archived/process/2026-09-28-two-lines.md'
    writeFile(bad, '# Agent Note: Two Lines\nStatus: implemented\n')
    expect(() => resealArchive(root, CONFIG)).toThrow(/two-lines/)
  })

  it('refuses a zero-byte archived note', () => {
    const bad = '.agents/notes/archived/process/2026-09-28-empty.md'
    writeFile(bad, '')
    expect(() => resealArchive(root, CONFIG)).toThrow(/empty/)
  })

  it('skips non-archived notes during the walk', () => {
    const proposed = newNote('Still Proposed')
    expect(resealArchive(root, CONFIG)).toEqual([])
    expect(existsSync(join(root, proposed))).toBe(true)
  })

  it('reseals an empty archive to an empty manifest', () => {
    expect(resealArchive(root, CONFIG)).toEqual([])
    expect(JSON.parse(readFileSync(join(root, '.agents/notes/archived/manifest.json'), 'utf8'))).toEqual({})
  })

  it('records the git blob again when resealing inside a work tree', async () => {
    const { execFileSync } = await import('node:child_process')
    execFileSync('git', ['init', '-q'], { cwd: root })
    const proposed = newNote('Git Reseal')
    const skeleton = readRel(proposed)
      .replace('Status: proposed', 'Status: implemented')
      .replace('## Proposal', '## Decision')
      .replace('## Acceptance criteria', '## Consequences')
      .replace('## Risks\n', '')
    rmSync(join(root, proposed), { force: true })
    const implRel = '.agents/notes/implemented/process/2026-09-28-git-reseal.md'
    writeFile(implRel, skeleton)
    archiveNote(root, implRel, CONFIG)
    const manifestBefore = JSON.parse(readFileSync(join(root, '.agents/notes/archived/manifest.json'), 'utf8')) as Record<string, { gitBlob?: string }>
    expect(manifestBefore['archived/process/2026-09-28-git-reseal.md']?.gitBlob).toBeDefined()
    resealArchive(root, CONFIG)
    const manifestAfter = JSON.parse(readFileSync(join(root, '.agents/notes/archived/manifest.json'), 'utf8')) as Record<string, { gitBlob?: string }>
    expect(manifestAfter['archived/process/2026-09-28-git-reseal.md']?.gitBlob).toBeDefined()
    expect(verifyArchiveSeal(root, CONFIG)).toEqual([])
  })
})
