import { describe, expect, it } from 'vitest'
import { markdownHeadingLines, parseMarkdown, visitMarkdown } from '../../src/markdown/parse.js'

function nodeTypes(source: string): string[] {
  const types: string[] = []
  visitMarkdown(parseMarkdown(source), (node) => {
    types.push(node.type)
  })
  return types
}

describe('parseMarkdown', () => {
  it('parses GFM tables as table nodes, not paragraphs', () => {
    expect(nodeTypes('| a | b |\n|---|---|\n| 1 | 2 |\n')).toContain('table')
  })

  it('parses GFM task-list items inside lists', () => {
    expect(nodeTypes('- [x] done\n')).toContain('listItem')
  })

  it('parses plain paragraphs as children of root', () => {
    const tree = parseMarkdown('hello\n')
    expect(tree.type).toBe('root')
    expect('children' in tree && tree.children[0]?.type).toBe('paragraph')
  })
})

describe('visitMarkdown', () => {
  it('visits depth-first pre-order', () => {
    expect(nodeTypes('# H\n\npara *em*\n\n- a\n')).toEqual([
      'root', 'heading', 'text', 'paragraph', 'text', 'emphasis', 'text', 'list', 'listItem', 'paragraph', 'text',
    ])
  })

  it('prunes children when the visitor returns false', () => {
    const types: string[] = []
    visitMarkdown(parseMarkdown('- a\n- b\n'), (node): boolean | void => {
      types.push(node.type)
      if (node.type === 'list') return false
    })
    expect(types).toEqual(['root', 'list'])
  })
})

describe('markdownHeadingLines', () => {
  it('returns ATX headings with rendered text and 1-based line', () => {
    const headings = markdownHeadingLines('# Hello *World*\n')
    expect(headings).toEqual([{ depth: 1, index: 1, raw: '# Hello *World*', text: 'Hello World' }])
  })

  it('returns setext headings with their depth', () => {
    const headings = markdownHeadingLines('Title\n=====\n\nSub\n---\n')
    expect(headings.map((heading) => heading.depth)).toEqual([1, 2])
    expect(headings[0]?.index).toBe(1)
  })

  it('renders inline code, links, and images the way a reader sees them', () => {
    const [heading] = markdownHeadingLines('## A `code` and [link](x.md) and ![alt](i.png)\n')
    expect(heading?.text).toBe('A code and link and alt')
  })

  it('drops raw HTML such as comments from rendered text', () => {
    const [heading] = markdownHeadingLines('# a <!-- hidden --> b\n')
    expect(heading?.text).toBe('a  b')
  })

  it('renders a hard break inside a heading as a space', () => {
    const [heading] = markdownHeadingLines('part one  \npart two\n=============\n')
    expect(heading?.depth).toBe(1)
    expect(heading?.text).toBe('part one part two')
  })
})

describe('markdownHeadingLines image alt', () => {
  it('renders heading images with and without alt text', () => {
    const headings = markdownHeadingLines('## ![icon](i.png) and plain\n\n## ![](i.png)\n')
    expect(headings[0]?.text).toBe('icon and plain')
    expect(headings[1]?.text).toBe('')
  })
})
