/**
 * note-archive-seal: archived notes are frozen — every entry sealed in
 * `archived/manifest.json` still exists with unchanged bytes, every archived
 * note on disk is sealed, and every archived note carries its `Archived:`
 * line. The seal is append-only; the gate reads no option beyond `enabled`
 * (handled by the runner).
 */
import type { Gate } from '../core/types.js'
import { verifyArchiveSeal } from '../notes/archive.js'
import { walkAgentNoteTree } from '../notes/tree.js'

export const noteArchiveSealGate: Gate = {
  id: 'note-archive-seal',
  doc: 'Proves the archive is frozen: every sealed manifest entry still exists with its recorded sha256 (and git blob, when git can answer), every archived note is listed in the manifest, and every archived note carries an Archived line on line 3. Does not prove the content of any note is correct or that the decisions recorded were wise.',
  // A repository without archived notes yet — including every brand-new one —
  // has a trivially intact seal; requiring a non-empty corpus would fail the
  // gate until someone archives a first note.
  minCorpus: 0,
  async run(ctx) {
    const violations = verifyArchiveSeal(ctx.repoRoot, ctx.config.notes)
    const admitted = walkAgentNoteTree(ctx.repoRoot, ctx.config.notes).filter(
      (entry) => entry.lifecycle === 'archived',
    ).length
    return { violations, corpus: { admitted } }
  },
}
