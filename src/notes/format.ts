/**
 * In-file note format checks: header block, status-folder agreement, the
 * lifecycle section skeleton, the non-empty Alternatives rule, and the
 * archive-date rule. Pure and filesystem-read-only; shared by the note-format
 * gate and by the archive workflow (a note must be format-clean before it may
 * be sealed).
 *
 * The header block is strict: line 1 is `# Agent Note: <title>`, line 2 is the
 * `Status:` line, and archived notes — only archived notes — carry
 * `Archived: YYYY-MM-DD` on line 3.
 */
import { readFileSync } from 'node:fs'
import type { Violation } from '../core/types.js'
import { isValidNoteDate, type NoteLifecycle, type ParsedNotePath } from './tree.js'

/** `Status:` line grammar per lifecycle; archived notes stay `implemented`. */
const STATUS_GRAMMAR: Record<NoteLifecycle, RegExp> = {
  proposed: /^Status: proposed$/,
  implemented: /^Status: implemented$/,
  rejected: /^Status: rejected — .+$/,
  archived: /^Status: implemented$/,
}

const IMPLEMENTED_SECTIONS = ['## Problem', '## Decision', '## Alternatives considered', '## Consequences']

/** Required `##` sections per lifecycle, in required relative order. */
const SKELETONS: Record<NoteLifecycle, readonly string[]> = {
  proposed: ['## Problem', '## Proposal', '## Alternatives considered', '## Acceptance criteria', '## Risks'],
  implemented: IMPLEMENTED_SECTIONS,
  rejected: ['## Problem', '## Proposal', '## Alternatives considered', '## Rejection rationale'],
  archived: IMPLEMENTED_SECTIONS,
}

/** Proposal-era words banned from headings in shipped-tense notes (implemented/archived state what IS, never what was planned). */
const BANNED_SHIPPED_HEADING = /acceptance criteria|^#+\s*(proposal|plan)\b/i

interface ProseLine {
  text: string
  /** 1-based line number in the source file. */
  line: number
}

/** Format tokens inside fenced code blocks are examples, not document structure. */
function proseLines(lines: readonly string[]): ProseLine[] {
  const out: ProseLine[] = []
  let inFence = false
  lines.forEach((text, index) => {
    if (text.startsWith('```')) {
      inFence = !inFence
      return
    }
    if (!inFence) out.push({ text, line: index + 1 })
  })
  return out
}

/**
 * Check one note file against the in-file format contract. `entry` comes from
 * the tree walk or {@link parseNotePath}, which already rejected a bad filename
 * date or slug; this function does not re-check the path. Returned violations
 * carry the repo-relative path and, where known, a 1-based line.
 */
export function checkNoteFormat(absPath: string, entry: ParsedNotePath): Violation[] {
  const violations: Violation[] = []
  const fail = (message: string, line?: number): void => {
    violations.push({ gate: 'note-format', file: entry.relPath, ...(line === undefined ? {} : { line }), message })
  }

  const content = readFileSync(absPath, 'utf8').replaceAll('\r\n', '\n')
  // An empty file has zero lines; ''.split('\n') would pretend one exists.
  const lines = content === '' ? [] : content.split('\n')
  const prose = proseLines(lines)

  if (!/^# Agent Note: \S/.test(lines[0] ?? '')) fail('line 1 must be `# Agent Note: <title>`', 1)
  const statusGrammar = STATUS_GRAMMAR[entry.lifecycle]
  if (!statusGrammar.test(lines[1] ?? '')) {
    fail(`line 2 must match the ${entry.lifecycle} status grammar (${String(statusGrammar)})`, 2)
  }
  if (entry.lifecycle === 'archived') {
    const archived = /^Archived: (\d{4}-\d{2}-\d{2})$/.exec(lines[2] ?? '')
    if (archived?.[1] === undefined) {
      fail('archived notes must carry `Archived: YYYY-MM-DD` on line 3', 3)
    } else if (!isValidNoteDate(archived[1])) {
      fail(`the \`Archived:\` date ${archived[1]} is not a real calendar date`, 3)
    }
  } else {
    const stray = lines.findIndex((line) => line.startsWith('Archived: '))
    if (stray !== -1) fail('only archived notes carry an `Archived:` line', stray + 1)
  }

  const h2s = prose
    .filter((proseLine) => proseLine.text.startsWith('## '))
    .map((proseLine) => ({ text: proseLine.text.trimEnd(), line: proseLine.line }))
  const first = h2s[0]
  if (first?.text !== '## Problem') {
    fail(`the first section must be \`## Problem\` (got ${first === undefined ? '<none>' : JSON.stringify(first.text)})`, first?.line)
  }
  const skeleton = SKELETONS[entry.lifecycle]
  const found = skeleton.map((section) => h2s.findIndex((h2) => h2.text === section))
  skeleton.forEach((section, index) => {
    if (found[index] === -1) fail(`missing the required \`${section}\` section`)
  })
  if (found.every((index) => index !== -1)) {
    // Every index is found, hence non-negative; the assertion states that fact.
    let inOrder = true
    for (let index = 1; index < found.length; index += 1) {
      if ((found[index] as number) <= (found[index - 1] as number)) inOrder = false
    }
    if (!inOrder) fail(`required sections are out of order (expected ${skeleton.join(' → ')})`)
  }

  const altIndex = h2s.findIndex((h2) => h2.text === '## Alternatives considered')
  const altHeading = altIndex === -1 ? undefined : h2s[altIndex]
  if (altHeading !== undefined) {
    const next = h2s[altIndex + 1]
    const region = lines
      .slice(altHeading.line, next === undefined ? lines.length : next.line - 1)
      .join('\n')
      .replace(/<!--[\s\S]*?-->/g, '')
    if (region.trim() === '') {
      fail('`## Alternatives considered` must record at least one real alternative (an empty or comment-only section counts as missing)', altHeading.line)
    }
  }

  if (entry.lifecycle === 'implemented' || entry.lifecycle === 'archived') {
    for (const proseLine of prose) {
      if (/^#{2,6}\s/.test(proseLine.text) && BANNED_SHIPPED_HEADING.test(proseLine.text)) {
        fail(`${JSON.stringify(proseLine.text.trim())} is a proposal-era heading; an ${entry.lifecycle === 'archived' ? 'archived' : 'implemented'} note states what is (fold it into Decision/Consequences)`, proseLine.line)
      }
    }
  }

  return violations
}
