import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { budgetStatus, countWords, docBudgetsGate, parseBudgets } from '../../src/gates/doc-budgets.js'
import type { GateContext } from '../../src/core/types.js'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'nodrift-doc-budgets-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function writeRepo(files: Record<string, string>): void {
  for (const [file, content] of Object.entries(files)) {
    const abs = join(root, file)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }
}

function ctx(options: Record<string, unknown> = {}): GateContext {
  return {
    repoRoot: root,
    options,
    config: { notes: { root: '.agents/notes', classes: ['process'] }, gates: {}, agents: [] },
  }
}

/** A document of exactly `n` whitespace-delimited words. */
function words(n: number): string {
  return `${'word '.repeat(n)}\n`
}

describe('countWords / budgetStatus', () => {
  it('counts whitespace-delimited tokens like wc -w', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('a  b\n\n c\td\n')).toBe(4)
  })

  it('classifies the three budget bands with exact boundaries', () => {
    expect(budgetStatus(95, 100)).toBe('ok')
    expect(budgetStatus(96, 100)).toBe('headroom')
    expect(budgetStatus(100, 100)).toBe('headroom')
    expect(budgetStatus(101, 100)).toBe('over')
  })
})

describe('parseBudgets', () => {
  it('fails when budgets are missing or not a mapping', () => {
    expect(() => parseBudgets({})).toThrow('doc-budgets: budgets is required')
    expect(() => parseBudgets({ budgets: 'x' })).toThrow('budgets must be a mapping')
    expect(() => parseBudgets({ budgets: ['a.md'] })).toThrow('budgets must be a mapping')
  })

  it('fails on non-positive-integer ceilings', () => {
    for (const ceiling of [0, -3, 1.5, '100', true, Number.NaN]) {
      expect(() => parseBudgets({ budgets: { 'a.md': ceiling } })).toThrow(`ceiling for "a.md" must be a positive integer`)
    }
  })

  it('fails on non-repo-relative budget keys', () => {
    for (const path of ['/abs/a.md', '../a.md', 'docs\\a.md', '']) {
      expect(() => parseBudgets({ budgets: { [path]: 10 } })).toThrow('must be a repo-relative path with forward slashes')
    }
  })

  it('returns the validated mapping', () => {
    expect(parseBudgets({ budgets: { 'a.md': 100, 'docs/b.md': 50 } })).toEqual({ 'a.md': 100, 'docs/b.md': 50 })
  })
})

describe('docBudgetsGate.run', () => {
  it('passes a file at or below 95% of its ceiling', async () => {
    writeRepo({ 'a.md': words(95) })
    const result = await docBudgetsGate.run(ctx({ budgets: { 'a.md': 100 } }))
    expect(result).toEqual({ violations: [], corpus: { admitted: 1 } })
  })

  it.each([
    [96, 100],
    [100, 100],
  ])('flags the ratchet band at %i of %i words', async (used, ceiling) => {
    writeRepo({ 'a.md': words(used) })
    const result = await docBudgetsGate.run(ctx({ budgets: { 'a.md': ceiling } }))
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]?.message).toContain(`${used} of ${ceiling} words used`)
    expect(result.violations[0]?.message).toContain('ratchet down')
  })

  it('flags usage above the ceiling as the primary violation', async () => {
    writeRepo({ 'a.md': words(101) })
    const result = await docBudgetsGate.run(ctx({ budgets: { 'a.md': 100 } }))
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]?.message).toContain('101 words exceeds the 100-word ceiling')
    expect(result.violations[0]?.file).toBe('a.md')
  })

  it('counts fenced code blocks toward the word total', async () => {
    // 88 prose words + 2 fence tokens + an 11-word fenced block = 101 → over.
    writeRepo({ 'a.md': `${words(88)}\n\`\`\`\n${words(11)}\`\`\`\n` })
    const result = await docBudgetsGate.run(ctx({ budgets: { 'a.md': 100 } }))
    expect(result.violations[0]?.message).toContain('101 words exceeds')
  })

  it('flags a budget pointing at a missing file', async () => {
    writeRepo({ 'exists.md': 'ok\n' })
    const result = await docBudgetsGate.run(ctx({ budgets: { 'gone.md': 100 } }))
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]).toMatchObject({ gate: 'doc-budgets', file: 'gone.md' })
    expect(result.violations[0]?.message).toContain('budgeted file does not exist')
    expect(result.corpus.admitted).toBe(1)
  })

  it('flags an empty budgets mapping as a gate misconfiguration', async () => {
    writeRepo({ 'a.md': 'ok\n' })
    const result = await docBudgetsGate.run(ctx({ budgets: {} }))
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]?.message).toContain('budgets is empty')
    expect(result.corpus.admitted).toBe(0)
  })

  it('checks only listed files and reports them sorted', async () => {
    writeRepo({ 'z.md': words(101), 'a.md': words(101), 'unlisted.md': words(500) })
    const result = await docBudgetsGate.run(ctx({ budgets: { 'z.md': 100, 'a.md': 100 } }))
    expect(result.corpus.admitted).toBe(2)
    expect(result.violations.map((v) => v.file)).toEqual(['a.md', 'z.md'])
  })

  it('fails loud on an unknown option key', async () => {
    writeRepo({ 'a.md': 'ok\n' })
    await expect(docBudgetsGate.run(ctx({ budgets: { 'a.md': 100 }, include: ['*.md'] }))).rejects.toThrow(
      'doc-budgets: unknown option key "include" (known: enabled, budgets)',
    )
  })
})
