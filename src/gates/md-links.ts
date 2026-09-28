/**
 * md-links gate: relative Markdown links resolve. A relative target must exist,
 * and a `#fragment` onto a Markdown file (including a same-file `#anchor`) must
 * name a real GitHub-style heading slug or an explicit `<a id="...">` there.
 * External links (http(s), mailto, any scheme), protocol-relative `//host`,
 * and root-absolute `/path` targets are not judged; fragments onto
 * non-Markdown targets (`file.ts#L10`) carry renderer-owned meaning and are
 * not judged either. The gate reports, never rewrites.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { Gate, GateContext, Violation } from '../core/types.js'
import { filterByGlobs, globOption, listRepoFiles } from '../core/walk.js'
import { markdownHeadingLines, parseMarkdown, visitMarkdown } from '../markdown/parse.js'

/** Option keys this gate understands; anything else fails loud as misconfiguration. */
const KNOWN_OPTIONS = new Set(['enabled', 'include', 'exclude'])

/** Files admitted when the config does not narrow the corpus. */
const DEFAULT_INCLUDE = ['**/*.md']

/** One broken relative link: a missing target path or a missing anchor on it. */
export interface BrokenLink {
  /** 1-based line where the link/image/definition node starts. */
  line: number
  /** The link URL as authored. */
  url: string
  /** What failed: the target file's existence or the fragment onto it. */
  reason: 'target' | 'anchor'
}

/**
 * True for targets this gate must NOT check: scheme-qualified URLs (`https:`,
 * `mailto:`, …), protocol-relative (`//host`), and root-absolute (`/path`).
 * Pure in-page anchors (`#frag`) ARE checked, against the source file itself.
 */
export function isExternalLink(url: string): boolean {
  if (url.startsWith('//')) return true
  if (url.startsWith('/')) return true
  // A scheme (`https:` / `mailto:`) is a colon before any slash, dot, or hash.
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)
}

/**
 * Strip the `#fragment` and `?query` from a link target, then percent-decode
 * the path so an encoded target (`My%20File.md`) probes the real filename on
 * disk, the way a Markdown renderer resolves it. A malformed escape (`%zz`)
 * makes `decodeURIComponent` throw; the raw path is kept in that case so the
 * existence check reports it broken instead of crashing the gate.
 */
