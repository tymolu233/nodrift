import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { occurrenceFingerprint } from '../../src/core/hash.js'
import { scanRule } from '../../src/ratchet/scan.js'
import type { RatchetRule } from '../../src/ratchet/types.js'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'govkit-ratchet-scan-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function write(file: string, content: string): void {
  const abs = join(root, file)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

function rule(overrides: Partial<RatchetRule> = {}): RatchetRule {
  return {
    id: 'no-unknown',
    pattern: 'as unknown',
    files: ['src/**/*.ts'],
    baseline: 'baselines/no-unknown.json',
    ...overrides,
  }
}

describe('scanRule', () => {
  it('returns every matching line with file, 1-based line, preview, and fingerprint', () => {
    write('src/a.ts', 'const a = 1\nconst b = x as unknown as T\nconst c = y as unknown\n')
    write('src/b.ts', 'no hits here\n')
    write('other/c.ts', 'z as unknown\n')

    const scan = scanRule(root, rule())
    expect(scan.scanned).toEqual(['src/a.ts', 'src/b.ts'])
    expect(scan.occurrences).toHaveLength(2)
    expect(scan.occurrences[0]).toMatchObject({
      file: 'src/a.ts',
      line: 2,
      preview: 'const b = x as unknown as T',
    })
    expect(scan.occurrences[0]?.fingerprint).toBe(occurrenceFingerprint('src/a.ts', 'const b = x as unknown as T'))
    expect(scan.occurrences[1]?.line).toBe(3)
  })

  it('reports zero admitted files when the globs match nothing', () => {
    write('src/a.ts', 'x as unknown\n')
    const scan = scanRule(root, rule({ files: ['nowhere/**'] }))
    expect(scan.scanned).toEqual([])
    expect(scan.occurrences).toEqual([])
  })

  it('honors case-insensitive flags', () => {
    write('src/a.ts', 'TODO: fix\nto be done\n')
    const scan = scanRule(root, rule({ pattern: 'todo', flags: 'i' }))
    expect(scan.occurrences).toHaveLength(1)
    expect(scan.occurrences[0]?.preview).toBe('TODO: fix')
  })

  it('matches every line even with a stateful g flag (no lastIndex leak)', () => {
    write('src/a.ts', 'x one\nplain\nx two\nx three\n')
    const scan = scanRule(root, rule({ pattern: 'x', flags: 'g' }))
    expect(scan.occurrences.map((hit) => hit.line)).toEqual([1, 3, 4])
  })

  it('trims and truncates the preview to 80 characters', () => {
    const long = `  as unknown ${'p'.repeat(100)}`
    write('src/a.ts', `${long}\n`)
    const [hit] = scanRule(root, rule()).occurrences
    expect(hit?.preview).toBe(`as unknown ${'p'.repeat(100)}`.slice(0, 80))
    expect(hit?.preview).toHaveLength(80)
  })

  it('keeps fingerprints stable across trailing-space edits', () => {
    const relaxed = occurrenceFingerprint('src/a.ts', 'const b = x as unknown   ')
    const tight = occurrenceFingerprint('src/a.ts', 'const b = x as unknown')
    expect(relaxed).toBe(tight)
  })

  it('changes the fingerprint when one non-whitespace character changes', () => {
    write('src/a.ts', 'aaa as unknown\n')
    const before = scanRule(root, rule()).occurrences[0]?.fingerprint
    write('src/a.ts', 'aab as unknown\n')
    const after = scanRule(root, rule()).occurrences[0]?.fingerprint
    expect(after).not.toBe(before)
  })

  it('treats identical text in another file as a new occurrence', () => {
    write('src/a.ts', 'same as unknown\n')
    write('src/b.ts', 'same as unknown\n')
    const scan = scanRule(root, rule())
    const fingerprints = new Set(scan.occurrences.map((hit) => hit.fingerprint))
    expect(scan.occurrences).toHaveLength(2)
    expect(fingerprints.size).toBe(2)
  })

  it('keeps fingerprints stable across CRLF line endings', () => {
    write('src/a.ts', 'z as unknown\r\n')
    write('src/b.ts', 'z as unknown\n')
    const crlf = scanRule(root, rule({ files: ['src/a.ts'] })).occurrences[0]?.fingerprint
    const lf = scanRule(root, rule({ files: ['src/b.ts'] })).occurrences[0]?.fingerprint
    expect(crlf).toBe(occurrenceFingerprint('src/a.ts', 'z as unknown'))
    expect(lf).toBe(occurrenceFingerprint('src/b.ts', 'z as unknown'))
    expect(crlf).not.toBe(lf)
  })
})
