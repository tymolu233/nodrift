/**
 * End-to-end lifecycle against the built binary: the exact user journey
 * init → first check (placeholder signals) → fill in → debt handling → green,
 * plus the note and ratchet command flows. In-process unit specs cover
 * semantics; this file proves the shipped artifact and its bootstrap work.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const cliPath = join(packageRoot, 'dist', 'cli', 'index.js')

interface CliResult {
  code: number
  out: string
}

function cli(args: string[], cwd: string): CliResult {
  try {
    const stdout = execFileSync('node', [cliPath, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, out: stdout }
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string }
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

let repo: string

beforeAll(() => {
  // Invoke tsc directly: spawning `npm` needs `npm.cmd` resolution on Windows
  // and a shell on every platform; node + the local tsc binary needs neither.
  const tscBin = join(packageRoot, 'node_modules', 'typescript', 'bin', 'tsc')
  execFileSync('node', [tscBin, '-p', 'tsconfig.json'], { cwd: packageRoot, stdio: 'ignore' })
  repo = mkdtempSync(join(tmpdir(), 'anti-shishan-e2e-'))
}, 120_000)

afterAll(() => {
  rmSync(repo, { recursive: true, force: true })
})

describe('built binary', () => {
  it('--version runs through the process-entry bootstrap', () => {
    const result = cli(['--version'], repo)
    expect(result.code).toBe(0)
    expect(result.out).toMatch(/^\d+\.\d+\.\d+/)
  })
})

describe('init → check lifecycle', () => {
  it('scaffolds the full managed set with config and skills', () => {
    const result = cli(['init'], repo)
    expect(result.code).toBe(0)
    expect(existsSync(join(repo, 'anti-shishan.yml'))).toBe(true)
    expect(existsSync(join(repo, '.agents', 'skills', 'pre-push-checks', 'SKILL.md'))).toBe(true)
  })

  it('first check tells the user exactly which placeholders to fill', () => {
    const result = cli(['check'], repo)
    expect(result.code).toBe(1)
    // Fresh repo: the scaffolded README.md budget points at a file that does
    // not exist yet, and the example ratchet rule has no src/** corpus.
    expect(result.out).toContain('README.md')
    expect(result.out).toContain('ratchet')
  })

  it('filling placeholders turns every gate green except genuine new debt', () => {
    writeFileSync(join(repo, 'README.md'), '# demo\n\nA demo repository.\n')
    mkdirSync(join(repo, 'src'), { recursive: true })
    writeFileSync(join(repo, 'src', 'index.ts'), 'export const x = 1 // TODO tracked later\n')
    const result = cli(['check'], repo)
    expect(result.code).toBe(1)
    expect(result.out).toContain('hits forbidden pattern')
    expect(result.out).not.toContain('README.md')
  })

  it('ratchet update registers the debt and check goes green', () => {
    expect(cli(['ratchet', 'update', 'all'], repo).code).toBe(0)
    const result = cli(['check'], repo)
    expect(result.code).toBe(0)
    expect(result.out).toContain('Summary: 0/7 gates failed')
  })

  it('note lifecycle: new → archive → seal verification stays green', () => {
    expect(cli(['note', 'new', '--class', 'process', '--title', 'Adopt Anti-Shishan', '--date', '2026-09-28'], repo).code).toBe(0)
    const proposed = join(repo, '.agents', 'notes', 'proposed', 'process', '2026-09-28-adopt-anti-shishan.md')
    expect(existsSync(proposed)).toBe(true)

    const implemented = join(repo, '.agents', 'notes', 'implemented', 'process', '2026-09-28-anti-shishan-v0-1.md')
    mkdirSync(dirname(implemented), { recursive: true })
    writeFileSync(
      implemented,
      [
        '# Agent Note: Anti-Shishan v0.1',
        'Status: implemented',
        '',
        '## Problem',
        '',
        'Governance rules lived in prose and drifted.',
        '',
        '## Decision',
        '',
        'Move them into executable gates run by anti-shishan check.',
        '',
        '## Alternatives considered',
        '',
        '- **CONTRIBUTING-only** — rules that cannot execute rot within weeks.',
        '',
        '## Consequences',
        '',
        'Every rule now has a mechanical backstop.',
        '',
      ].join('\n'),
    )
    expect(cli(['note', 'archive', '.agents/notes/implemented/process/2026-09-28-anti-shishan-v0-1.md'], repo).code).toBe(0)
    const result = cli(['check'], repo)
    expect(result.code).toBe(0)
    expect(result.out).toContain('Summary: 0/7 gates failed')
  })
})
