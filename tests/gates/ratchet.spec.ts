import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseRules, ratchetGate } from '../../src/gates/ratchet.js'
import { runRatchetUpdate } from '../../src/ratchet/update.js'
import type { RatchetRule } from '../../src/ratchet/types.js'
import type { GateContext } from '../../src/core/types.js'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'anti-shishan-gate-ratchet-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function write(file: string, content: string): void {
  const abs = join(root, file)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

function ctx(options: Record<string, unknown> = {}): GateContext {
  return {
    repoRoot: root,
    options,
    config: { notes: { root: '.agents/notes', classes: ['process'] }, gates: {} },
  }
}

const RULE: RatchetRule = {
  id: 'no-unknown',
  pattern: 'as unknown',
  files: ['src/**/*.ts'],
  baseline: 'baselines/no-unknown.json',
}

function rulesOptions(rules: readonly Record<string, unknown>[] = [RULE]): Record<string, unknown> {
  return { rules }
}

describe('parseRules', () => {
  it('requires the rules list', () => {
    expect(() => parseRules({})).toThrow('ratchet: rules is required')
    expect(() => parseRules({ rules: {} })).toThrow('ratchet: rules must be a list')
  })

  it('accepts a valid rule, defaulting flags away', () => {
    expect(parseRules({ rules: [RULE] })).toEqual([RULE])
    expect(parseRules({ rules: [{ ...RULE, flags: 'i' }] })[0]?.flags).toBe('i')
  })

  it.each([
    [{ rules: ['x'] }, 'ratchet: rules[0] must be an object'],
    [{ rules: [{ ...RULE, nope: 1 }] }, 'rules[0]: unknown key "nope"'],
    [{ rules: [{ ...RULE, id: '' }] }, 'rules[0].id must be a non-empty string'],
    [{ rules: [{ ...RULE, pattern: 5 }] }, 'rule "no-unknown" pattern must be a regular-expression string'],
    [{ rules: [{ ...RULE, flags: 5 }] }, 'rule "no-unknown" flags must be a string'],
    [{ rules: [{ ...RULE, pattern: '[' }] }, 'rule "no-unknown" has an invalid pattern/flags'],
    [{ rules: [{ ...RULE, flags: 'zzz' }] }, 'rule "no-unknown" has an invalid pattern/flags'],
    [{ rules: [{ ...RULE, files: 'src/**' }] }, 'rule "no-unknown" files must be a list of glob strings'],
    [{ rules: [{ ...RULE, files: [5] }] }, 'rule "no-unknown" files must be a list of glob strings'],
    [{ rules: [{ ...RULE, baseline: '' }] }, 'rule "no-unknown" baseline must be a repo-relative path'],
    [{ rules: [{ ...RULE, baseline: '/abs/x.json' }] }, 'rule "no-unknown" baseline must be a repo-relative path'],
    [{ rules: [{ ...RULE, baseline: '../x.json' }] }, 'rule "no-unknown" baseline must be a repo-relative path'],
    [{ rules: [{ ...RULE, baseline: 'a\\b.json' }] }, 'rule "no-unknown" baseline must be a repo-relative path'],
    [{ rules: [RULE, RULE] }, 'ratchet: duplicate rule id "no-unknown"'],
  ])('fails loud on %j', (options, message) => {
    expect(() => parseRules(options)).toThrow(message as string)
  })
})

