/**
 * md-wrap gate: one prose paragraph = one physical source line.
 * The GFM AST distinguishes paragraphs — including those nested in lists and
 * blockquotes — from multiline structural nodes, so fenced/indented code,
 * tables, and HTML blocks are never flagged. The gate reports, never rewrites.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Gate, GateContext, Violation } from '../core/types.js'
import { filterByGlobs, globOption, listRepoFiles } from '../core/walk.js'
import { parseMarkdown, visitMarkdown } from '../markdown/parse.js'

/** Option keys this gate understands; anything else fails loud as misconfiguration. */
const KNOWN_OPTIONS = new Set(['enabled', 'include', 'exclude'])

/** Files admitted when the config does not narrow the corpus. */
const DEFAULT_INCLUDE = ['**/*.md']

/** One hard-wrapped paragraph: a prose paragraph spanning more than one source line. */
export interface WrappedParagraph {
  /** 1-based line where the paragraph starts. */
  line: number
  /** The paragraph's authored first line, trimmed. */
  text: string
}

function assertKnownOptions(options: Record<string, unknown>): void {
  for (const key of Object.keys(options)) {
    if (!KNOWN_OPTIONS.has(key)) {
      throw new Error(`md-wrap: unknown option key "${key}" (known: enabled, include, exclude)`)
    }
  }
}

/**
 * Blank out leading YAML frontmatter (keeping line numbers stable) so its keys
 * are not mistaken for prose. Only the ```--- ... ````` block is masked;
 * renderer-specific container syntax (e.g. VitePress `:::`) is author-owned.
 */
function maskFrontmatter(source: string): string {
  const lines = source.split('\n')
  if (lines[0] !== '---') return source
  const closing = lines.indexOf('---', 1)
  if (closing === -1) return source
  for (let index = 0; index <= closing; index += 1) lines[index] = ''
  return lines.join('\n')
}

/** Find every hard-wrapped prose paragraph in one Markdown source via its AST. */
export function findWrappedParagraphs(source: string): WrappedParagraph[] {
  const rawLines = source.split('\n')
  const out: WrappedParagraph[] = []
  visitMarkdown(parseMarkdown(maskFrontmatter(source)), (node): boolean | void => {
    if (node.type !== 'paragraph' || node.position === undefined) return
    const { start, end } = node.position
    if (end.line > start.line) {
      /* v8 ignore next 1 -- start.line always indexes into rawLines for nodes from this same source string */
      out.push({ line: start.line, text: (rawLines[start.line - 1] ?? '').trim() })
    }
    // Paragraph children are inline; no paragraph can nest below this one.
    return false
  })
  return out
}

/** The md-wrap gate. */
export const mdWrapGate: Gate = {
  id: 'md-wrap',
  doc: 'Proves typography: every prose paragraph (including in lists and quotes) occupies one physical line, with code, tables, and HTML blocks exempt. Does not prove content quality.',
  minCorpus: 1,
  async run(ctx: GateContext) {
    assertKnownOptions(ctx.options)
    const include = globOption(ctx.options, 'include') ?? DEFAULT_INCLUDE
    const exclude = globOption(ctx.options, 'exclude')
    const files = filterByGlobs(listRepoFiles(ctx.repoRoot), include, exclude)
    const violations: Violation[] = []
    for (const file of files) {
      const source = readFileSync(join(ctx.repoRoot, file), 'utf8')
      for (const hit of findWrappedParagraphs(source)) {
        const ellipsis = hit.text.length > 80 ? '…' : ''
        violations.push({
          gate: 'md-wrap',
          file,
          line: hit.line,
          message: `paragraph starts here and continues on later lines (write one physical line per paragraph): ${hit.text.slice(0, 80)}${ellipsis}`,
        })
      }
    }
    return { violations, corpus: { admitted: files.length } }
  },
}
