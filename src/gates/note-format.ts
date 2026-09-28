/**
 * note-format: every discovered note carries the strict header block, a
 * `Status:` line that agrees with its lifecycle folder, the lifecycle section
 * skeleton in order, a non-empty Alternatives considered section, and the
 * archive-date rule. Note files come from the note tree walk only; the gate
 * reads no option beyond `enabled` (handled by the runner).
 */
import type { Gate, Violation } from '../core/types.js'
import { checkNoteFormat } from '../notes/format.js'
import { walkAgentNoteTree } from '../notes/tree.js'

export const noteFormatGate: Gate = {
  id: 'note-format',
  doc: 'Proves every discovered note has the header block (line 1 title, line 2 status, line 3 archive date for archived notes only), a status that agrees with its lifecycle folder, the lifecycle section skeleton in order, and a non-empty Alternatives considered section. Does not prove the content of any note is correct or that the decisions recorded are wise.',
  // A brand-new repository has zero notes; requiring a non-empty corpus would
  // fail the gate on the day it is adopted, before any note could exist.
  minCorpus: 0,
  async run(ctx) {
    const entries = walkAgentNoteTree(ctx.repoRoot, ctx.config.notes)
    const violations: Violation[] = []
    for (const entry of entries) {
      violations.push(...checkNoteFormat(entry.absPath, entry))
    }
    return { violations, corpus: { admitted: entries.length } }
  },
}
