/**
 * Repository file discovery and glob matching.
 *
 * Uses `git ls-files` when the target is a git repository so untracked-but-
 * intended files are admitted and ignored files are not; falls back to a
 * plain recursive walk otherwise (pre-`git init` projects, tarballs, or when
 * git itself cannot answer — missing binary, broken .git, dubious ownership).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { minimatch } from 'minimatch'

/** Directory names never admitted by the fallback walk. */
const FALLBACK_EXCLUDES = new Set(['node_modules', 'dist', 'coverage', '.git', '.hg', '.svn'])

function isGitRepo(repoRoot: string): boolean {
  return existsSync(join(repoRoot, '.git'))
}

/**
 * List via git. `-z` NUL-separates so non-ASCII names are NOT C-style quoted
 * (with quotePath on, `文档.md` prints as an octal-escaped quoted string that
 * no glob can match — a silently narrowing corpus, the exact failure the
 * minCorpus sentinel exists to catch).
 */
function gitFiles(repoRoot: string): string[] {
  const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return out.split(String.fromCharCode(0)).filter((line) => line.length > 0)
}

function walkDir(root: string, dir: string, acc: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!FALLBACK_EXCLUDES.has(entry.name)) walkDir(root, abs, acc)
    } else if (entry.isFile()) {
      acc.push(abs.slice(root.length + 1).split('\\').join('/'))
    }
  }
}

/**
 * List candidate files in the repository as repo-relative, forward-slash
 * paths. Symlinks are not followed. Git failure (no binary, broken .git)
 * falls through to the walk rather than crashing every gate.
 */
export function listRepoFiles(repoRoot: string): string[] {
  if (isGitRepo(repoRoot)) {
    try {
      return gitFiles(repoRoot)
    } catch {
      // fall through to the plain walk: git could not answer for this root
    }
  }
  const acc: string[] = []
  walkDir(repoRoot, repoRoot, acc)
  return acc.sort()
}

/**
 * @param file repo-relative, forward-slash path
 * @param patterns minimatch patterns; dotfiles match (`dot: true`)
 */
export function matchesAny(file: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => minimatch(file, pattern, { dot: true }))
}

/**
 * Apply include/exclude glob filtering to a file list.
 * Include omitted means "all files"; exclude wins over include.
 */
export function filterByGlobs(
  files: readonly string[],
  include?: readonly string[],
  exclude?: readonly string[],
): string[] {
  return files.filter((file) => {
    if (include !== undefined && include.length > 0 && !matchesAny(file, include)) return false
    if (exclude !== undefined && exclude.length > 0 && matchesAny(file, exclude)) return false
    return true
  })
}

/**
 * Read a glob list option from a gate config section.
 * @throws Error naming the key when the value is present but not a string list.
 */
export function globOption(options: Record<string, unknown>, key: string): string[] | undefined {
  const value = options[key]
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new Error(`${key} must be a list of glob strings`)
  }
  return value as string[]
}

/** True when the absolute path names a regular file (symlinks resolve to their target). */
export function isRegularFile(absPath: string): boolean {
  return existsSync(absPath) && statSync(absPath).isFile()
}
