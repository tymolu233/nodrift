/**
 * `anti-shishan init` scaffolding: copies template files into a target repository.
 *
 * Level semantics are incremental: `--level N` installs the union of manifest
 * lists 0..N. Existing files are never touched without `--force`; `anti-shishan.yml`
 * stays user-owned even under `--force` (it accrues local budgets and rules)
 * and is reported as `configPreserved`.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Manifest shape: level number -> repo-relative template files added at that level. */
export type TemplateManifest = Record<string, string[]>

export interface ScaffoldPlan {
  created: string[]
  skipped: string[]
  overwritten: string[]
  /** True when `--force` was given but anti-shishan.yml was deliberately preserved. */
  configPreserved: boolean
}

export interface ScaffoldOptions {
  templatesDir: string
  targetDir: string
  level: 0 | 1 | 2
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
    throw new Error(`${file} must be a mapping of level to file lists`)
  }
  for (const [level, files] of Object.entries(parsed)) {
    if (!/^\d+$/.test(level) || !Array.isArray(files) || files.some((f) => typeof f !== 'string')) {
      throw new Error(`${file}: each level must map to a list of file paths`)
    }
  }
  return parsed as TemplateManifest
}

/**
 * Resolve the ordered, de-duplicated template file list for a level.
 * Levels stack: 2 includes everything in 0 and 1.
 */
export function resolveTemplateFiles(templatesDir: string, level: 0 | 1 | 2): string[] {
  const manifest = readManifest(templatesDir)
  const files: string[] = []
  for (let n = 0; n <= level; n += 1) {
    for (const f of manifest[String(n)] ?? []) {
      if (!files.includes(f)) files.push(f)
    }
  }
  for (const f of files) {
    if (!existsSync(join(templatesDir, f))) {
      throw new Error(`manifest lists ${f} but templates/${f} does not exist`)
    }
  }
  return files
}

/**
 * Copy template files into targetDir. Returns the plan describing what
 * happened to each file (already-copied files are idempotently skipped).
 */
export function scaffold(options: ScaffoldOptions): ScaffoldPlan {
  const plan: ScaffoldPlan = { created: [], skipped: [], overwritten: [], configPreserved: false }
  for (const rel of resolveTemplateFiles(options.templatesDir, options.level)) {
    const source = join(options.templatesDir, rel)
    const target = join(options.targetDir, rel)
    if (existsSync(target)) {
      const same = readFileSync(source, 'utf8') === readFileSync(target, 'utf8')
      if (same) {
        plan.skipped.push(rel)
        continue
      }
      if (rel === 'anti-shishan.yml') {
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
