import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { filterByGlobs, globOption, listRepoFiles, matchesAny } from '../../src/core/walk.js'

let dir: string

function put(rel: string, content = 'x'): void {
  const file = join(dir, rel)
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, content)
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'nodrift-walk-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('listRepoFiles', () => {
  it('falls back to a recursive walk outside git, skipping vendored dirs', () => {
    put('src/a.ts')
    put('node_modules/pkg/b.js')
    put('dist/out.js')
    put('.hidden/c.md')
    expect(listRepoFiles(dir)).toEqual(['.hidden/c.md', 'src/a.ts'])
  })

  it('uses git ls-files inside a repository (tracked + untracked, ignore-respecting)', () => {
    put('src/a.ts')
    put('ignored.log')
    put('.gitignore', 'ignored.log\n')
    execFileSync('git', ['init', '-q'], { cwd: dir })
    execFileSync('git', ['add', '.gitignore', 'src/a.ts'], { cwd: dir })
    put('untracked.md')
    const files = listRepoFiles(dir)
    expect(files).toContain('src/a.ts')
    expect(files).toContain('untracked.md')
    expect(files).not.toContain('ignored.log')
  })

  it('admits non-ASCII filenames in git mode (no quotePath octal escaping)', () => {
    put('文档.md')
    execFileSync('git', ['init', '-q'], { cwd: dir })
    execFileSync('git', ['add', '文档.md'], { cwd: dir })
    const files = listRepoFiles(dir)
    expect(files).toContain('文档.md')
    expect(matchesAny(files[0] ?? '', ['**/*.md'])).toBe(true)
  })

  it('falls back to the walk when .git exists but git cannot answer', () => {
    mkdirSync(join(dir, '.git'), { recursive: true })
    put('src/loose.md')
    expect(listRepoFiles(dir)).toEqual(['src/loose.md'])
  })
})

describe('matchesAny / filterByGlobs', () => {
  it('matches with dot:true and applies include-then-exclude', () => {
    expect(matchesAny('.agents/notes/x.md', ['**/*.md'])).toBe(true)
    expect(matchesAny('a/b.txt', ['**/*.md'])).toBe(false)
    const files = ['a.md', 'b.md', 'c.txt']
    expect(filterByGlobs(files, ['**/*.md'])).toEqual(['a.md', 'b.md'])
    expect(filterByGlobs(files, undefined, ['b.*'])).toEqual(['a.md', 'c.txt'])
    expect(filterByGlobs(files, [], [])).toEqual(files)
  })
})

describe('globOption', () => {
  it('returns undefined, lists, and throws on bad shapes', () => {
    expect(globOption({}, 'include')).toBeUndefined()
    expect(globOption({ include: ['**/*.md'] }, 'include')).toEqual(['**/*.md'])
    expect(() => globOption({ include: 'nope' }, 'include')).toThrow(/must be a list of glob strings/)
    expect(() => globOption({ include: [1] }, 'include')).toThrow(/must be a list of glob strings/)
  })
})
