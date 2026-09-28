import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { GateContext, KitConfig } from '../../src/core/types.js'
import { noteFormatGate } from '../../src/gates/note-format.js'
const tempRoots: string[] = []

function tmpRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix))
  tempRoots.push(root)
  return root
}

afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop() as string, { recursive: true, force: true })
})

const CONFIG: KitConfig = {
  notes: {
    root: '.agents/notes',
    classes: ['feature', 'bug-fix', 'simplification', 'architecture', 'process', 'testing'],
  },
  gates: {},
}

function repo(): string {
  return tmpRoot('anti-shishan-gate-fmt-')
}

function write(root: string, rel: string, content: string): void {
  const abs = join(root, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

function ctx(root: string): GateContext {
  return { repoRoot: root, options: {}, config: CONFIG }
}

const IMPLEMENTED_OK = `# Agent Note: Sample
Status: implemented

## Problem

Something was missing.

## Decision

It was added.

## Alternatives considered

- **Do nothing** — kept the gap.

## Consequences

The gap closed.
`

describe('noteFormatGate', () => {
  it('declares its honesty contract and a zero minimum corpus', () => {
    expect(noteFormatGate.id).toBe('note-format')
    expect(noteFormatGate.doc).toContain('Does not prove')
    expect(noteFormatGate.minCorpus).toBe(0)
  })

  it('is green on an empty notes tree', async () => {
    const result = await noteFormatGate.run(ctx(repo()))
    expect(result.violations).toEqual([])
    expect(result.corpus.admitted).toBe(0)
  })

  it('is green on conforming notes and counts them', async () => {
    const root = repo()
    write(root, '.agents/notes/implemented/feature/2026-01-01-a.md', IMPLEMENTED_OK)
    write(root, '.agents/notes/implemented/feature/2026-01-02-b.md', IMPLEMENTED_OK)
    const result = await noteFormatGate.run(ctx(root))
    expect(result.violations).toEqual([])
    expect(result.corpus.admitted).toBe(2)
  })

  it('never examines files outside the notes tree', async () => {
    const root = repo()
    write(root, 'docs/not-a-note.md', '# Nope\nStatus: bogus\n')
    const result = await noteFormatGate.run(ctx(root))
    expect(result.violations).toEqual([])
    expect(result.corpus.admitted).toBe(0)
  })

  it('aggregates format violations across broken notes', async () => {
    const root = repo()
    write(root, '.agents/notes/implemented/feature/2026-01-01-no-status.md', IMPLEMENTED_OK.replace('Status: implemented', 'Status: proposed'))
    write(
      root,
      '.agents/notes/implemented/feature/2026-01-02-empty-alternatives.md',
      IMPLEMENTED_OK.replace('- **Do nothing** — kept the gap.\n\n', ''),
    )
    const result = await noteFormatGate.run(ctx(root))
    expect(result.corpus.admitted).toBe(2)
    expect(result.violations.every((v) => v.gate === 'note-format')).toBe(true)
    const messages = result.violations.map((v) => v.message).join('\n')
    expect(messages).toContain('status grammar')
    expect(messages).toContain('at least one real alternative')
    expect(result.violations.every((v) => v.file !== undefined && v.file.endsWith('.md'))).toBe(true)
  })
})
