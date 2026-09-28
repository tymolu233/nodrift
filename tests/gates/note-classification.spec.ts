import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { GateContext, KitConfig } from '../../src/core/types.js'
import { noteClassificationGate } from '../../src/gates/note-classification.js'
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
  agents: [],
}

function repo(): string {
  return tmpRoot('nodrift-gate-cls-')
}

function write(root: string, rel: string, content = 'x\n'): void {
  const abs = join(root, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

function ctx(root: string, config: KitConfig = CONFIG): GateContext {
  return { repoRoot: root, options: {}, config }
}

describe('noteClassificationGate', () => {
  it('declares its honesty contract and a zero minimum corpus', () => {
    expect(noteClassificationGate.id).toBe('note-classification')
    expect(noteClassificationGate.doc).toContain('Does not prove')
    expect(noteClassificationGate.minCorpus).toBe(0)
  })

  it('is green on a repository without a notes tree', async () => {
    const result = await noteClassificationGate.run(ctx(repo()))
    expect(result.violations).toEqual([])
    expect(result.corpus.admitted).toBe(0)
  })

  it('is green on valid notes and counts them', async () => {
    const root = repo()
    write(root, '.agents/notes/proposed/feature/2026-01-01-alpha.md')
    write(root, '.agents/notes/archived/process/2026-02-02-beta.md')
    write(root, '.agents/notes/archived/manifest.json', '{}')
    write(root, '.agents/notes/README.md')
    write(root, '.agents/notes/templates/proposed.md')
    write(root, '.agents/notes/proposed/feature/2026-01-01-alpha.zh.md')
    const result = await noteClassificationGate.run(ctx(root))
    expect(result.violations).toEqual([])
    expect(result.corpus.admitted).toBe(2)
  })

  it('rejects an unknown class folder with a config-or-move hint', async () => {
    const root = repo()
    write(root, '.agents/notes/implemented/refactor/2026-01-01-x.md')
    const result = await noteClassificationGate.run(ctx(root))
    expect(result.corpus.admitted).toBe(1)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]).toMatchObject({
      gate: 'note-classification',
      file: '.agents/notes/implemented/refactor/2026-01-01-x.md',
    })
    expect(result.violations[0]?.message).toContain('notes.classes')
  })

  it('rejects unknown lifecycle folders at the top level', async () => {
    const root = repo()
    write(root, '.agents/notes/draft/feature/2026-01-01-x.md')
    const result = await noteClassificationGate.run(ctx(root))
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]?.file).toBe('.agents/notes/draft')
    expect(result.violations[0]?.message).toContain('unknown notes folder')
  })

  it('rejects bad filenames, dates, and slugs per file', async () => {
    const root = repo()
    write(root, '.agents/notes/implemented/feature/not-dated.md')
    write(root, '.agents/notes/implemented/feature/2026-02-30-x.md')
    write(root, '.agents/notes/proposed/process/2026-01-01-Upper_Case.md')
    const result = await noteClassificationGate.run(ctx(root))
    expect(result.corpus.admitted).toBe(3)
    const messages = result.violations.map((v) => v.message).join('\n')
    expect(messages).toContain('yyyy-mm-dd-slug.md')
    expect(messages).toContain('not a real calendar date')
    expect(messages).toContain('lowercase')
  })

  it('rejects notes at the wrong depth', async () => {
    const root = repo()
    write(root, '.agents/notes/implemented/loose.md')
    write(root, '.agents/notes/implemented/feature/sub/2026-01-01-x.md')
    const result = await noteClassificationGate.run(ctx(root))
    expect(result.violations.map((v) => v.message).join('\n')).toContain('depth')
  })

  it('honors a configured root and class set', async () => {
    const root = repo()
    write(root, 'notes/proposed/decision/2026-01-01-x.md')
    const custom: KitConfig = { notes: { root: 'notes', classes: ['decision'] }, gates: {}, agents: [] }
    const result = await noteClassificationGate.run(ctx(root, custom))
    expect(result.violations).toEqual([])
    expect(result.corpus.admitted).toBe(1)
  })
})
