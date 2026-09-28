/**
 * Human-readable check report. Plain text, `✓`/`✗` markers, one line per
 * gate plus indented violations; ends with a summary line. Kept dependency
 * free so it can be pasted into CI logs unchanged.
 */
import type { RunSummary } from './runner.js'

/**
 * @param summary result of runGates
 * @returns multi-line report ending with `Summary: X/Y gates failed`
 */
export function formatReport(summary: RunSummary): string {
  const lines: string[] = []
  let failedGates = 0
  for (const run of summary.runs) {
    const bad = run.violations.length > 0 || run.error !== undefined
    if (bad) failedGates += 1
    lines.push(`${bad ? '✗' : '✓'} ${run.gate.id} (${run.admitted} files)`)
    if (run.error !== undefined) {
      lines.push(`    ! gate crashed: ${run.error.message}`)
    }
    for (const v of run.violations) {
      const where = v.file !== undefined ? ` ${v.file}${v.line !== undefined ? `:${v.line}` : ''}` : ''
      lines.push(`    ✗${where}: ${v.message}`)
    }
  }
  lines.push(`Summary: ${failedGates}/${summary.runs.length} gates failed`)
  return lines.join('\n')
}
