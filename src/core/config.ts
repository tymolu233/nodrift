/**
 * govkit.yml loading, defaults, and validation.
 *
 * Misconfiguration fails loud at load: unknown top-level keys, wrong types,
 * and unknown note classes are errors, never silent skips. Unknown gate ids
 * are caught by the runner (which owns the registry), not here.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import type { GovkitConfig, NotesConfig } from './types.js'

/** Default note classes, mirroring the deepseek-harness taxonomy. */
export const DEFAULT_NOTE_CLASSES = [
  'feature',
  'bug-fix',
  'simplification',
  'architecture',
  'process',
  'testing',
] as const

/** Default notes tree root, repo-relative. */
export const DEFAULT_NOTES_ROOT = '.agents/notes'

/** Default config file name searched at the repository root. */
export const CONFIG_FILE_NAME = 'govkit.yml'

/** Raised for every config problem; `message` must say what to fix. */
export class ConfigError extends Error {}

function fail(message: string): never {
  throw new ConfigError(message)
}

function record(value: unknown, where: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${where} must be a mapping`)
  }
  return value as Record<string, unknown>
}

function parseNotes(raw: unknown): NotesConfig {
  const notes: NotesConfig = {
    root: DEFAULT_NOTES_ROOT,
    classes: [...DEFAULT_NOTE_CLASSES],
  }
  if (raw === undefined) return notes
  const value = record(raw, 'notes')
  for (const key of Object.keys(value)) {
    if (key !== 'root' && key !== 'classes') {
      fail(`notes.${key} is not a known key (known: root, classes)`)
    }
  }
  if (value['root'] !== undefined) {
    if (typeof value['root'] !== 'string' || value['root'].length === 0) {
      fail('notes.root must be a non-empty string')
    }
    notes.root = value['root']
  }
  if (value['classes'] !== undefined) {
    if (!Array.isArray(value['classes']) || value['classes'].some((c) => typeof c !== 'string' || c.length === 0)) {
      fail('notes.classes must be a list of non-empty strings')
    }
    notes.classes = value['classes'] as string[]
  }
  return notes
}

function parseGates(raw: unknown): Record<string, GovkitConfig['gates'][string]> {
  if (raw === undefined) return {}
  const value = record(raw, 'gates')
  for (const [id, section] of Object.entries(value)) {
    if (typeof section === 'boolean') {
      value[id] = { enabled: section }
      continue
    }
    record(section, `gates.${id}`)
  }
  return value as GovkitConfig['gates']
}

/**
 * Load and validate govkit.yml under `repoRoot`. Throws ConfigError naming the
 * offending key on any problem; a missing file is also a ConfigError (callers
 * that tolerate absence check `existsSync` first or catch).
 *
 * @param repoRoot absolute repository root
 * @param configPath optional explicit config file path (overrides the default search)
 * @returns normalized configuration with defaults applied
 */
export function loadConfig(repoRoot: string, configPath?: string): GovkitConfig {
  const file = configPath ?? join(repoRoot, CONFIG_FILE_NAME)
  if (!existsSync(file)) {
    fail(`config file not found: ${file} (run \`govkit init\` to create one)`)
  }
  let parsed: unknown
  try {
    parsed = parse(readFileSync(file, 'utf8'))
  } catch (error) {
    fail(`config file ${file} is not valid YAML: ${(error as Error).message}`)
  }
  const root = record(parsed, 'govkit.yml')
  for (const key of Object.keys(root)) {
    if (key !== 'version' && key !== 'notes' && key !== 'gates') {
      fail(`govkit.yml: ${key} is not a known top-level key (known: version, notes, gates)`)
    }
  }
  if (root['version'] !== undefined && root['version'] !== 1) {
    fail('govkit.yml: version must be 1 (this govkit only understands version 1)')
  }
  return {
    notes: parseNotes(root['notes']),
    gates: parseGates(root['gates']),
  }
}
