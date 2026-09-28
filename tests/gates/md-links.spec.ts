import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { documentAnchors, githubSlug, isExternalLink, linkFragmentPart, linkPathPart, mdLinksGate } from '../../src/gates/md-links.js'
import type { GateContext } from '../../src/core/types.js'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'govkit-md-links-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function writeRepo(files: Record<string, string>): void {
  for (const [file, content] of Object.entries(files)) {
    const abs = join(root, file)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }
}

function ctx(options: Record<string, unknown> = {}): GateContext {
  return {
    repoRoot: root,
    options,
    config: { notes: { root: '.agents/notes', classes: ['process'] }, gates: {} },
  }
}

const TARGET_MD = [
  '# Hello World',
  '',
  '## Showcase: web_fetch',
  '',
  '<a id="manual">explicit anchor</a>',
  '',
  '# Repeat',
  '',
  '# Repeat-1',
  '',
  '# Repeat',
  '',
].join('\n')

describe('isExternalLink / linkPathPart / linkFragmentPart', () => {
  it('classifies external and judged targets', () => {
    expect(isExternalLink('https://example.com/x')).toBe(true)
    expect(isExternalLink('http://example.com')).toBe(true)
    expect(isExternalLink('mailto:a@b.co')).toBe(true)
    expect(isExternalLink('//example.com/x')).toBe(true)
    expect(isExternalLink('/abs/path.md')).toBe(true)
    expect(isExternalLink('b.md')).toBe(false)
    expect(isExternalLink('./b.md#frag')).toBe(false)
    expect(isExternalLink('#frag')).toBe(false)
  })

  it('strips and percent-decodes the path part', () => {
    expect(linkPathPart('b.md#frag')).toBe('b.md')
    expect(linkPathPart('b.md?x=1#frag')).toBe('b.md')
    expect(linkPathPart('My%20File.md')).toBe('My File.md')
    expect(linkPathPart('#frag')).toBe('')
    expect(linkPathPart('%zz.md')).toBe('%zz.md')
  })

  it('extracts and percent-decodes the fragment part', () => {
    expect(linkFragmentPart('b.md#frag')).toBe('frag')
    expect(linkFragmentPart('b.md')).toBeNull()
    expect(linkFragmentPart('b.md?x=1')).toBeNull()
    expect(linkFragmentPart('b.md#my%20heading')).toBe('my heading')
    expect(linkFragmentPart('b.md#%zz')).toBe('%zz')
  })
})

describe('githubSlug', () => {
  it('lowercases and turns spaces into hyphens', () => {
    expect(githubSlug('Hello World')).toBe('hello-world')
  })

  it('drops punctuation but keeps underscores', () => {
    expect(githubSlug('Showcase: web_fetch')).toBe('showcase-web_fetch')
  })

  it('keeps non-latin letters', () => {
    expect(githubSlug('中文 标题')).toBe('中文-标题')
  })
})

describe('documentAnchors', () => {
  it('collects heading slugs with GitHub duplicate suffixes', () => {
    const anchors = documentAnchors(TARGET_MD)
    expect(anchors.has('hello-world')).toBe(true)
    expect(anchors.has('showcase-web_fetch')).toBe(true)
    expect(anchors.has('repeat')).toBe(true)
    expect(anchors.has('repeat-1')).toBe(true)
    expect(anchors.has('repeat-2')).toBe(true)
  })

  it('honors explicit <a id="..."> in real HTML flow', () => {
    expect(documentAnchors(TARGET_MD).has('manual')).toBe(true)
  })

  it('ignores anchors inside fenced code and HTML comments', () => {
    const source = '```html\n<a id="coded">x</a>\n```\n\n<!-- <a id="commented">x</a> -->\n'
    expect(documentAnchors(source).has('coded')).toBe(false)
    expect(documentAnchors(source).has('commented')).toBe(false)
  })
})

