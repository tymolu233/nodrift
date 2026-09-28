/**
 * note-classification: every note path under the notes root follows
 * `<lifecycle>/<class>/yyyy-mm-dd-slug.md`, with a known lifecycle, a
 * configured class, a real calendar date, and a lowercase-hyphen slug, and no
 * unknown folders hide notes from the walk. Candidate files come from the note
 * tree walk only; the gate reads no option beyond `enabled` (handled by the
 * runner).
 */
import type { Gate, Violation } from '../core/types.js'
import { checkNotePath, listNoteCandidatePaths, walkNotesTreeStructure } from '../notes/tree.js'

export const noteClassificationGate: Gate = {
  id: 'note-classification',
  doc: 'Proves every note under the notes root sits at <lifecycle>/<class>/yyyy-mm-dd-slug.md with a known lifecycle, a configured class, a real calendar date, and a lowercase-hyphen slug, and that no unknown top-level folder hides notes from the gates. Does not prove the content of any note is correct or that the decisions recorded are wise.',
  // A brand-new repository has zero notes; requiring a non-empty corpus would
  // fail the gate on the day it is adopted, before any note could exist.
  minCorpus: 0,
  async run(ctx) {
    const violations: Violation[] = []
    for (const issue of walkNotesTreeStructure(ctx.repoRoot, ctx.config.notes)) {
      violations.push({ gate: 'note-classification', file: issue.path, message: issue.message })
    }
    let admitted = 0
    for (const relPath of listNoteCandidatePaths(ctx.repoRoot, ctx.config.notes)) {
      const check = checkNotePath(relPath, ctx.config.notes)
      if (check.kind === 'ignored') continue
      admitted += 1
      if (check.kind === 'invalid') {
        violations.push({ gate: 'note-classification', file: relPath, message: check.message })
      }
    }
    return { violations, corpus: { admitted } }
  },
}
