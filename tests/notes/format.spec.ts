import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkNoteFormat } from '../../src/notes/format.js'
import type { ParsedNotePath } from '../../src/notes/tree.js'
const tempRoots: string[] = []

function tmpRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix))
  tempRoots.push(root)
  return root
}

afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop() as string, { recursive: true, force: true })
})

function entry(overrides: Partial<ParsedNotePath> = {}): ParsedNotePath {
  return {
    lifecycle: 'proposed',
    class: 'feature',
    fileName: '2026-09-28-sample.md',
    date: '2026-09-28',
    slug: 'sample',
    relPath: '.agents/notes/proposed/feature/2026-09-28-sample.md',
    ...overrides,
  }
}

function checked(content: string, overrides: Partial<ParsedNotePath> = {}): ReturnType<typeof checkNoteFormat> {
  const parsed = entry(overrides)
  const root = tmpRoot('nodrift-format-')
  const abs = join(root, parsed.relPath)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
  return checkNoteFormat(abs, parsed)
}

const PROPOSED_OK = `# Agent Note: Sample
Status: proposed

## Problem

Something is missing.

## Proposal

Add it.

## Alternatives considered

- **Do nothing** — keeps the gap.

## Acceptance criteria

The gate exists.

## Risks

None worth listing.
`

const IMPLEMENTED_OK = `# Agent Note: Sample
Status: implemented

## Problem

Something was missing.

## Decision

It was added.

## Alternatives considered

- **Do nothing** — kept the gap.

## Consequences

The gap closed.
`

const REJECTED_OK = `# Agent Note: Sample
Status: rejected — too risky

## Problem

Something is missing.

## Proposal

Add it the risky way.

## Alternatives considered

- **Do nothing** — acceptable.

## Rejection rationale

The risk is not worth it.
`

const ARCHIVED_OK = `# Agent Note: Sample
Status: implemented
Archived: 2026-09-28

## Problem

Something was missing.

## Decision

It was added.

## Alternatives considered

- **Do nothing** — kept the gap.

## Consequences

The gap closed.
`

describe('checkNoteFormat accepted notes', () => {
  it('accepts a conforming proposed note', () => {
    expect(checked(PROPOSED_OK)).toEqual([])
  })

  it('accepts a conforming implemented note', () => {
    expect(checked(IMPLEMENTED_OK, { lifecycle: 'implemented' })).toEqual([])
  })

  it('accepts a conforming rejected note with a verdict on the status line', () => {
    expect(checked(REJECTED_OK, { lifecycle: 'rejected' })).toEqual([])
  })

  it('accepts a conforming archived note', () => {
    expect(checked(ARCHIVED_OK, { lifecycle: 'archived' })).toEqual([])
  })

  it('ignores format tokens inside fenced code blocks', () => {
    const content = IMPLEMENTED_OK.replace(
      '## Consequences',
      '## Notes\n\n```md\n## Acceptance criteria\n## Problem\n```\n\n## Consequences',
    )
    expect(checked(content, { lifecycle: 'implemented' })).toEqual([])
  })

  it('allows bespoke sections between the required ones', () => {
    const content = IMPLEMENTED_OK.replace('## Consequences', '## Testing\n\nPinned by gates.\n\n## Consequences')
    expect(checked(content, { lifecycle: 'implemented' })).toEqual([])
  })
})

describe('checkNoteFormat header', () => {
  it('reports an empty file', () => {
    const violations = checked('')
    expect(violations.map((v) => v.message)).toEqual(
      expect.arrayContaining([
        'line 1 must be `# Agent Note: <title>`',
        expect.stringContaining('line 2 must match the proposed status grammar'),
      ]),
    )
  })

  it('reports an archived note truncated above its Archived line', () => {
    const violations = checked('# Agent Note: Sample\nStatus: implemented\n', { lifecycle: 'archived' })
    expect(violations.map((v) => v.message)).toContain(
      'archived notes must carry `Archived: YYYY-MM-DD` on line 3',
    )
  })

  it('reports an empty archived file', () => {
    expect(checked('', { lifecycle: 'archived' }).map((v) => v.message)).toContain(
      'archived notes must carry `Archived: YYYY-MM-DD` on line 3',
    )
  })

  it('requires the title on line 1', () => {
    const violations = checked(PROPOSED_OK.replace('# Agent Note: Sample', '# Sample'))
    expect(violations.map((v) => v.message)).toContain('line 1 must be `# Agent Note: <title>`')
    expect(violations[0]).toMatchObject({ gate: 'note-format', file: entry().relPath, line: 1 })
  })

  it('requires the title to be non-empty', () => {
    expect(checked('# Agent Note: \nStatus: proposed\n')).not.toEqual([])
  })

  it('requires the status on line 2 to agree with the lifecycle folder', () => {
    const violations = checked(
      PROPOSED_OK.replace('Status: proposed', 'Status: implemented'),
    )
    expect(violations.map((v) => v.message)).toEqual(
      expect.arrayContaining([expect.stringContaining('line 2 must match the proposed status grammar')]),
    )
  })

  it('requires a verdict on a rejected status line', () => {
    expect(
      checked(REJECTED_OK.replace('Status: rejected — too risky', 'Status: rejected'), {
        lifecycle: 'rejected',
      }).map((v) => v.message),
    ).toEqual(expect.arrayContaining([expect.stringContaining('rejected status grammar')]))
  })

  it('forbids an Archived line outside archived/', () => {
    const violations = checked(IMPLEMENTED_OK.replace('Status: implemented', 'Status: implemented\nArchived: 2026-09-28'), {
      lifecycle: 'implemented',
    })
    expect(violations.map((v) => v.message)).toContain('only archived notes carry an `Archived:` line')
    expect(violations[0]?.line).toBe(3)
  })

  it('requires the Archived line on line 3 of archived notes', () => {
    expect(checked(IMPLEMENTED_OK, { lifecycle: 'archived' }).map((v) => v.message)).toContain(
      'archived notes must carry `Archived: YYYY-MM-DD` on line 3',
    )
  })

  it('rejects a non-calendar Archived date', () => {
    expect(
      checked(ARCHIVED_OK.replace('Archived: 2026-09-28', 'Archived: 2026-13-01'), { lifecycle: 'archived' }).map(
        (v) => v.message,
      ),
    ).toEqual(expect.arrayContaining([expect.stringContaining('not a real calendar date')]))
  })
})