export function linkPathPart(url: string): string {
  const raw = url.replace(/[#?].*$/, '')
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** The percent-decoded `#fragment` of a link target, or null when it has none. */
export function linkFragmentPart(url: string): string | null {
  const hash = url.indexOf('#')
  if (hash === -1) return null
  const raw = url.slice(hash + 1).replace(/\?.*$/, '')
  try {
    return decodeURIComponent(raw)
  } catch {
    // Same stance as linkPathPart: a malformed escape names no anchor anyone
    // meant, so the raw text flows into the lookup and is reported missing.
    return raw
  }
}

/**
 * GitHub's heading-slug algorithm: lowercase; drop everything but letters,
 * numbers, underscores, spaces, hyphens; spaces become hyphens.
 * @param heading the RENDERED heading text (Markdown syntax already gone)
 * @returns the anchor GitHub assigns the first occurrence of the heading
 */
export function githubSlug(heading: string): string {
  return heading.toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu, '').replaceAll(' ', '-')
}

/**
 * Every anchor one Markdown document exposes: each heading's GitHub slug —
 * computed from the RENDERED heading text, so links, images, inline code, and
 * emphasis inside a heading slug the way GitHub renders them — plus every
 * explicit `<a id="...">` in real HTML flow (a code sample and a commented-out
 * anchor register nothing). Repeated slugs get GitHub's occupied-set `-1`,
 * `-2`, … suffixes: `Repeat`, `Repeat-1`, `Repeat` yields `repeat`,
 * `repeat-1`, `repeat-2`. Matching is exact — element ids are case-sensitive.
 * @param source the document's full Markdown text
 * @returns the set of valid fragments for links into this document
 */
export function documentAnchors(source: string): Set<string> {
  const anchors = new Set<string>()
  const occurrences = new Map<string, number>()
  for (const heading of markdownHeadingLines(source)) {
    const base = githubSlug(heading.text)
    let result = base
    let bump = occurrences.get(base) ?? 0
    while (anchors.has(result)) {
      bump += 1
      result = `${base}-${bump}`
    }
    occurrences.set(base, bump)
    anchors.add(result)
  }
  visitMarkdown(parseMarkdown(source), (node): void => {
    if (node.type !== 'html') return
    const html = node.value.replace(/<!--[\s\S]*?-->/g, '')
    for (const match of html.matchAll(/<a id="([^"]+)"/g)) {
      /* v8 ignore next 1 -- a matchAll capture group is defined whenever the pattern matched; `?? ''` is a type-level fallback */
      anchors.add(match[1] ?? '')
    }
  })
  return anchors
}

/** Lazily collect and cache the anchor set of an existing Markdown file (each target parses once). */
function anchorCache(): (absPath: string) => Set<string> {
  const cache = new Map<string, Set<string>>()
  return (absPath) => {
    const hit = cache.get(absPath)
    if (hit !== undefined) return hit
    const anchors = documentAnchors(readFileSync(absPath, 'utf8'))
    cache.set(absPath, anchors)
    return anchors
  }
}

/**
 * Find every broken relative link in one Markdown file via its AST: a relative
 * target that does not exist, or a fragment onto a Markdown file (same-file
 * `#anchor` links included) that names no heading slug or explicit `<a id>`
 * there. Links inside code blocks and comments are not link nodes and are not
 * judged.
 * @param absPath absolute path of the Markdown source to scan
 * @param anchorsOf anchor lookup shared across files for the cross-link cache
 * @returns one entry per broken link, in document order
 */
export function findBrokenLinks(absPath: string, anchorsOf: (abs: string) => Set<string>): BrokenLink[] {
  const dir = dirname(absPath)
  const source = readFileSync(absPath, 'utf8')
  const tree = parseMarkdown(source)
  const out: BrokenLink[] = []

  const check = (url: string, line: number): void => {
    if (isExternalLink(url)) return
    const target = linkPathPart(url)
    const resolved = target === '' ? absPath : resolve(dir, target)
    if (!existsSync(resolved)) {
      out.push({ line, url, reason: 'target' })
      return
    }
    const fragment = linkFragmentPart(url)
    if (fragment === null || !resolved.endsWith('.md')) return
    if (!anchorsOf(resolved).has(fragment)) {
      out.push({ line, url, reason: 'anchor' })
    }
  }

  visitMarkdown(tree, (node): void => {
    if ((node.type === 'link' || node.type === 'image' || node.type === 'definition') && 'url' in node) {
      /* v8 ignore next 1 -- nodes from a real parse always carry position; the fallback exists for the optional type */
      check(node.url, node.position?.start.line ?? 0)
    }
  })
  return out
}

function assertKnownOptions(options: Record<string, unknown>): void {
  for (const key of Object.keys(options)) {
    if (!KNOWN_OPTIONS.has(key)) {
      throw new Error(`md-links: unknown option key "${key}" (known: enabled, include, exclude)`)
    }
  }
}

/** The md-links gate. */
export const mdLinksGate: Gate = {
  id: 'md-links',
  doc: 'Proves relative Markdown link targets exist and #anchors on them name a real heading slug or explicit <a id>. Does not prove external (http/mailto) links are reachable.',
  minCorpus: 1,
  async run(ctx: GateContext) {
    assertKnownOptions(ctx.options)
    const include = globOption(ctx.options, 'include') ?? DEFAULT_INCLUDE
    const exclude = globOption(ctx.options, 'exclude')
    const files = filterByGlobs(listRepoFiles(ctx.repoRoot), include, exclude)
    const anchorsOf = anchorCache()
    const violations: Violation[] = []
    for (const file of files) {
      for (const hit of findBrokenLinks(resolve(ctx.repoRoot, file), anchorsOf)) {
        violations.push({
          gate: 'md-links',
          file,
          line: hit.line,
          message: hit.reason === 'target'
            ? `relative link "${hit.url}" resolves to no file (fix the path or restore the target)`
            : `link fragment "${hit.url}" names no heading slug or <a id> in the target file (update the anchor or the heading)`,
        })
      }
    }
    return { violations, corpus: { admitted: files.length } }
  },
}
