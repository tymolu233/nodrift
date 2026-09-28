import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { main } from '../../src/cli/index.js'
import type { CliIo } from '../../src/cli/index.js'

let dir: string
let out: string[]
let err: string[]
let io: CliIo

function run(...argv: string[]): Promise<number> {
  return main(argv, io)
}

function write(rel: string, content: string): void {
  const file = join(dir, rel)
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, content)
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'nodrift-cli-'))
  out = []
  err = []
  io = { stdout: (line) => out.push(line), stderr: (line) => err.push(line) }
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('meta', () => {
  it('--version prints the package version', async () => {
    expect(await run('--version')).toBe(0)
    expect(out[0]).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('--help prints help to stdout', async () => {
    expect(await run('--help')).toBe(0)
    expect(out.join('\n')).toContain('nodrift check')
  })

  it('bare invocation prints help to stderr with exit 2', async () => {
    expect(await run()).toBe(2)
    expect(err.join('\n')).toContain('nodrift check')
  })

  it('unknown command exits 1 with an error line', async () => {
    expect(await run('frobnicate')).toBe(1)
    expect(err[0]).toMatch(/error: unknown command/)
  })
})

describe('init', () => {
  it('installs the full managed set and is idempotent', async () => {
    expect(await run('init', '--dir', dir)).toBe(0)
    for (const rel of [
      'README.md',
      'CONTRIBUTING.md',
      '.github/PULL_REQUEST_TEMPLATE.md',
      'nodrift.yml',
      'AGENTS.md',
      '.agents/notes/README.md',
      '.agents/skills/pre-push-checks/SKILL.md',
      'docs/notes-quality-gate.md',
    ]) {
      expect(existsSync(join(dir, rel)), rel).toBe(true)
    }
    const again = await run('init', '--dir', dir)
    expect(again).toBe(0)
    expect(out.join('\n')).toContain('skipped')
  })

  it('rejects unknown flags, including the retired --level', async () => {
    expect(await run('init', '--level', '1', '--dir', dir)).toBe(1)
    expect(err[0]).toMatch(/unknown flag/)
    expect(await run('init', '--wat', '--dir', dir)).toBe(1)
    expect(err[1]).toMatch(/unknown flag/)
  })

  it('rejects a non-string --dir', async () => {
    expect(await run('init', '--dir', '--force')).toBe(1)
    expect(err[0]).toMatch(/--dir must be a path/)
    expect(await run('init', '--dir=')).toBe(1)
    expect(err[1]).toMatch(/--dir must be a path/)
  })

  it('--force rewrites managed files but preserves nodrift.yml with a note', async () => {
    expect(await run('init', '--dir', dir)).toBe(0)
    write('AGENTS.md', 'LOCALLY EDITED')
    write('nodrift.yml', 'user: edits\n')
    expect(await run('init', '--dir', dir, '--force')).toBe(0)
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).not.toBe('LOCALLY EDITED')
    expect(readFileSync(join(dir, 'nodrift.yml'), 'utf8')).toBe('user: edits\n')
    expect(out.join('\n')).toContain('rewrote   AGENTS.md')
    expect(out.join('\n')).toContain('nodrift.yml preserved')
  })

  it('--agents installs the selected adapters next to the base set and asks to record them', async () => {
    expect(await run('init', '--agents', 'claude,gemini', '--dir', dir)).toBe(0)
    for (const rel of [
      'AGENTS.md',
      'nodrift.yml',
      'CLAUDE.md',
      'GEMINI.md',
      '.claude/skills/pre-push-checks/SKILL.md',
      '.agents/skills/pre-push-checks/SKILL.md',
    ]) {
      expect(existsSync(join(dir, rel)), rel).toBe(true)
    }
    expect(existsSync(join(dir, '.cursor'))).toBe(false)
    const text = out.join('\n')
    expect(text).toContain('created   CLAUDE.md')
    expect(text).toContain('created   .claude/skills/pre-push-checks/SKILL.md')
    expect(text).toContain('human: record the agent selection as `agents: [claude, gemini]` in nodrift.yml')
  })

  it('rerunning init --agents skips everything once the selection is recorded', async () => {
    expect(await run('init', '--agents', 'claude', '--dir', dir)).toBe(0)
    write('nodrift.yml', 'version: 1\nagents: [claude]\n')
    out = []
    expect(await run('init', '--agents', 'claude', '--dir', dir)).toBe(0)
    const text = out.join('\n')
    expect(text).toContain('skipped   CLAUDE.md (already exists)')
    expect(text).not.toContain('created   CLAUDE.md')
    expect(text).not.toContain('record the agent selection')
  })

  it('without the flag, init reads the adapters from nodrift.yml and asks for no recording', async () => {
    write('nodrift.yml', 'version: 1\nagents: [cursor]\n')
    expect(await run('init', '--dir', dir)).toBe(0)
    expect(existsSync(join(dir, '.cursor/rules/nodrift.mdc'))).toBe(true)
    expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(false)
    expect(out.join('\n')).not.toContain('record the agent selection')
  })

  it('the flag wins over the nodrift.yml selection', async () => {
    write('nodrift.yml', 'version: 1\nagents: [cursor]\n')
    expect(await run('init', '--agents', 'claude', '--dir', dir)).toBe(0)
    expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(true)
    expect(existsSync(join(dir, '.cursor'))).toBe(false)
  })

  it('an unrecordable nodrift.yml does not stop init; adapters come from the flag only', async () => {
    write('nodrift.yml', 'bogus: [unclosed\n')
    expect(await run('init', '--agents', 'gemini', '--dir', dir)).toBe(0)
    expect(existsSync(join(dir, 'GEMINI.md'))).toBe(true)
    expect(out.join('\n')).toContain('record the agent selection')
  })

  it('fails loud on unknown adapter ids and on a valueless --agents', async () => {
    expect(await run('init', '--agents', 'claude,wat', '--dir', dir)).toBe(1)
    expect(err[0]).toMatch(/unknown agent id\(s\) "wat" \(valid: claude, cursor, copilot, gemini, windsurf\)/)
    expect(existsSync(join(dir, 'AGENTS.md'))).toBe(false)
    expect(await run('init', '--agents', '--dir', dir)).toBe(1)
    expect(err[1]).toMatch(/--agents is required/)
  })

  it('--help names --agents and the closed id set', async () => {
    expect(await run('--help')).toBe(0)
    const text = out.join('\n')
    expect(text).toContain('--agents <id,id>')
    expect(text).toContain('claude, cursor, copilot, gemini, windsurf')
  })
})

describe('check', () => {
  it('--list prints every gate with its doc and state', async () => {
    write('nodrift.yml', 'version: 1\ngates:\n  md-wrap: {}\n  md-links: { enabled: false }\n')
    expect(await run('check', '--list', '--dir', dir)).toBe(0)
    const text = out.join('\n')
    for (const id of ['md-wrap', 'md-links', 'doc-budgets', 'note-classification', 'note-format', 'note-archive-seal', 'ratchet']) {
      expect(text).toContain(id)
    }
    expect(text).toContain('md-wrap [enabled]')
    expect(text).toContain('md-links [disabled]')
    expect(text).toContain('ratchet [not configured]')
  })

  it('fails on wrapped markdown and fails loud on unknown gate ids', async () => {
    write('a.md', 'line one\nline two\n')
    write('nodrift.yml', 'version: 1\ngates:\n  md-wrap: {}\n')
    expect(await run('check', '--dir', dir)).toBe(1)
    expect(err.join('\n')).toContain('md-wrap')
    write('nodrift.yml', 'version: 1\ngates:\n  not-a-gate: {}\n')
    expect(await run('check', '--dir', dir)).toBe(1)
    expect(err[err.length - 1]).toMatch(/unknown gate id/)
  })

  it('--only runs one gate and rejects disabled ones', async () => {
    write('a.md', 'fine\n')
    write('nodrift.yml', 'version: 1\ngates:\n  md-wrap: {}\n  md-links: { enabled: false }\n')
    expect(await run('check', '--only', 'md-wrap', '--dir', dir)).toBe(0)
    expect(await run('check', '--only', 'md-links', '--dir', dir)).toBe(1)
    expect(err[err.length - 1]).toMatch(/not enabled/)
  })

  it('fails loud when nodrift.yml is missing', async () => {
    expect(await run('check', '--dir', dir)).toBe(1)
    expect(err[0]).toMatch(/config file not found/)
  })

  it('--config takes an explicit path', async () => {
    write('conf/elsewhere.yml', 'version: 1\ngates:\n  md-wrap: {}\n')
    write('a.md', 'ok\n')
    expect(await run('check', '--config', 'conf/elsewhere.yml', '--dir', dir)).toBe(0)
  })

  it('--fail-fast stops after the first failing gate', async () => {
    write('a.md', 'one\ntwo\n')
    write('nodrift.yml', 'version: 1\ngates:\n  md-wrap: {}\n  md-links: {}\n')
    expect(await run('check', '--fail-fast', '--dir', dir)).toBe(1)
    const text = err.join('\n')
    expect(text).toContain('md-wrap')
    expect(text).not.toContain('md-links')
  })
})

describe('note', () => {
  beforeEach(() => {
    write('nodrift.yml', 'version: 1\nnotes:\n  root: .agents/notes\ngates: {}\n')
  })

  it('new creates a proposed note with defaults', async () => {
    expect(await run('note', 'new', '--class', 'process', '--title', 'My First Note', '--date', '2026-09-28', '--dir', dir)).toBe(0)
    const rel = '.agents/notes/proposed/process/2026-09-28-my-first-note.md'
    expect(await run('check', '--only', '--dir', dir)).toBe(1) // --only without value is boolean
    expect(existsSync(join(dir, rel))).toBe(true)
    expect(readFileSync(join(dir, rel), 'utf8')).toContain('# Agent Note: My First Note')
  })

  it('new honors --lifecycle rejected', async () => {
    expect(await run('note', 'new', '--class', 'process', '--title', 'No Go', '--lifecycle', 'rejected', '--date', '2026-09-28', '--dir', dir)).toBe(0)
    expect(existsSync(join(dir, '.agents/notes/rejected/process/2026-09-28-no-go.md'))).toBe(true)
  })

  it('default --dir is the process working directory', async () => {
    const cwd = process.cwd()
    process.chdir(dir)
    try {
      expect(await run('note', 'new', '--class', 'process', '--title', 'In Cwd', '--date', '2026-09-28')).toBe(0)
    } finally {
      process.chdir(cwd)
    }
    expect(existsSync(join(dir, '.agents/notes/proposed/process/2026-09-28-in-cwd.md'))).toBe(true)
  })

  it('rejects unknown classes and bad subcommands', async () => {
    expect(await run('note', 'new', '--class', 'weird', '--title', 'X', '--dir', dir)).toBe(1)
    expect(err[0]).toMatch(/unknown class/)
    expect(await run('note', 'melt', '--dir', dir)).toBe(1)
    expect(err[1]).toMatch(/unknown subcommand/)
  })

  it('archive seals an implemented note and refuses to re-archive', async () => {
    const noteRel = '.agents/notes/implemented/process/2026-09-28-ship-it.md'
    write(noteRel, [
      '# Agent Note: Ship It',
      'Status: implemented',
      '',
      '## Problem',
      '',
      'why',
      '',
      '## Decision',
      '',
      'what',
      '',
      '## Alternatives considered',
      '',
      '- **do nothing** — keeps the bug',
      '',
      '## Consequences',
      '',
      'cost and gain',
      '',
    ].join('\n'))
    expect(await run('note', 'archive', noteRel, '--dir', dir)).toBe(0)
    expect(out[0]).toContain('.agents/notes/archived/process/2026-09-28-ship-it.md')
    expect(existsSync(join(dir, '.agents/notes/archived/manifest.json'))).toBe(true)
    expect(await run('note', 'archive', '.agents/notes/archived/process/2026-09-28-ship-it.md', '--dir', dir)).toBe(1)
  })

  it('archive accepts a Windows-style backslash path', async () => {
    const noteRel = '.agents/notes/implemented/process/2026-09-28-backslash.md'
    write(noteRel, [
      '# Agent Note: Backslash',
      'Status: implemented',
      '',
      '## Problem',
      '',
      'p',
      '',
      '## Decision',
      '',
      'd',
      '',
      '## Alternatives considered',
      '',
      '- **x** — y',
      '',
      '## Consequences',
      '',
      'c',
      '',
    ].join('\n'))
    expect(await run('note', 'archive', '.agents\\notes\\implemented\\process\\2026-09-28-backslash.md', '--dir', dir)).toBe(0)
    expect(out[0]).toContain('.agents/notes/archived/process/2026-09-28-backslash.md')
  })

  it('note reseal rebuilds a deleted manifest, and enforces its flag set', async () => {
    const noteRel = '.agents/notes/implemented/process/2026-09-28-reseal-cli.md'
    write(noteRel, [
      '# Agent Note: Reseal CLI',
      'Status: implemented',
      '',
      '## Problem',
      '',
      'p',
      '',
      '## Decision',
      '',
      'd',
      '',
      '## Alternatives considered',
      '',
      '- **x** — y',
      '',
      '## Consequences',
      '',
      'c',
      '',
    ].join('\n'))
    expect(await run('note', 'archive', noteRel, '--dir', dir)).toBe(0)
    rmSync(join(dir, '.agents/notes/archived/manifest.json'), { force: true })
    expect(await run('note', 'reseal', '--dir', dir)).toBe(0)
    expect(out.join('\n')).toContain('resealed 1 archived note(s)')
    expect(await run('note', 'reseal', '--species', 'x', '--dir', dir)).toBe(1)
    expect(err[err.length - 1]).toMatch(/unknown flag/)
  })

  it('archive without a path is a usage error', async () => {
    expect(await run('note', 'archive', '--dir', dir)).toBe(1)
    expect(err[0]).toMatch(/a note path is required/)
  })
})

describe('ratchet', () => {
  const YAML = [
    'version: 1',
    'gates:',
    '  ratchet:',
    '    rules:',
    '      - id: no-todo',
    "        pattern: 'TODO'",
    "        files: ['src/**']",
    '        baseline: .agents/ratchet/no-todo.json',
    '',
  ].join('\n')

  beforeEach(() => {
    write('nodrift.yml', YAML)
    write('src/a.ts', '// TODO fix this\n')
  })

  it('verify reports new hits, update registers them, verify then passes', async () => {
    expect(await run('ratchet', 'verify', '--dir', dir)).toBe(1)
    expect(err.join('\n')).toContain('new forbidden-pattern hit')
    expect(await run('ratchet', 'update', 'no-todo', '--dir', dir)).toBe(0)
    expect(out[0]).toMatch(/no-todo: \+1 -0 =1/)
    expect(await run('ratchet', 'verify', '--dir', dir)).toBe(0)
    expect(out[1]).toContain('ratchet baselines hold')
  })

  it('update all and unknown-id handling', async () => {
    expect(await run('ratchet', 'update', 'all', '--dir', dir)).toBe(0)
    expect(readFileSync(join(dir, '.agents/ratchet/no-todo.json'), 'utf8')).toContain('"fingerprint"')
    expect(await run('ratchet', 'update', 'nope', '--dir', dir)).toBe(1)
    expect(err[err.length - 1]).toMatch(/unknown ratchet rule/)
    expect(await run('ratchet', 'update', '--dir', dir)).toBe(1)
    expect(err[err.length - 1]).toMatch(/a rule id/)
  })

  it('stale baseline entries fail verify until pruned', async () => {
    expect(await run('ratchet', 'update', 'all', '--dir', dir)).toBe(0)
    write('src/a.ts', '// fixed\n')
    expect(await run('ratchet', 'verify', '--dir', dir)).toBe(1)
    expect(err.join('\n')).toContain('vanished occurrence')
    expect(await run('ratchet', 'update', 'all', '--dir', dir)).toBe(0)
    expect(await run('ratchet', 'verify', '--dir', dir)).toBe(0)
  })

  it('check --only ratchet fails on unregistered debt', async () => {
    expect(await run('check', '--only', 'ratchet', '--dir', dir)).toBe(1)
    expect(err.join('\n')).toContain('hits forbidden pattern')
  })

  it('unknown subcommand errors', async () => {
    expect(await run('ratchet', 'yeet', '--dir', dir)).toBe(1)
    expect(err[0]).toMatch(/unknown subcommand/)
  })

  it('update on an empty rules list names `none configured`', async () => {
    write('nodrift.yml', 'version: 1\ngates:\n  ratchet:\n    rules: []\n')
    expect(await run('ratchet', 'update', 'nope', '--dir', dir)).toBe(1)
    expect(err[err.length - 1]).toMatch(/none configured/)
  })

  it('missing ratchet section fails loud; missing subcommand names the known ones', async () => {
    write('nodrift.yml', 'version: 1\ngates: {}\n')
    expect(await run('ratchet', 'verify', '--dir', dir)).toBe(1)
    expect(err[err.length - 1]).toMatch(/rules is required/)
    expect(await run('ratchet', 'update', 'all', '--dir', dir)).toBe(1)
    expect(err[err.length - 1]).toMatch(/rules is required/)
    expect(await run('note', '--dir', dir)).toBe(1)
    expect(err[err.length - 1]).toMatch(/known: new, archive/)
    expect(await run('ratchet', '--dir', dir)).toBe(1)
    expect(err[err.length - 1]).toMatch(/known: verify, update/)
  })
})