describe('checkNoteFormat skeleton', () => {
  it('requires `## Problem` first', () => {
    const content = IMPLEMENTED_OK.replace('## Problem', '## Background')
    const violations = checked(content, { lifecycle: 'implemented' })
    expect(violations.map((v) => v.message)).toEqual(
      expect.arrayContaining([expect.stringContaining('the first section must be `## Problem`')]),
    )
    expect(violations.map((v) => v.message)).toEqual(
      expect.arrayContaining([expect.stringContaining('missing the required `## Problem` section')]),
    )
  })

  it('reports a file with no sections at all', () => {
    const violations = checked('# Agent Note: Sample\nStatus: proposed\n\nJust prose.\n')
    expect(violations.map((v) => v.message)).toEqual(
      expect.arrayContaining([
        'the first section must be `## Problem` (got <none>)',
        'missing the required `## Risks` section',
      ]),
    )
  })

  it('requires every lifecycle section', () => {
    const noRisks = PROPOSED_OK.replace(/## Risks[\s\S]*$/, '')
    expect(checked(noRisks).map((v) => v.message)).toEqual(
      expect.arrayContaining(['missing the required `## Risks` section']),
    )
    const noDecision = IMPLEMENTED_OK.replace('## Decision', '## Resolution')
    expect(checked(noDecision, { lifecycle: 'implemented' }).map((v) => v.message)).toEqual(
      expect.arrayContaining(['missing the required `## Decision` section']),
    )
  })

  it('requires the sections in skeleton order', () => {
    const reordered = PROPOSED_OK.replace(
      '## Alternatives considered\n\n- **Do nothing** — keeps the gap.\n\n## Acceptance criteria\n\nThe gate exists.\n\n## Risks',
      '## Acceptance criteria\n\nThe gate exists.\n\n## Alternatives considered\n\n- **Do nothing** — keeps the gap.\n\n## Risks',
    )
    const messages = checked(reordered).map((v) => v.message)
    expect(messages.some((m) => m.includes('out of order'))).toBe(true)
  })

  it('requires a non-empty Alternatives section', () => {
    const empty = PROPOSED_OK.replace('- **Do nothing** — keeps the gap.\n\n', '')
    const violations = checked(empty)
    expect(violations.map((v) => v.message)).toEqual(
      expect.arrayContaining([expect.stringContaining('must record at least one real alternative')]),
    )
  })

  it('treats a comment-only Alternatives section as empty', () => {
    const commented = PROPOSED_OK.replace(
      '- **Do nothing** — keeps the gap.',
      '<!-- alternatives go here -->',
    )
    expect(checked(commented).map((v) => v.message)).toEqual(
      expect.arrayContaining([expect.stringContaining('must record at least one real alternative')]),
    )
  })

  it('checks Alternatives content through end of file when it is the last section', () => {
    const content = IMPLEMENTED_OK.replace(
      '## Alternatives considered\n\n- **Do nothing** — kept the gap.\n\n## Consequences\n\nThe gap closed.',
      '## Consequences\n\nThe gap closed.\n\n## Alternatives considered\n\n- **Do nothing** — kept the gap.',
    )
    const violations = checked(content, { lifecycle: 'implemented' })
    expect(violations.map((v) => v.message)).toEqual([
      expect.stringContaining('out of order'),
    ])
  })
})

describe('checkNoteFormat proposal-era headings', () => {
  it('bans Acceptance criteria headings in implemented notes', () => {
    const withEra = IMPLEMENTED_OK.replace('## Consequences', '## Acceptance criteria\n\nOld spec.\n\n## Consequences')
    const violations = checked(withEra, { lifecycle: 'implemented' })
    expect(violations.map((v) => v.message)).toEqual(
      expect.arrayContaining([expect.stringContaining('proposal-era heading')]),
    )
  })

  it('bans the phrase at any heading level, case-insensitively', () => {
    const withEra = IMPLEMENTED_OK.replace('## Consequences', '### acceptance criteria\n\nOld spec.\n\n## Consequences')
    expect(checked(withEra, { lifecycle: 'implemented' }).map((v) => v.message)).toEqual(
      expect.arrayContaining([expect.stringContaining('proposal-era heading')]),
    )
  })

  it('bans the phrase in archived notes as well', () => {
    const withEra = ARCHIVED_OK.replace('## Consequences', '## Acceptance criteria\n\nOld spec.\n\n## Consequences')
    expect(checked(withEra, { lifecycle: 'archived' }).map((v) => v.message)).toEqual(
      expect.arrayContaining([expect.stringContaining('proposal-era heading')]),
    )
  })

  it('allows the phrase in prose of implemented notes', () => {
    const inProse = IMPLEMENTED_OK.replace('It was added.', 'It was added. Acceptance criteria from the proposal were folded in.')
    expect(checked(inProse, { lifecycle: 'implemented' })).toEqual([])
  })

  it('keeps the phrase mandatory, not banned, in proposed notes', () => {
    expect(checked(PROPOSED_OK)).toEqual([])
  })
})
