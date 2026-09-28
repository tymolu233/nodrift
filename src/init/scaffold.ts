/**
 * `anti-shishan init` scaffolding: releases the embedded template set into a
 * target repository, rendering known placeholders from detected target facts
 * (`<test command>` → `npm test` when its package.json declares the script).
 *
 * Template contents ship inside the binary (generated at build time from
 * templates/, which stays the gate-policed source of truth in the repo), so
 * init never resolves a templates directory next to dist/ at runtime.
 *
 * Existing files are never touched without `--force`; `anti-shishan.yml`
 * stays user-owned even under `--force` and is reported as `configPreserved`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { CONFIG_FILE_NAME } from '../core/config.js'
import { TEMPLATES } from '../generated/embedded-templates.js'
import { detectRenderContext, renderContent } from './render.js'

export interface ScaffoldPlan {
  created: string[]
  skipped: string[]
  overwritten: string[]
  /** True when `--force` was given but the config file was deliberately preserved. */
  configPreserved: boolean
}

export interface ScaffoldOptions {
  targetDir: string
  force?: boolean
  /**
   * Template map override `{path: content}` — tests inject fixtures here;
   * production defaults to the embedded snapshot generated from templates/.
   */
  templates?: Record<string, string>
}

/**
 * Release template files into targetDir and return the plan describing what
 * happened to each file (already-released files are idempotently skipped).
 * Rendered files compare against the rendered form, so a repo re-scaffolded
 * after gaining a package.json reads "different" rather than "already installed".
 */
export function scaffold(options: ScaffoldOptions): ScaffoldPlan {
  const templates = options.templates ?? TEMPLATES
  const context = detectRenderContext(options.targetDir)
  const plan: ScaffoldPlan = { created: [], skipped: [], overwritten: [], configPreserved: false }
  for (const [rel, raw] of Object.entries(templates)) {
    const content = renderContent(raw, context)
    const target = join(options.targetDir, rel)
    if (existsSync(target)) {
      const same = readFileSync(target, 'utf8') === content
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
        writeFileSync(target, content)
        plan.overwritten.push(rel)
        continue
      }
      plan.skipped.push(rel)
      continue
    }
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content)
    plan.created.push(rel)
  }
  return plan
}
