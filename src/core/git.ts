/**
 * Best-effort git helpers: every function returns undefined instead of
 * throwing when git is unavailable or the target is not a repository,
 * because anti-shishan must keep working on pre-`git init` projects.
 */
import { execFileSync } from 'node:child_process'

function tryGit(repoRoot: string, args: string[]): string | undefined {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return undefined
  }
}

/**
 * Git blob hash of a file as it would be committed (content-addressed,
 * line-ending normalized per repo config). Undefined when git cannot answer.
 */
export function gitBlobHash(repoRoot: string, repoRelativePath: string): string | undefined {
  return tryGit(repoRoot, ['hash-object', '--', repoRelativePath])
}

/** True when `git` is callable inside repoRoot. */
export function gitAvailable(repoRoot: string): boolean {
  return tryGit(repoRoot, ['rev-parse', '--is-inside-work-tree']) === 'true'
}
