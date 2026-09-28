import { describe, expect, it } from 'vitest'
import type { Gate } from '../../src/core/types.js'
import { formatReport } from '../../src/runner/report.js'
import type { RunSummary } from '../../src/runner/runner.js'

function gate(id: string): Gate {
  return { id, doc: 'd', run: async () => ({ violations: [], corpus: { admitted: 0 } }) }
}

describe('formatReport', () => {
  it('marks good and bad gates, prints file:line and bare violations, crashes, and the summary', () => {
    const summary: RunSummary = {
      failed: true,
      runs: [
        { gate: gate('ok'), violations: [], admitted: 12 },
        {
          gate: gate('bad'),
          admitted: 12,
          violations: [
            { gate: 'bad', file: 'a.md', line: 7, message: 'die' },
            { gate: 'bad', file: 'noline.md', message: 'file without line' },
            { gate: 'bad', message: 'global problem' },
          ],
        },
        { gate: gate('crash'), violations: [], admitted: 0, error: new Error('kaputt') },
      ],
    }
    const out = formatReport(summary)
    expect(out).toContain('✓ ok (12 files)')
    expect(out).toContain('✗ bad (12 files)')
    expect(out).toContain('✗ a.md:7: die')
    expect(out).toContain('✗: global problem')
    expect(out).toContain('! gate crashed: kaputt')
    expect(out.trimEnd().endsWith('Summary: 2/3 gates failed')).toBe(true)
  })
})
