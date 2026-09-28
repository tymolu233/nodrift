import { describe, expect, it } from 'vitest'
import type { KitConfig } from '../../src/core/types.js'
import { BUILTIN_GATES, resolveGates } from '../../src/gates/registry.js'

function config(gates: KitConfig['gates']): KitConfig {
  return { notes: { root: '.agents/notes', classes: ['feature'] }, gates }
}

describe('resolveGates', () => {
  it('runs gates with a config section unless enabled is false', () => {
    const gates = resolveGates(config({ 'md-wrap': {}, 'md-links': { enabled: false } }))
    expect(gates.map((g) => g.id)).toEqual(['md-wrap'])
  })

  it('keeps registry order regardless of config key order', () => {
    const gates = resolveGates(config({ ratchet: {}, 'md-wrap': {}, 'note-format': {} }))
    expect(gates.map((g) => g.id)).toEqual(['md-wrap', 'note-format', 'ratchet'])
  })

  it('fails loud on unknown gate ids in config', () => {
    expect(() => resolveGates(config({ 'no-such-gate': {} }))).toThrow(/unknown gate id/)
  })

  it('--only narrows the enabled set and rejects unknown or disabled ids', () => {
    const cfg = config({ 'md-wrap': {}, 'md-links': {}, 'note-format': { enabled: false } })
    expect(resolveGates(cfg, ['md-links']).map((g) => g.id)).toEqual(['md-links'])
    expect(() => resolveGates(cfg, ['note-format'])).toThrow(/not enabled/)
    expect(() => resolveGates(cfg, ['nope'])).toThrow(/not enabled/)
  })

  it('--only rejection names an empty enabled set as `none`', () => {
    expect(() => resolveGates(config({}), ['md-wrap'])).toThrow(/enabled: none\)/)
  })

  it('empty config enables nothing', () => {
    expect(resolveGates(config({}))).toEqual([])
  })

  it('registry exposes the seven v1 gates in execution order', () => {
    expect(BUILTIN_GATES.map((g) => g.id)).toEqual([
      'md-wrap',
      'md-links',
      'doc-budgets',
      'note-classification',
      'note-format',
      'note-archive-seal',
      'ratchet',
    ])
  })
})