describe('mdLinksGate.run', () => {
  it('passes when every relative target and anchor resolve', async () => {
    writeRepo({
      'a.md': [
        '# Local Heading',
        '',
        '[ok](b.md) and [anchor](b.md#hello-world) and [a-id](b.md#manual)',
        '[self](#local-heading) and [slug](b.md#showcase-web_fetch) and [dup](b.md#repeat-1)',
        '[ext](https://example.com) [mail](mailto:a@b.co) [proto](//x.co/y) [root](/abs.md)',
        '[code](util.ts#L10) and [encoded](My%20File.md)',
        '[ref-link][ref] and ![img](pic.png)',
        '',
        '[ref]: b.md#hello-world',
        '',
      ].join('\n'),
      'b.md': TARGET_MD,
      'c.md': '[again](b.md#hello-world)\n',
      'My File.md': '# T\n',
      'util.ts': 'code\n',
      'pic.png': 'png\n',
    })
    const result = await mdLinksGate.run(ctx())
    expect(result.violations).toEqual([])
    expect(result.corpus.admitted).toBe(4)
  })

  it('flags a missing target, a missing cross-file anchor, and a missing image', async () => {
    writeRepo({
      'a.md': '# Title\n\n[gone](nope.md) and [bad](b.md#gone) and [self-bad](#gone)\n\n![img](missing.png)\n',
      'b.md': '# Hello World\n',
    })
    const result = await mdLinksGate.run(ctx())
    expect(result.corpus.admitted).toBe(2)
    expect(result.violations).toHaveLength(4)
    expect(result.violations[0]).toMatchObject({ gate: 'md-links', file: 'a.md', line: 3 })
    expect(result.violations[0]?.message).toContain('nope.md')
    expect(result.violations[0]?.message).toContain('fix the path or restore the target')
    expect(result.violations[1]?.message).toContain('b.md#gone')
    expect(result.violations[1]?.message).toContain('no heading slug or <a id>')
    expect(result.violations[2]?.message).toContain('#gone')
    expect(result.violations[3]).toMatchObject({ line: 5 })
    expect(result.violations[3]?.message).toContain('missing.png')
  })

  it('flags a reference definition whose target is missing', async () => {
    writeRepo({ 'a.md': '[x][r]\n\n[r]: gone.md\n' })
    const result = await mdLinksGate.run(ctx())
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]?.message).toContain('gone.md')
  })

  it('flags a malformed percent-escape target as broken instead of crashing', async () => {
    writeRepo({ 'a.md': '[bad](%zz.md)\n' })
    const result = await mdLinksGate.run(ctx())
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]?.message).toContain('%zz.md')
  })

  it('does not judge links inside code blocks or comments', async () => {
    const source = 'text\n\n```md\n[gone](nope.md)\n```\n\n<!-- [gone](nope.md) -->\n'
    writeRepo({ 'a.md': source })
    const result = await mdLinksGate.run(ctx())
    expect(result.violations).toEqual([])
  })

  it('flags a nonexistent non-Markdown target without judging its fragment', async () => {
    writeRepo({ 'a.md': '[fine](util.ts#L10)\n' })
    const result = await mdLinksGate.run(ctx())
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]?.message).toContain('util.ts')
  })

  it('honors include and exclude globs', async () => {
    writeRepo({ 'a.md': '[gone](no.md)\n', 'docs/b.md': '[gone](no.md)\n' })
    const excluded = await mdLinksGate.run(ctx({ exclude: ['docs/**'] }))
    expect(excluded.corpus.admitted).toBe(1)
    const included = await mdLinksGate.run(ctx({ include: ['docs/**'] }))
    expect(included.corpus.admitted).toBe(1)
    expect(included.violations[0]?.file).toBe('docs/b.md')
  })

  it('fails loud on an unknown option key', async () => {
    writeRepo({ 'a.md': 'x\n' })
    await expect(mdLinksGate.run(ctx({ rules: [] }))).rejects.toThrow(
      'md-links: unknown option key "rules" (known: enabled, include, exclude)',
    )
  })

  it('fails loud when exclude is not a list of strings', async () => {
    writeRepo({ 'a.md': 'x\n' })
    await expect(mdLinksGate.run(ctx({ exclude: 'docs/**' }))).rejects.toThrow('exclude must be a list of glob strings')
  })
})
