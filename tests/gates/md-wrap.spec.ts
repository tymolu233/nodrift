import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { findWrappedParagraphs, mdWrapGate } from '../../src/gates/md-wrap.js'
import type { GateContext } from '../../src/core/types.js'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'govkit-md-wrap-'))
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
    config: { notes: { root: '.agents/notes', classes: ['process'] }, gates: {} },
  }
}

describe('findWrappedParagraphs', () => {
  it('flags a paragraph spanning multiple physical lines at its first line', () => {
    const hits = findWrappedParagraphs('one line\n\nwrapped sentence\ncontinues here\n')
    expect(hits).toHaveLength(1)
    expect(hits[0]?.line).toBe(3)
    expect(hits[0]?.text).toBe('wrapped sentence')
  })

  it('ignores single-line paragraphs', () => {
    expect(findWrappedParagraphs('one\n\ntwo\n\nthree\n')).toEqual([])
  })

  it('flags wrapped paragraphs inside list items', () => {
    expect(findWrappedParagraphs('- bullet line one\n  continued\n')).toHaveLength(1)
  })

  it('flags wrapped paragraphs inside blockquotes', () => {
    expect(findWrappedParagraphs('> quote line one\n> continued\n')).toHaveLength(1)
  })

  it('ignores fenced code, indented code, tables, and HTML blocks', () => {
    const source = [
      '```ts',
      'this is not prose',
      'and wraps freely',
      '```',
      '',
      '    indented code',
      '    also wraps',
      '',
      '| a | b |',
      '|---|---|',
      '| cell one | cell two |',
      '',
      '<div>',
      'html block content wraps',
      'without being prose',
      '</div>',
      '',
    ].join('\n')
    expect(findWrappedParagraphs(source)).toEqual([])
  })

  it('masks YAML frontmatter so its keys are not mistaken for prose', () => {
    // Without masking, lines 2–3 parse as one wrapped paragraph.
    const source = '---\ntitle: Wrapped\nlong continuation\n\nother: kept\n---\n\nreal prose\n'
    expect(findWrappedParagraphs(source)).toEqual([])
  })

  it('leaves an unterminated frontmatter marker alone', () => {
    expect(findWrappedParagraphs('---\nnot frontmatter\n')).toEqual([])
  })
})

describe('mdWrapGate.run', () => {
  it('reports repo-relative forward-slash files and 1-based lines', async () => {
    writeRepo({
      'README.md': 'fine\n',
      'docs/guide.md': 'ok line\n\nwrapped\nline\n',
    })
    const result = await mdWrapGate.run(ctx())
    expect(result.corpus.admitted).toBe(2)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]).toMatchObject({ gate: 'md-wrap', file: 'docs/guide.md', line: 3 })
    expect(result.violations[0]?.message).toContain('one physical line per paragraph')
  })

  it('passes a clean corpus', async () => {
    writeRepo({ 'a.md': 'one\n\ntwo\n', 'deep/nested/b.md': 'three\n' })
    const result = await mdWrapGate.run(ctx())
    expect(result).toEqual({ violations: [], corpus: { admitted: 2 } })
  })

  it('narrows the corpus with include and exclude globs', async () => {
    writeRepo({
      'README.md': 'fine\n',
      'docs/guide.md': 'wrapped\nline\n',
      'legacy/old.md': 'wrapped\nline\n',
    })
    const included = await mdWrapGate.run(ctx({ include: ['docs/**'] }))
    expect(included.corpus.admitted).toBe(1)
    expect(included.violations).toHaveLength(1)

    const excluded = await mdWrapGate.run(ctx({ exclude: ['docs/**', 'legacy/**'] }))
    expect(excluded.corpus.admitted).toBe(1)
    expect(excluded.violations).toEqual([])
  })

  it('truncates long first lines in the violation message with an ellipsis', async () => {
    const firstLine = `start ${'x'.repeat(100)}`
    writeRepo({ 'a.md': `${firstLine}\ncontinues\n` })
    const result = await mdWrapGate.run(ctx())
    expect(result.violations[0]?.message).toContain(`${firstLine.slice(0, 80)}…`)
  })

  it('does not check non-Markdown files by default', async () => {
    writeRepo({ 'code.ts': 'const a = "wrap\nlike"\n', 'a.md': 'fine\n' })
    const result = await mdWrapGate.run(ctx())
    expect(result.corpus.admitted).toBe(1)
    expect(result.violations).toEqual([])
  })

  it('fails loud on an unknown option key', async () => {
    writeRepo({ 'a.md': 'x\n' })
    await expect(mdWrapGate.run(ctx({ budgets: { 'a.md': 10 } }))).rejects.toThrow(
      'md-wrap: unknown option key "budgets" (known: enabled, include, exclude)',
    )
  })

  it('fails loud when include is not a list of strings', async () => {
    writeRepo({ 'a.md': 'x\n' })
    await expect(mdWrapGate.run(ctx({ include: 'docs/**' }))).rejects.toThrow('include must be a list of glob strings')
  })
})
