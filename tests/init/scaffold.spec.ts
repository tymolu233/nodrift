import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TEMPLATE_FILES, TEMPLATES } from '../../src/generated/embedded-templates.js'
import { scaffold } from '../../src/init/scaffold.js'

let target: string

beforeEach(() => {
  target = mkdtempSync(join(tmpdir(), 'anti-shishan-scaffold-'))
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
    writeFileSync(join(target, 'anti-shishan.yml'), 'user: edits')
    const plan = scaffold({ targetDir: target, templates: { 'anti-shishan.yml': 'template: 1' }, force: true })
    expect(plan.configPreserved).toBe(true)
    expect(plan.overwritten).toEqual([])
    expect(readFileSync(join(target, 'anti-shishan.yml'), 'utf8')).toBe('user: edits')
  })
})
