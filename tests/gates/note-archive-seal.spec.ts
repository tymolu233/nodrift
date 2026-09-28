import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sha256File } from '../../src/core/hash.js'
import type { GateContext, KitConfig } from '../../src/core/types.js'
import { noteArchiveSealGate } from '../../src/gates/note-archive-seal.js'
import { archiveNote } from '../../src/notes/archive.js'

const CONFIG: KitConfig = {
  notes: {
    root: '.agents/notes',
    classes: ['feature', 'bug-fix', 'simplification', 'architecture', 'process', 'testing'],
  },
  gates: {},
}

function repo(): string {
  return mkdtempSync(join(tmpdir(), 'anti-shishan-gate-seal-'))
}

function write(root: string, rel: string, content: string): void {
  const abs = join(root, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

function ctx(root: string): GateContext {
  return { repoRoot: root, options: {}, config: CONFIG }
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

describe('noteArchiveSealGate', () => {
  it('declares its honesty contract and a zero minimum corpus', () => {
    expect(noteArchiveSealGate.id).toBe('note-archive-seal')
    expect(noteArchiveSealGate.doc).toContain('Does not prove')
    expect(noteArchiveSealGate.minCorpus).toBe(0)
  })

  it('is green on a repository without an archive', async () => {
    const result = await noteArchiveSealGate.run(ctx(repo()))
    expect(result.violations).toEqual([])
    expect(result.corpus.admitted).toBe(0)
  })

  it('is green after a proper archival and counts the sealed note', async () => {
    const root = repo()
    write(root, IMPLEMENTED_REL, IMPLEMENTED_NOTE)
    archiveNote(root, IMPLEMENTED_REL, CONFIG.notes)
    const result = await noteArchiveSealGate.run(ctx(root))
    expect(result.violations).toEqual([])
    expect(result.corpus.admitted).toBe(1)
  })

  it('surfaces an unsealed archived note', async () => {
    const root = repo()
    write(
      root,
      '.agents/notes/archived/process/2026-09-28-add-the-seal.md',
      IMPLEMENTED_NOTE.replace('Status: implemented', 'Status: implemented\nArchived: 2026-09-28'),
    )
    const result = await noteArchiveSealGate.run(ctx(root))
    expect(result.violations.map((v) => v.message).join('\n')).toContain('not sealed')
    expect(result.violations.every((v) => v.gate === 'note-archive-seal')).toBe(true)
  })

  it('surfaces a corrupt manifest and a tampered sealed file', async () => {
    const root = repo()
    write(root, '.agents/notes/archived/manifest.json', '{ nope')
    expect((await noteArchiveSealGate.run(ctx(root))).violations.map((v) => v.message).join('\n')).toContain(
      'corrupt',
    )

    const root2 = repo()
    const archivedRel = '.agents/notes/archived/process/2026-09-28-add-the-seal.md'
    write(
      root2,
      archivedRel,
      IMPLEMENTED_NOTE.replace('Status: implemented', 'Status: implemented\nArchived: 2026-09-28'),
    )
    write(
      root2,
      '.agents/notes/archived/manifest.json',
      JSON.stringify({
        'archived/process/2026-09-28-add-the-seal.md': { sha256: '0'.repeat(64) },
      }),
    )
    expect(sha256File(join(root2, archivedRel))).not.toBe('0'.repeat(64))
    const result = await noteArchiveSealGate.run(ctx(root2))
    expect(result.violations.map((v) => v.message).join('\n')).toContain('changed after sealing')
  })
})
