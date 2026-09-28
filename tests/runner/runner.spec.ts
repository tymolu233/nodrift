import { describe, expect, it } from 'vitest'
import type { Gate, GovkitConfig } from '../../src/core/types.js'
import { runGates } from '../../src/runner/runner.js'

const config: GovkitConfig = {
  notes: { root: '.agents/notes', classes: ['feature'] },
  gates: { inject: { custom: 'x' } },
}

function fakeGate(id: string, run: Gate['run'], minCorpus?: number): Gate {
  return minCorpus === undefined
    ? { id, doc: 'proves nothing', run }
    : { id, doc: 'proves nothing', minCorpus, run }
}

describe('runGates', () => {
  it('collects violations and stamps the gate id', async () => {
    const gate = fakeGate('g1', async () => ({
      violations: [{ gate: 'wrong', file: 'a.md', line: 3, message: 'bad' }],
      corpus: { admitted: 2 },
    }))
    const summary = await runGates({ repoRoot: '/x', gates: [gate], config })
    expect(summary.failed).toBe(true)
    expect(summary.runs[0]?.violations[0]?.gate).toBe('g1')
  })

  it('passes the gate its own config section and an empty section by default', async () => {
    const seen: unknown[] = []
    const withSection = fakeGate('inject', async (ctx) => {
      seen.push(ctx.options)
      return { violations: [], corpus: { admitted: 1 } }
    })
    const without = fakeGate('other', async (ctx) => {
      seen.push(ctx.options)
      return { violations: [], corpus: { admitted: 1 } }
    })
    await runGates({ repoRoot: '/x', gates: [withSection, without], config })
    expect(seen[0]).toEqual({ custom: 'x' })
    expect(seen[1]).toEqual({})
  })

  it('synthesizes a violation when admitted corpus is below the default minCorpus', async () => {
    const gate = fakeGate('empty', async () => ({ violations: [], corpus: { admitted: 0 } }))
    const summary = await runGates({ repoRoot: '/x', gates: [gate], config })
    expect(summary.failed).toBe(true)
    expect(summary.runs[0]?.violations[0]?.message).toContain('minCorpus 1')
  })

  it('respects explicit minCorpus 0 for gates that legitimately find nothing', async () => {
    const gate = fakeGate('notes', async () => ({ violations: [], corpus: { admitted: 0 } }), 0)
    const summary = await runGates({ repoRoot: '/x', gates: [gate], config })
    expect(summary.failed).toBe(false)
  })

  it('marks a throwing gate as failed and continues without failFast', async () => {
    const boom = fakeGate('boom', async () => {
      throw new Error('kaboom')
    })
    const fine = fakeGate('fine', async () => ({ violations: [], corpus: { admitted: 1 } }))
    const summary = await runGates({ repoRoot: '/x', gates: [boom, fine], config })
    expect(summary.failed).toBe(true)
    expect(summary.runs[0]?.error?.message).toBe('kaboom')
    expect(summary.runs[1]?.gate.id).toBe('fine')
  })

  it('stops after the first failure with failFast', async () => {
    const bad = fakeGate('bad', async () => ({
      violations: [{ gate: 'bad', message: 'x' }],
      corpus: { admitted: 1 },
    }))
    const never = fakeGate('never', async () => ({ violations: [], corpus: { admitted: 1 } }))
    const summary = await runGates({ repoRoot: '/x', gates: [bad, never], config, failFast: true })
    expect(summary.runs).toHaveLength(1)
    expect(summary.failed).toBe(true)
  })
})
