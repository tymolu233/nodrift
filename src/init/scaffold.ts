/**
 * `anti-shishan init` scaffolding: copies the full template set into a target
 * repository. There is deliberately no level system — the adoption gradient
 * lives in `anti-shishan.yml` (gates are enabled/disabled per config) and in
 * deleting files you do not want, not in the installer, and a flat inventory
 * cannot manufacture level-crossing broken links.
 *
 * Existing files are never touched without `--force`; `anti-shishan.yml`
 * stays user-owned even under `--force` (it accrues local budgets and rules)
 * and is reported as `configPreserved`.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONFIG_FILE_NAME } from '../core/config.js'

/** Manifest shape: the flat inventory of repo-relative template files init manages. */
export interface TemplateManifest {
  files: string[]
}

export interface ScaffoldPlan {
  created: string[]
  skipped: string[]
  overwritten: string[]
  /** True when `--force` was given but the config file was deliberately preserved. */
  configPreserved: boolean
}

export interface ScaffoldOptions {
  templatesDir: string
  targetDir: string
  force?: boolean
}

/** The package's bundled templates directory (works from src/ and dist/). */
export function defaultTemplatesDir(): string {
  return fileURLToPath(new URL('../../templates/', import.meta.url))
}

function readManifest(templatesDir: string): TemplateManifest {
  const file = join(templatesDir, 'manifest.json')
  if (!existsSync(file)) {
    throw new Error(`template manifest not found: ${file}`)
  }
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${file} must be a mapping with a "files" list`)
  }
  const manifest = parsed as Record<string, unknown>
  if (Object.keys(manifest).some((key) => key !== 'files')) {
    throw new Error(`${file}: only the "files" key is understood`)
  }
  if (!Array.isArray(manifest['files']) || manifest['files'].some((f) => typeof f !== 'string')) {
    throw new Error(`${file}: "files" must be a list of file paths`)
  }
  return manifest as unknown as TemplateManifest
}

/**
 * Resolve the manifest's template file list, verifying every listed file
 * exists (the manifest is the reviewed inventory of what init touches).
 */
export function resolveTemplateFiles(templatesDir: string): string[] {
  const { files } = readManifest(templatesDir)
  for (const f of files) {
    if (!existsSync(join(templatesDir, f))) {
      throw new Error(`manifest lists ${f} but templates/${f} does not exist`)
    }
  }
  const seen = new Set<string>()
  for (const f of files) {
    if (seen.has(f)) throw new Error(`manifest lists ${f} twice`)
    seen.add(f)
  }
  return files
}

/**
 * Copy template files into targetDir. Returns the plan describing what
 * happened to each file (already-copied files are idempotently skipped).
 */
export function scaffold(options: ScaffoldOptions): ScaffoldPlan {
  const plan: ScaffoldPlan = { created: [], skipped: [], overwritten: [], configPreserved: false }
  for (const rel of resolveTemplateFiles(options.templatesDir)) {
    const source = join(options.templatesDir, rel)
    const target = join(options.targetDir, rel)
    if (existsSync(target)) {
      const same = readFileSync(source, 'utf8') === readFileSync(target, 'utf8')
      if (same) {
        plan.skipped.push(rel)
        continue
      }
      if (rel === CONFIG_FILE_NAME) {
        plan.skipped.push(rel)
        plan.configPreserved = true
        continue
      }
      if (options.force === true) {
        copyFileSync(source, target)
        plan.overwritten.push(rel)
        continue
      }
      plan.skipped.push(rel)
      continue
    }
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(source, target)
    plan.created.push(rel)
  }
  return plan
}
