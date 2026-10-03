import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { collectNextSteps } from '../../src/init/next-steps.js'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'nodrift-next-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('collectNextSteps', () => {
  it('always names config trim, first check, CI wiring, and commit steps', () => {
    const steps = collectNextSteps(dir)
    expect(steps.some((s) => s.startsWith('agent: trim nodrift.yml'))).toBe(true)
    expect(steps.some((s) => s.startsWith('agent: run `nodrift check`'))).toBe(true)
    expect(steps.some((s) => s.includes('`.github/workflows/ci-verdict.yml`') && s.includes('delete `.github/workflows/ci.yml`') && s.includes('verify-notes.yml'))).toBe(true)
    expect(steps.some((s) => s.startsWith('human: commit the installed files'))).toBe(true)
  })

  it('asks for README.md only when it is missing', () => {
    expect(collectNextSteps(dir).some((s) => s.includes('create README.md'))).toBe(true)
    writeFileSync(join(dir, 'README.md'), '# x\n')
    expect(collectNextSteps(dir).some((s) => s.includes('create README.md'))).toBe(false)
  })

  it('lists detected AGENTS.md placeholders de-duplicated and sorted, only when present', () => {
    mkdirSync(join(dir, 'sub'), { recursive: true })
    writeFileSync(
      join(dir, 'AGENTS.md'),
      'a <test command> b <owner email> c <test command> d <lint command>\n',
    )
    const tokenStep = collectNextSteps(dir).find((s) => s.startsWith('agent: fill AGENTS.md'))
    expect(tokenStep).toContain('<lint command>')
    expect(tokenStep).toContain('<owner email>')
    expect(tokenStep).toContain('<test command>')
    expect((tokenStep?.match(/<test command>/g) ?? []).length).toBe(1)
    expect(tokenStep?.indexOf('<lint command>')).toBeLessThan(tokenStep?.indexOf('<owner email>') ?? 0)
    writeFileSync(join(dir, 'AGENTS.md'), 'all filled in\n')
    expect(collectNextSteps(dir).some((s) => s.startsWith('agent: fill AGENTS.md'))).toBe(false)
  })

  it('audits README.md placeholders independently of AGENTS.md', () => {
    writeFileSync(join(dir, 'README.md'), '# <project name>\n\n<description>\n')
    const steps = collectNextSteps(dir)
    expect(steps.some((s) => s.startsWith('agent: fill README.md') && s.includes('<project name>') && s.includes('<description>'))).toBe(true)
    expect(steps.some((s) => s.startsWith('agent: fill AGENTS.md'))).toBe(false)
  })

  it('short tokens like <a> or <if x> are not treated as placeholders', () => {
    writeFileSync(join(dir, 'AGENTS.md'), 'use <x> and <if> freely\n')
    expect(collectNextSteps(dir).some((s) => s.startsWith('agent: fill AGENTS.md'))).toBe(false)
  })

  it('meta tokens from template instructions and CLI usage docs are not holes', () => {
    writeFileSync(join(dir, 'AGENTS.md'), 'Replace every <placeholder>. Run `nodrift check --only <gate>[,<gate>...]`.\n')
    expect(collectNextSteps(dir).some((s) => s.startsWith('agent: fill AGENTS.md'))).toBe(false)
  })
})

describe('collectNextSteps agent selection recording', () => {
  const recordStep = (steps: string[]): string | undefined => steps.find((s) => s.startsWith('human: record the agent selection'))

  it('asks a human to record a non-empty selection missing from nodrift.yml', () => {
    const step = recordStep(collectNextSteps(dir, ['claude', 'cursor']))
    expect(step).toContain('agents: [claude, cursor]')
    expect(step).toContain('nodrift.yml')
  })

  it('stays quiet for an empty or absent selection', () => {
    expect(recordStep(collectNextSteps(dir, []))).toBeUndefined()
    expect(recordStep(collectNextSteps(dir))).toBeUndefined()
    expect(collectNextSteps(dir, []).length).toBe(collectNextSteps(dir).length)
  })

  it('stays quiet when nodrift.yml records the same set, order-insensitive', () => {
    writeFileSync(join(dir, 'nodrift.yml'), 'version: 1\nagents: [cursor, claude]\n')
    expect(recordStep(collectNextSteps(dir, ['claude', 'cursor']))).toBeUndefined()
  })

  it('asks again when the config records a different set', () => {
    writeFileSync(join(dir, 'nodrift.yml'), 'version: 1\nagents: [gemini]\n')
    const step = recordStep(collectNextSteps(dir, ['claude']))
    expect(step).toContain('agents: [claude]')
  })

  it('asks when the config cannot be read, and never throws on it', () => {
    writeFileSync(join(dir, 'nodrift.yml'), 'bogus: [unclosed\n')
    expect(recordStep(collectNextSteps(dir, ['claude']))).toContain('agents: [claude]')
  })
})
