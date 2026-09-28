import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TEMPLATE_FILES, TEMPLATES } from '../../src/generated/embedded-templates.js'
import { scaffold } from '../../src/init/scaffold.js'

let target: string

beforeEach(() => {
  target = mkdtempSync(join(tmpdir(), 'nodrift-scaffold-'))
})

afterEach(() => {
  rmSync(target, { recursive: true, force: true })
})

describe('embedded snapshot', () => {
  it('carries every listed template file with non-empty content', () => {
    expect(TEMPLATE_FILES.length).toBeGreaterThan(10)
    for (const rel of TEMPLATE_FILES) {
      expect((TEMPLATES[rel] ?? '').length, rel).toBeGreaterThan(0)
    }
  })
})

describe('scaffold', () => {
  it('creates nested directories and releases template files', () => {
    const plan = scaffold({ targetDir: target, templates: { 'x.md': 'X', 'sub/y.md': 'Y' } })
    expect(plan.created).toEqual(['x.md', 'sub/y.md'])
    expect(readFileSync(join(target, 'sub', 'y.md'), 'utf8')).toBe('Y')
  })

  it('renders detected placeholders from the target package.json', () => {
    writeFileSync(join(target, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run', build: 'tsc' } }))
    const plan = scaffold({
      targetDir: target,
      templates: { 'AGENTS.md': 'Test: `<test command>` · Build: `<build command>` · Lint: `<lint command>`' },
    })
    expect(plan.created).toEqual(['AGENTS.md'])
    expect(readFileSync(join(target, 'AGENTS.md'), 'utf8')).toBe(
      'Test: `npm test` · Build: `npm run build` · Lint: `<lint command>`',
    )
  })

  it('skips identical and modified existing files without force', () => {
    writeFileSync(join(target, 'x.md'), 'X')
    expect(scaffold({ targetDir: target, templates: { 'x.md': 'X' } }).skipped).toEqual(['x.md'])
    writeFileSync(join(target, 'x.md'), 'LOCAL EDITS')
    const plan = scaffold({ targetDir: target, templates: { 'x.md': 'X' } })
    expect(plan.skipped).toEqual(['x.md'])
    expect(readFileSync(join(target, 'x.md'), 'utf8')).toBe('LOCAL EDITS')
  })

  it('overwrites modified files with force', () => {
    writeFileSync(join(target, 'x.md'), 'LOCAL EDITS')
    const plan = scaffold({ targetDir: target, templates: { 'x.md': 'X' }, force: true })
    expect(plan.overwritten).toEqual(['x.md'])
    expect(readFileSync(join(target, 'x.md'), 'utf8')).toBe('X')
  })

  it('never overwrites the config file even with force and reports configPreserved', () => {
    writeFileSync(join(target, 'nodrift.yml'), 'user: edits')
    const plan = scaffold({ targetDir: target, templates: { 'nodrift.yml': 'template: 1' }, force: true })
    expect(plan.configPreserved).toBe(true)
    expect(plan.overwritten).toEqual([])
    expect(readFileSync(join(target, 'nodrift.yml'), 'utf8')).toBe('user: edits')
  })
})

describe('scaffold agent adapters', () => {
  const fixtures = {
    'AGENTS.md': 'A',
    '.agents/skills/pre-push-checks/SKILL.md': 'S',
    'agents/claude/CLAUDE.md': 'CLAUDE STUB',
    'agents/gemini/GEMINI.md': 'GEMINI STUB',
  }

  it('installs adapter stubs and the claude skills mirror after the base set', () => {
    const plan = scaffold({ targetDir: target, agents: ['claude'], templates: fixtures })
    expect(plan.created).toEqual([
      'AGENTS.md',
      '.agents/skills/pre-push-checks/SKILL.md',
      'CLAUDE.md',
      '.claude/skills/pre-push-checks/SKILL.md',
    ])
    expect(readFileSync(join(target, 'CLAUDE.md'), 'utf8')).toBe('CLAUDE STUB')
    expect(readFileSync(join(target, '.claude/skills/pre-push-checks/SKILL.md'), 'utf8')).toBe('S')
  })

  it('installs stubs without a mirror for adapters that declare none', () => {
    const plan = scaffold({ targetDir: target, agents: ['gemini'], templates: fixtures })
    expect(plan.created).toEqual(['AGENTS.md', '.agents/skills/pre-push-checks/SKILL.md', 'GEMINI.md'])
    expect(existsSync(join(target, 'CLAUDE.md'))).toBe(false)
  })

  it('never installs stub templates without a selection', () => {
    const plan = scaffold({ targetDir: target, templates: fixtures })
    expect(plan.created).toEqual(['AGENTS.md', '.agents/skills/pre-push-checks/SKILL.md'])
    expect(existsSync(join(target, 'GEMINI.md'))).toBe(false)
    expect(existsSync(join(target, 'CLAUDE.md'))).toBe(false)
  })

  it('applies the same skip and force semantics to stub and mirrored files', () => {
    scaffold({ targetDir: target, agents: ['claude'], templates: fixtures })
    const again = scaffold({ targetDir: target, agents: ['claude'], templates: fixtures })
    expect(again.skipped).toContain('CLAUDE.md')
    expect(again.skipped).toContain('.claude/skills/pre-push-checks/SKILL.md')
    writeFileSync(join(target, 'CLAUDE.md'), 'LOCAL EDITS')
    expect(scaffold({ targetDir: target, agents: ['claude'], templates: fixtures }).skipped).toContain('CLAUDE.md')
    expect(readFileSync(join(target, 'CLAUDE.md'), 'utf8')).toBe('LOCAL EDITS')
    const forced = scaffold({ targetDir: target, agents: ['claude'], templates: fixtures, force: true })
    expect(forced.overwritten).toContain('CLAUDE.md')
    expect(readFileSync(join(target, 'CLAUDE.md'), 'utf8')).toBe('CLAUDE STUB')
  })

  it('fails loud on an adapter id outside the closed set', () => {
    expect(() => scaffold({ targetDir: target, agents: ['wat'], templates: {} })).toThrow(
      'unknown agent id "wat" (valid: claude, cursor, copilot, gemini, windsurf)',
    )
  })
})
