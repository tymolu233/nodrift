/**
 * Shared GitHub-flavored Markdown parsing and traversal for the built-in gates.
 * Ported from deepseek-harness `scripts/markdown.ts` (MIT), keeping only the
 * generic parts: GFM extension wiring, depth-first visiting, and rendered
 * heading text. Repository-specific helpers (destination
 * offset rewriting, info-string fence inventories) are not ported; nothing
 * here assumes a repo layout.
 */
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'
import type { Nodes } from 'mdast'

/** One parsed Markdown heading, retaining its authored first line and rendered text. */
export interface MarkdownHeadingLine {
  /** 1-based source line number of the heading's first line. */
  index: number
  /** Source text of that first line, without normalization. */
  raw: string
  /** Parsed ATX or Setext heading depth. */
  depth: 1 | 2 | 3 | 4 | 5 | 6
  /** Rendered heading text, excluding raw HTML such as comments. */
  text: string
}

/** Parse GitHub-flavored Markdown with GFM enabled (tables, autolinks, task lists). */
export function parseMarkdown(source: string): Nodes {
  return fromMarkdown(source, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })
}

/**
 * Visit a Markdown tree depth-first; returning false prunes a node's children.
 * @param node current tree node
 * @param visitor callback invoked before each node's children
 */
export function visitMarkdown(node: Nodes, visitor: (node: Nodes) => boolean | void): void {
  if (visitor(node) === false) return
  if ('children' in node) {
    for (const child of node.children) visitMarkdown(child, visitor)
  }
}

/** Text a reader sees from one Markdown node; raw HTML itself contributes none. */
function renderedText(node: Nodes): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value
  /* v8 ignore next 1 -- micromark yields '' for missing alt; null exists only in the mdast type union */
  if (node.type === 'image' || node.type === 'imageReference') return node.alt ?? ''
  if (node.type === 'break') return ' '
  if ('children' in node) return node.children.map((child) => renderedText(child)).join('')
  return ''
}

/** Return every parsed heading with its rendered text, authored line, and depth. */
export function markdownHeadingLines(source: string): MarkdownHeadingLine[] {
  const rawLines = source.split('\n')
  const headings: MarkdownHeadingLine[] = []
  visitMarkdown(parseMarkdown(source), (node) => {
    if (node.type !== 'heading' || node.position === undefined) return
    headings.push({
      depth: node.depth,
      index: node.position.start.line,
      /* v8 ignore next 1 -- position.start.line always indexes into rawLines for this same source string */
      raw: rawLines[node.position.start.line - 1] ?? '',
      text: renderedText(node),
    })
  })
  return headings
}