describe('ratchetGate.run', () => {
  it('fails on new occurrences, pointing at ratchet update for intentional debt', async () => {
    write('src/a.ts', 'const b = x as unknown\nok\nconst c = y as unknown\n')
    const result = await ratchetGate.run(ctx(rulesOptions()))
    expect(result.corpus.admitted).toBe(1)
    expect(result.violations).toHaveLength(2)
    expect(result.violations[0]).toMatchObject({ gate: 'ratchet', file: 'src/a.ts', line: 1 })
    expect(result.violations[0]?.message).toContain('no-unknown')
    expect(result.violations[0]?.message).toContain('anti-shishan ratchet update no-unknown')
    expect(result.violations[1]?.line).toBe(3)
  })

  it('passes once occurrences are registered in the baseline', async () => {
    write('src/a.ts', 'x as unknown\n')
    runRatchetUpdate(root, [RULE])
    const result = await ratchetGate.run(ctx(rulesOptions()))
    expect(result.violations).toEqual([])
    expect(result.corpus.admitted).toBe(1)
  })

  it('ignores trailing-space edits to registered occurrences', async () => {
    write('src/a.ts', 'const b = x as unknown\n')
    runRatchetUpdate(root, [RULE])
    write('src/a.ts', 'const b = x as unknown   \n')
    const result = await ratchetGate.run(ctx(rulesOptions()))
    expect(result.violations).toEqual([])
  })

  it('fails when one non-whitespace character changes a registered line', async () => {
    write('src/a.ts', 'aaa as unknown\n')
    runRatchetUpdate(root, [RULE])
    write('src/a.ts', 'aab as unknown\n')
    const result = await ratchetGate.run(ctx(rulesOptions()))
    // One new-looking occurrence plus one vanished baseline entry.
    expect(result.violations).toHaveLength(2)
    expect(result.violations.some((v) => v.line === 1)).toBe(true)
    expect(result.violations.some((v) => v.message.includes('vanished'))).toBe(true)
  })

  it('fails when registered text moves to another scanned file', async () => {
    write('src/a.ts', 'same as unknown\n')
    runRatchetUpdate(root, [RULE])
    write('src/a.ts', 'clean\n')
    write('src/b.ts', 'same as unknown\n')
    const result = await ratchetGate.run(ctx(rulesOptions()))
    expect(result.violations).toHaveLength(2)
    expect(result.violations.some((v) => v.file === 'src/b.ts')).toBe(true)
    expect(result.violations.some((v) => v.message.includes('vanished'))).toBe(true)
  })

  it('fails when a registered occurrence vanishes, until the baseline is pruned', async () => {
    write('src/a.ts', 'x as unknown\n')
    runRatchetUpdate(root, [RULE])
    write('src/a.ts', 'clean\n')
    const result = await ratchetGate.run(ctx(rulesOptions()))
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]).toMatchObject({ gate: 'ratchet', file: 'baselines/no-unknown.json' })
    expect(result.violations[0]?.message).toContain('vanished')
    expect(result.violations[0]?.message).toContain('anti-shishan ratchet update no-unknown')

    runRatchetUpdate(root, [RULE])
    const after = await ratchetGate.run(ctx(rulesOptions()))
    expect(after.violations).toEqual([])
  })

  it('returns an empty corpus faithfully when a rule matches no files', async () => {
    write('src/a.ts', 'x as unknown\n')
    const result = await ratchetGate.run(ctx(rulesOptions([{ ...RULE, files: ['nowhere/**'] }])))
    expect(result.corpus.admitted).toBe(0)
    expect(result.violations).toEqual([])
  })

  it('reports only the failing rule when several are configured', async () => {
    write('src/a.ts', 'x as unknown\n')
    const other = { id: 'no-todo', pattern: 'TODO', files: ['src/**/*.ts'], baseline: 'baselines/no-todo.json' }
    runRatchetUpdate(root, [other])
    const result = await ratchetGate.run(ctx(rulesOptions([RULE, other])))
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]?.message).toContain('no-unknown')
    expect(result.corpus.admitted).toBe(2)
  })

  it('accepts an empty rules list', async () => {
    const result = await ratchetGate.run(ctx({ rules: [] }))
    expect(result).toEqual({ violations: [], corpus: { admitted: 0 } })
  })

  it('fails loud on an unknown option key', async () => {
    write('src/a.ts', 'x\n')
    await expect(ratchetGate.run(ctx({ rules: [], budgets: {} }))).rejects.toThrow(
      'ratchet: unknown option key "budgets" (known: enabled, rules)',
    )
  })

  it('rejects an empty files list rather than scanning the whole repo', async () => {
    expect(() =>
      parseRules({ rules: [{ id: 'x', pattern: 'y', files: [], baseline: 'b.json' }] }),
    ).toThrow(/must not be empty/)
  })
})
