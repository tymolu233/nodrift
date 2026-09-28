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
  it('returns the flat manifest list in order', () => {
    putTemplate('a.md', 'a')
    putTemplate('sub/b.md', 'b')
    putManifest({ files: ['a.md', 'sub/b.md'] })
    expect(resolveTemplateFiles(templates)).toEqual(['a.md', 'sub/b.md'])
  })

  it('fails when the manifest file, its shape, or a listed file is missing', () => {
    expect(() => resolveTemplateFiles(templates)).toThrow('template manifest not found')
    putManifest('not json {')
    expect(() => resolveTemplateFiles(templates)).toThrow()
    putManifest(['a.md'])
    expect(() => resolveTemplateFiles(templates)).toThrow('must be a mapping')
    putManifest({ levels: [] })
    expect(() => resolveTemplateFiles(templates)).toThrow('only the "files" key')
    putManifest({ files: 'a.md' })
    expect(() => resolveTemplateFiles(templates)).toThrow('"files" must be a list')
    putManifest({ files: ['ghost.md'] })
    expect(() => resolveTemplateFiles(templates)).toThrow('templates/ghost.md does not exist')
    putTemplate('a.md', 'a')
    putManifest({ files: ['a.md', 'a.md'] })
    expect(() => resolveTemplateFiles(templates)).toThrow('lists a.md twice')
  })
})

describe('scaffold', () => {
  it('creates nested directories and copies template files', () => {
    putTemplate('x.md', 'X')
    putTemplate('sub/y.md', 'Y')
    putManifest({ files: ['x.md', 'sub/y.md'] })
    const plan = scaffold({ templatesDir: templates, targetDir: target })
    expect(plan.created).toEqual(['x.md', 'sub/y.md'])
    expect(readFileSync(join(target, 'sub', 'y.md'), 'utf8')).toBe('Y')
  })

  it('skips identical and modified existing files without force', () => {
    putTemplate('x.md', 'X')
    putManifest({ files: ['x.md'] })
    writeFileSync(join(target, 'x.md'), 'X')
    expect(scaffold({ templatesDir: templates, targetDir: target }).skipped).toEqual(['x.md'])
    writeFileSync(join(target, 'x.md'), 'LOCAL EDITS')
    const plan = scaffold({ templatesDir: templates, targetDir: target })
    expect(plan.skipped).toEqual(['x.md'])
    expect(readFileSync(join(target, 'x.md'), 'utf8')).toBe('LOCAL EDITS')
  })

  it('overwrites modified files with force', () => {
    putTemplate('x.md', 'X')
    putManifest({ files: ['x.md'] })
    writeFileSync(join(target, 'x.md'), 'LOCAL EDITS')
    const plan = scaffold({ templatesDir: templates, targetDir: target, force: true })
    expect(plan.overwritten).toEqual(['x.md'])
    expect(readFileSync(join(target, 'x.md'), 'utf8')).toBe('X')
  })

  it('never overwrites the config file even with force and reports configPreserved', () => {
    putTemplate('anti-shishan.yml', 'template: 1')
    putManifest({ files: ['anti-shishan.yml'] })
    writeFileSync(join(target, 'anti-shishan.yml'), 'user: edits')
    const plan = scaffold({ templatesDir: templates, targetDir: target, force: true })
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
