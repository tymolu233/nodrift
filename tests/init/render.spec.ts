import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DETECTION_TOKENS, detectRenderContext, renderContent } from '../../src/init/render.js'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'nodrift-render-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('detectRenderContext', () => {
  it('detects only the scripts the target declares', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'x', lint: 'y' } }))
    expect(detectRenderContext(dir).replacements).toEqual({
      '<test command>': 'npm test',
      '<lint command>': 'npm run lint',
    })
  })

  it('yields an empty context without a package.json, on unparsable JSON, or without matching scripts', () => {
    expect(detectRenderContext(dir).replacements).toEqual({})
    writeFileSync(join(dir, 'package.json'), 'not json {')
    expect(detectRenderContext(dir).replacements).toEqual({})
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { deploy: 'x' } }))
    expect(detectRenderContext(dir).replacements).toEqual({})
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 42 } }))
    expect(detectRenderContext(dir).replacements).toEqual({})
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'no-scripts-key' }))
    expect(detectRenderContext(dir).replacements).toEqual({})
  })

  it('covers every token key advertised by DETECTION_TOKENS', () => {
    mkdirSync(join(dir, 'sub'), { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'a', build: 'b', lint: 'c' } }))
    const replacements = detectRenderContext(dir).replacements
    expect(Object.keys(replacements).sort()).toEqual(Object.keys(DETECTION_TOKENS).sort())
  })
})

describe('renderContent', () => {
  it('replaces only detected tokens and keeps the rest verbatim', () => {
    const out = renderContent('a <test command> b <build command> c', { replacements: { '<test command>': 'npm test' } })
    expect(out).toBe('a npm test b <build command> c')
  })

  it('is idempotent over unchanged content', () => {
    expect(renderContent('plain', { replacements: {} })).toBe('plain')
  })

  it('replaces every occurrence of the same token, not just the first', () => {
    const out = renderContent('<test command> and again <test command>', { replacements: { '<test command>': 'npm test' } })
    expect(out).toBe('npm test and again npm test')
  })
})
