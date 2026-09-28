import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { diffOccurrences, runRatchetUpdate, runRatchetVerify, updateBaseline } from '../../src/ratchet/update.js'
import { readBaseline, writeBaseline } from '../../src/ratchet/types.js'
import type { BaselineFile, RatchetRule } from '../../src/ratchet/types.js'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'nodrift-ratchet-update-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function write(file: string, content: string): void {
  const abs = join(root, file)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

function baselinePath(file = 'baselines/no-unknown.json'): string {
  return join(root, file)
}

const RULE: RatchetRule = {
  id: 'no-unknown',
  pattern: 'as unknown',
  files: ['src/**/*.ts'],
  baseline: 'baselines/no-unknown.json',
}

function verifiedBaseline(absPath: string): BaselineFile {
  const parsed: unknown = JSON.parse(readFileSync(absPath, 'utf8'))
  return parsed as BaselineFile
}

describe('readBaseline', () => {
  it('reads a missing file as an empty inventory for the rule', () => {
    expect(readBaseline(baselinePath(), 'no-unknown')).toEqual({ rule: 'no-unknown', updatedAt: '', entries: [] })
  })

  it.each([
    ['{oops', 'not valid JSON'],
    ['[1,2]', 'must be an object'],
    ['{"rule":"other","updatedAt":"2026-01-01","entries":[]}', 'belongs to rule "other", not "no-unknown"'],
    ['{"rule":"no-unknown","updatedAt":5,"entries":[]}', 'updatedAt must be a string'],
    ['{"rule":"no-unknown","updatedAt":"","entries":{}}', 'entries must be an array'],
    ['{"rule":"no-unknown","updatedAt":"","entries":["x"]}', 'entries[0] must be an object'],
    ['{"rule":"no-unknown","updatedAt":"","entries":[{"file":"","line":1,"fingerprint":"a","preview":""}]}', 'entries[0].file must be a non-empty string'],
    ['{"rule":"no-unknown","updatedAt":"","entries":[{"file":"a.ts","line":0,"fingerprint":"a","preview":""}]}', 'entries[0].line must be a positive integer'],
    ['{"rule":"no-unknown","updatedAt":"","entries":[{"file":"a.ts","line":1,"fingerprint":"xyz","preview":""}]}', 'entries[0].fingerprint must be a lowercase sha256 hex'],
    ['{"rule":"no-unknown","updatedAt":"","entries":[{"file":"a.ts","line":1,"fingerprint":"' + 'a'.repeat(64) + '","preview":5}]}', 'entries[0].preview must be a string'],
  ])('fails loud on a malformed baseline: %s', (content, message) => {
    write('baselines/no-unknown.json', content)
    expect(() => readBaseline(baselinePath(), 'no-unknown')).toThrow(message)
  })
})

describe('writeBaseline', () => {
  it('creates parent directories and round-trips through readBaseline', () => {
    const abs = baselinePath('deep/nested/base.json')
    const baseline: BaselineFile = {
      rule: 'no-unknown',
      updatedAt: '2026-09-28',
      entries: [{ file: 'src/a.ts', line: 1, fingerprint: 'a'.repeat(64), preview: 'x' }],
    }
    writeBaseline(abs, baseline)
    expect(existsSync(abs)).toBe(true)
    expect(readBaseline(abs, 'no-unknown')).toEqual(baseline)
  })
})

describe('diffOccurrences', () => {
  const occurrence = (fingerprint: string) => ({ file: 'a.ts', line: 1, fingerprint, preview: '' })

  it('splits current-vs-baseline by fingerprint sets', () => {
    const diff = diffOccurrences([occurrence('b'), occurrence('c')], [occurrence('a'), occurrence('b')])
    expect(diff.added.map((hit) => hit.fingerprint)).toEqual(['c'])
    expect(diff.stale.map((hit) => hit.fingerprint)).toEqual(['a'])
  })

  it('reports no diff when both sides agree', () => {
    expect(diffOccurrences([occurrence('a')], [occurrence('a')])).toEqual({ added: [], stale: [] })
  })
})

describe('runRatchetVerify', () => {
  it('sees every occurrence as added when no baseline exists', () => {
    write('src/a.ts', 'x as unknown\ny as unknown\n')
    const { results, scannedFiles } = runRatchetVerify(root, [RULE])
    expect(scannedFiles).toBe(1)
    expect(results).toHaveLength(1)
    expect(results[0]?.diff.added).toHaveLength(2)
    expect(results[0]?.diff.stale).toEqual([])
  })

  it('counts files scanned per rule across the rule set', () => {
    write('src/a.ts', 'ok\n')
    write('docs/b.md', 'ok\n')
    const other: RatchetRule = { id: 'no-todo', pattern: 'TODO', files: ['docs/**/*.md'], baseline: 'baselines/no-todo.json' }
    const { scannedFiles } = runRatchetVerify(root, [RULE, other])
    expect(scannedFiles).toBe(2)
  })
})

describe('updateBaseline / runRatchetUpdate', () => {
  it('registers all occurrences on first run and stamps an ISO date', () => {
    write('src/a.ts', 'x as unknown\nok\ny as unknown\n')
    const update = updateBaseline(root, RULE)
    expect(update).toEqual({ rule: RULE, added: 2, removed: 0, total: 2 })
    const baseline = verifiedBaseline(baselinePath())
    expect(baseline.rule).toBe('no-unknown')
    expect(baseline.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(baseline.entries).toHaveLength(2)
  })

  it('verifies clean on the run right after an update', () => {
    write('src/a.ts', 'x as unknown\n')
    updateBaseline(root, RULE)
    const { results } = runRatchetVerify(root, [RULE])
    expect(results[0]?.diff).toEqual({ added: [], stale: [] })
  })

  it('is a no-op when neither side changed', () => {
    write('src/a.ts', 'x as unknown\n')
    updateBaseline(root, RULE)
    expect(updateBaseline(root, RULE)).toEqual({ rule: RULE, added: 0, removed: 0, total: 1 })
  })

  it('prunes retired occurrences and reports the removal', () => {
    write('src/a.ts', 'x as unknown\ny as unknown\n')
    updateBaseline(root, RULE)
    write('src/a.ts', 'x as unknown\n')
    const update = updateBaseline(root, RULE)
    expect(update).toEqual({ rule: RULE, added: 0, removed: 1, total: 1 })
    expect(verifiedBaseline(baselinePath()).entries).toHaveLength(1)
  })

  it('registers new and pruned entries together', () => {
    write('src/a.ts', 'aaa as unknown\n')
    updateBaseline(root, RULE)
    write('src/a.ts', 'aab as unknown\n')
    const update = updateBaseline(root, RULE)
    expect(update).toEqual({ rule: RULE, added: 1, removed: 1, total: 1 })
  })

  it('updates every rule it is given', () => {
    write('src/a.ts', 'x as unknown\nTODO: fix\n')
    const other: RatchetRule = { id: 'no-todo', pattern: 'TODO', files: ['src/**/*.ts'], baseline: 'baselines/no-todo.json' }
    const updates = runRatchetUpdate(root, [RULE, other])
    expect(updates).toHaveLength(2)
    expect(updates.map((u) => u.total)).toEqual([1, 1])
    expect(existsSync(baselinePath('baselines/no-todo.json'))).toBe(true)
  })
})
