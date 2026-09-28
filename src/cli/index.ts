#!/usr/bin/env node
/**
 * anti-shishan CLI: `init` (scaffold templates), `check` (run enabled gates),
 * `note new|archive` (decision-note lifecycle), `ratchet update|verify`
 * (forbidden-pattern baselines). Routing is dependency-injected through
 * `main(argv, io)` so tests drive every command in-process.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { CONFIG_FILE_NAME, loadConfig } from '../core/config.js'
import type { KitConfig } from '../core/types.js'
import { parseRules } from '../gates/ratchet.js'
import { BUILTIN_GATES, resolveGates } from '../gates/registry.js'
import { collectNextSteps } from '../init/next-steps.js'
import { scaffold } from '../init/scaffold.js'
import { archiveNote } from '../notes/archive.js'
import { createNote } from '../notes/new.js'
import { runRatchetUpdate, runRatchetVerify } from '../ratchet/update.js'
import { formatReport } from '../runner/report.js'
import { runGates } from '../runner/runner.js'
import { parseArgs, requireFlag } from './args.js'

/** Injectable output channels; defaults write to the real console. */
export interface CliIo {
  stdout: (line: string) => void
  stderr: (line: string) => void
}

const HELP = `anti-shishan — governance kit for AI-assisted development

Commands:
  anti-shishan init [--force] [--dir <path>]
      Install the full template set (constitution, gates config, notes,
      verdict CI, skills). Existing files are skipped; --force refreshes them
      (anti-shishan.yml stays user-owned). Trim scope in anti-shishan.yml, not
      here — gates are enabled per config, and unwanted files can be deleted.
  anti-shishan check [--config <path>] [--only <id,id>] [--fail-fast] [--list] [--dir <path>]
      Run the gates enabled in ${CONFIG_FILE_NAME}. Exit 1 when any gate fails.
  anti-shishan note new --class <class> --title <t> [--lifecycle proposed|rejected] [--date yyyy-mm-dd] [--dir <path>]
      Create a decision note with the right path and skeleton.
  anti-shishan note archive <note-path> [--dir <path>]
      Move an implemented note into archived/ and seal it (append-only manifest).
  anti-shishan ratchet verify [--config <path>] [--dir <path>]
      Diff forbidden-pattern occurrences against their baselines (read-only).
  anti-shishan ratchet update <rule-id|all> [--config <path>] [--dir <path>]
      Rewrite baselines from a fresh scan (registers or prunes debt).

Gates have a doc line each; run \`anti-shishan check --list\` to read what each one
proves — and what it does not prove.`

function requireDir(flags: Record<string, string | boolean>): string {
  const dir = flags['dir']
  if (dir === undefined) return process.cwd()
  if (typeof dir !== 'string' || dir.length === 0) throw new Error('--dir must be a path')
  return resolve(dir)
}

function loadConfigFor(dir: string, flags: Record<string, string | boolean>): KitConfig {
  const configFlag = flags['config']
  const configPath = configFlag === undefined ? undefined : resolve(dir, requireFlag(flags, 'config'))
  return loadConfig(dir, configPath)
}

function assertOnlyFlags(flags: Record<string, string | boolean>, allowed: string[], where: string): void {
  const unknown = Object.keys(flags).filter((key) => key !== 'help' && !allowed.includes(key))
  if (unknown.length > 0) {
    throw new Error(`${where}: unknown flag(s) ${unknown.map((f) => `--${f}`).join(', ')} (known: ${allowed.map((f) => `--${f}`).join(', ')})`)
  }
}

function cmdInit(flags: Record<string, string | boolean>, io: CliIo): number {
  assertOnlyFlags(flags, ['force', 'dir'], 'init')
  const targetDir = requireDir(flags)
  const plan = scaffold({
    targetDir,
    ...(flags['force'] === true ? { force: true } : {}),
  })
  for (const rel of plan.created) io.stdout(`created   ${rel}`)
  for (const rel of plan.overwritten) io.stdout(`rewrote   ${rel}`)
  for (const rel of plan.skipped) io.stdout(`skipped   ${rel} (already exists)`)
  if (plan.configPreserved) io.stdout('note      anti-shishan.yml preserved: it is user-owned; delete it to re-scaffold')
  io.stdout(`init done in ${targetDir}`)
  const steps = collectNextSteps(targetDir)
  if (steps.length > 0) {
    io.stdout('next steps:')
    for (const step of steps) io.stdout(`  - ${step}`)
  }
  return 0
}

async function cmdCheck(flags: Record<string, string | boolean>, io: CliIo): Promise<number> {
  assertOnlyFlags(flags, ['config', 'only', 'fail-fast', 'list', 'dir'], 'check')
  const dir = requireDir(flags)
  const config = loadConfigFor(dir, flags)
  if (flags['list'] === true) {
    for (const gate of BUILTIN_GATES) {
      const section = config.gates[gate.id]
      const state = section === undefined ? 'not configured' : section.enabled === false ? 'disabled' : 'enabled'
      io.stdout(`${gate.id} [${state}] — ${gate.doc}`)
    }
    return 0
  }
  const onlyFlag = flags['only']
  const only = onlyFlag === undefined ? undefined : requireFlag(flags, 'only').split(',').map((s) => s.trim()).filter((s) => s.length > 0)
  const gates = resolveGates(config, only)
  const summary = await runGates({
    repoRoot: dir,
    gates,
    config,
    ...(flags['fail-fast'] === true ? { failFast: true } : {}),
  })
  const out = io
  if (summary.failed) out.stderr(formatReport(summary))
  else out.stdout(formatReport(summary))
  return summary.failed ? 1 : 0
}

