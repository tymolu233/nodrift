import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultTemplatesDir, resolveTemplateFiles, scaffold } from '../../src/init/scaffold.js'

let root: string
let templates: string
let target: string

function putTemplate(rel: string, content: string): void {
  const file = join(templates, rel)
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, content)
}

function putManifest(value: unknown): void {
  writeFileSync(join(templates, 'manifest.json'), typeof value === 'string' ? value : JSON.stringify(value))
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'anti-shishan-scaffold-'))
  templates = join(root, 'templates')
  target = join(root, 'target')
  mkdirSync(templates, { recursive: true })
  mkdirSync(target, { recursive: true })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('resolveTemplateFiles', () => {
  it('unions levels incrementally and de-duplicates', () => {
    putTemplate('a.md', 'a')
    putTemplate('b.md', 'b')
    putTemplate('c.md', 'c')
    putManifest({ 0: ['a.md'], 1: ['a.md', 'b.md'], 2: ['c.md'] })
    expect(resolveTemplateFiles(templates, 0)).toEqual(['a.md'])
    expect(resolveTemplateFiles(templates, 2)).toEqual(['a.md', 'b.md', 'c.md'])
  })

  it('tolerates absent upper levels', () => {
    putTemplate('a.md', 'a')
    putManifest({ 0: ['a.md'] })
    expect(resolveTemplateFiles(templates, 2)).toEqual(['a.md'])
  })

  it('fails when the manifest file, its shape, or a listed file is missing', () => {
    expect(() => resolveTemplateFiles(templates, 0)).toThrow('template manifest not found')
    putManifest('not json {')
    expect(() => resolveTemplateFiles(templates, 0)).toThrow()
    putManifest(['a.md'])
    expect(() => resolveTemplateFiles(templates, 0)).toThrow('must be a mapping')
    putManifest({ x: ['a.md'] })
    expect(() => resolveTemplateFiles(templates, 0)).toThrow('each level')
    putManifest({ 0: ['ghost.md'] })
    expect(() => resolveTemplateFiles(templates, 0)).toThrow('templates/ghost.md does not exist')
  })
})

describe('scaffold', () => {
  it('creates nested directories and copies level files', () => {
    putTemplate('x.md', 'X')
    putTemplate('sub/y.md', 'Y')
    putManifest({ 0: ['x.md'], 1: ['sub/y.md'] })
    const plan = scaffold({ templatesDir: templates, targetDir: target, level: 1 })
    expect(plan.created).toEqual(['x.md', 'sub/y.md'])
    expect(readFileSync(join(target, 'sub', 'y.md'), 'utf8')).toBe('Y')
  })

  it('skips identical and modified existing files without force', () => {
    putTemplate('x.md', 'X')
    putManifest({ 0: ['x.md'] })
    writeFileSync(join(target, 'x.md'), 'X')
    expect(scaffold({ templatesDir: templates, targetDir: target, level: 0 }).skipped).toEqual(['x.md'])
    writeFileSync(join(target, 'x.md'), 'LOCAL EDITS')
    const plan = scaffold({ templatesDir: templates, targetDir: target, level: 0 })
    expect(plan.skipped).toEqual(['x.md'])
    expect(readFileSync(join(target, 'x.md'), 'utf8')).toBe('LOCAL EDITS')
  })

  it('overwrites modified files with force', () => {
    putTemplate('x.md', 'X')
    putManifest({ 0: ['x.md'] })
    writeFileSync(join(target, 'x.md'), 'LOCAL EDITS')
    const plan = scaffold({ templatesDir: templates, targetDir: target, level: 0, force: true })
    expect(plan.overwritten).toEqual(['x.md'])
    expect(readFileSync(join(target, 'x.md'), 'utf8')).toBe('X')
  })

  it('never overwrites anti-shishan.yml even with force and reports configPreserved', () => {
    putTemplate('anti-shishan.yml', 'template: 1')
    putManifest({ 0: ['anti-shishan.yml'] })
    writeFileSync(join(target, 'anti-shishan.yml'), 'user: edits')
    const plan = scaffold({ templatesDir: templates, targetDir: target, level: 0, force: true })
    expect(plan.configPreserved).toBe(true)
    expect(plan.overwritten).toEqual([])
    expect(readFileSync(join(target, 'anti-shishan.yml'), 'utf8')).toBe('user: edits')
  })
})

describe('defaultTemplatesDir', () => {
  it('points at a directory that will ship with the package', () => {
    expect(defaultTemplatesDir().replaceAll('\\', '/')).toMatch(/templates\/$/)
  })
})
