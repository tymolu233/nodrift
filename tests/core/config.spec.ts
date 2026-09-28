import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_NOTE_CLASSES, DEFAULT_NOTES_ROOT, loadConfig } from '../../src/core/config.js'

let dir: string

function config(content: string): void {
  writeFileSync(join(dir, 'anti-shishan.yml'), content)
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'anti-shishan-config-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('loadConfig', () => {
  it('applies defaults to an empty mapping', () => {
    config('version: 1\n')
    const cfg = loadConfig(dir)
    expect(cfg.notes.root).toBe(DEFAULT_NOTES_ROOT)
    expect(cfg.notes.classes).toEqual([...DEFAULT_NOTE_CLASSES])
    expect(cfg.gates).toEqual({})
  })

  it('reads notes root, classes, and gate sections (boolean shorthand included)', () => {
    config(['notes:', '  root: docs/notes', '  classes: [x, y]', 'gates:', '  md-wrap: false', "  doc-budgets: {budgets: {A.md: 10}}", ''].join('\n'))
    const cfg = loadConfig(dir)
    expect(cfg.notes).toEqual({ root: 'docs/notes', classes: ['x', 'y'] })
    expect(cfg.gates['md-wrap']).toEqual({ enabled: false })
    expect(cfg.gates['doc-budgets']).toEqual({ budgets: { 'A.md': 10 } })
  })

  it('honors an explicit config path', () => {
    mkdirSync(join(dir, 'sub'), { recursive: true })
    writeFileSync(join(dir, 'sub', 'other.yml'), 'version: 1\n')
    expect(loadConfig(dir, join(dir, 'sub', 'other.yml')).notes.root).toBe(DEFAULT_NOTES_ROOT)
  })

  it('fails loud on a missing file', () => {
    expect(() => loadConfig(dir)).toThrow(/config file not found/)
    expect(() => loadConfig(dir, join(dir, 'nope.yml'))).toThrow(/config file not found/)
  })

  it('fails loud on invalid YAML, non-mapping roots, and unknown top-level keys', () => {
    config('version: [unclosed\n')
    expect(() => loadConfig(dir)).toThrow(/not valid YAML/)
    config('- a\n- b\n')
    expect(() => loadConfig(dir)).toThrow(/must be a mapping/)
    config('bogus: 1\n')
    expect(() => loadConfig(dir)).toThrow(/bogus is not a known top-level key/)
  })

  it('fails loud on a wrong version', () => {
    config('version: 2\n')
    expect(() => loadConfig(dir)).toThrow(/version must be 1/)
  })

  it('validates the notes section', () => {
    config('notes: 42\n')
    expect(() => loadConfig(dir)).toThrow(/notes must be a mapping/)
    config('notes: {depth: 2}\n')
    expect(() => loadConfig(dir)).toThrow(/notes.depth is not a known key/)
    config('notes: {root: ""}\n')
    expect(() => loadConfig(dir)).toThrow(/notes.root must be a non-empty string/)
    config('notes: {root: 3}\n')
    expect(() => loadConfig(dir)).toThrow(/notes.root must be a non-empty string/)
    config('notes: {classes: [ok, ""]}\n')
    expect(() => loadConfig(dir)).toThrow(/notes.classes must be a list/)
    config('notes: {classes: justone}\n')
    expect(() => loadConfig(dir)).toThrow(/notes.classes must be a list/)
  })

  it('validates the gates section', () => {
    config('gates: [md-wrap]\n')
    expect(() => loadConfig(dir)).toThrow(/gates must be a mapping/)
    config('gates: {md-wrap: nope}\n')
    expect(() => loadConfig(dir)).toThrow(/gates.md-wrap must be a mapping/)
  })
})