function cmdNoteNew(flags: Record<string, string | boolean>, io: CliIo): number {
  assertOnlyFlags(flags, ['class', 'title', 'lifecycle', 'date', 'dir', 'config'], 'note new')
  const dir = requireDir(flags)
  const config = loadConfigFor(dir, flags)
  const lifecycleRaw = flags['lifecycle']
  const lifecycle = lifecycleRaw === undefined ? 'proposed' : requireFlag(flags, 'lifecycle')
  const dateFlag = flags['date']
  const rel = createNote(dir, config.notes, {
    lifecycle,
    class: requireFlag(flags, 'class'),
    title: requireFlag(flags, 'title'),
    ...(dateFlag !== undefined ? { date: requireFlag(flags, 'date') } : {}),
  })
  io.stdout(`created ${rel}`)
  return 0
}

function cmdNoteArchive(flags: Record<string, string | boolean>, positionals: string[], io: CliIo): number {
  assertOnlyFlags(flags, ['dir', 'config'], 'note archive')
  const rel = positionals[0]
  if (rel === undefined) throw new Error('note archive: a note path is required')
  const dir = requireDir(flags)
  const config = loadConfigFor(dir, flags)
  io.stdout(`archived ${rel} -> ${archiveNote(dir, rel, config.notes)}`)
  return 0
}

function parseRatchetRules(config: KitConfig, idFilter: string) {
  const rules = parseRules(config.gates['ratchet'] ?? {})
  if (idFilter === 'all') return rules
  const rule = rules.find((r) => r.id === idFilter)
  if (rule === undefined) {
    throw new Error(`unknown ratchet rule ${JSON.stringify(idFilter)} (known: ${rules.map((r) => r.id).join(', ') || 'none configured'})`)
  }
  return [rule]
}

function cmdRatchetVerify(flags: Record<string, string | boolean>, io: CliIo): number {
  assertOnlyFlags(flags, ['config', 'dir'], 'ratchet verify')
  const dir = requireDir(flags)
  const config = loadConfigFor(dir, flags)
  const { results } = runRatchetVerify(dir, parseRules(config.gates['ratchet'] ?? {}))
  let bad = false
  for (const { rule, diff } of results) {
    for (const hit of diff.added) {
      bad = true
      io.stderr(`✗ ${rule.id}: ${hit.file}:${hit.line}: new forbidden-pattern hit: ${hit.preview}`)
    }
    if (diff.stale.length > 0) {
      bad = true
      io.stderr(`✗ ${rule.id}: baseline holds ${diff.stale.length} vanished occurrence(s); run \`anti-shishan ratchet update ${rule.id}\``)
    }
  }
  if (!bad) io.stdout('ratchet baselines hold')
  return bad ? 1 : 0
}

function cmdRatchetUpdate(flags: Record<string, string | boolean>, positionals: string[], io: CliIo): number {
  assertOnlyFlags(flags, ['config', 'dir'], 'ratchet update')
  const id = positionals[0]
  if (id === undefined) throw new Error('ratchet update: a rule id (or `all`) is required')
  const dir = requireDir(flags)
  const config = loadConfigFor(dir, flags)
  for (const update of runRatchetUpdate(dir, parseRatchetRules(config, id))) {
    io.stdout(`${update.rule.id}: +${update.added} -${update.removed} =${update.total} (${update.rule.baseline})`)
  }
  return 0
}

function version(): string {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version?: string }
  /* v8 ignore next 1 -- package.json always ships a version; the fallback exists for the optional type */
  return pkg.version ?? '0.0.0'
}

/**
 * Run the CLI. @param argv arguments after `anti-shishan`; @returns exit code
 * (0 success, 1 failure/user error, 2 usage without command).
 */
export async function main(argv: string[], io: CliIo): Promise<number> {
  try {
    const { command, subcommand, positionals, flags } = parseArgs(argv)
    if (flags['version'] === true) {
      io.stdout(version())
      return 0
    }
    if (flags['help'] === true) {
      io.stdout(HELP)
      return 0
    }
    switch (command) {
      case 'init':
        return cmdInit(flags, io)
      case 'check':
        return await cmdCheck(flags, io)
      case 'note':
        if (subcommand === 'new') return cmdNoteNew(flags, io)
        if (subcommand === 'archive') return cmdNoteArchive(flags, positionals, io)
        throw new Error(`note: unknown subcommand ${JSON.stringify(subcommand ?? '')} (known: new, archive)`)
      case 'ratchet':
        if (subcommand === 'verify') return cmdRatchetVerify(flags, io)
        if (subcommand === 'update') return cmdRatchetUpdate(flags, positionals, io)
        throw new Error(`ratchet: unknown subcommand ${JSON.stringify(subcommand ?? '')} (known: verify, update)`)
      case undefined: {
        io.stderr(HELP)
        return 2
      }
      default:
        throw new Error(`unknown command ${JSON.stringify(command)} (known: init, check, note, ratchet)`)
    }
  } catch (error) {
    io.stderr(`error: ${(error as Error).message}`)
    return 1
  }
}

/* v8 ignore start -- process-entry wrapper: exercised by e2e against dist/, not by unit specs */
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await main(process.argv.slice(2), {
    stdout: (line) => console.log(line),
    stderr: (line) => console.error(line),
  })
  process.exitCode = exitCode
}
/* v8 ignore stop */
