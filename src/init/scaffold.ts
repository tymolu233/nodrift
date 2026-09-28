/**
 * `nodrift init` scaffolding: releases the embedded template set into a
 * target repository, rendering known placeholders from detected target facts
 * (`<test command>` → `npm test` when its package.json declares the script).
 *
 * Template contents ship inside the binary (generated at build time from
 * templates/, which stays the gate-policed source of truth in the repo), so
 * init never resolves a templates directory next to dist/ at runtime.
 *
 * Agent adapters (`--agents` / nodrift.yml `agents:`) release, after the full
 * base set, each selected adapter's stub files (`agents/<id>/<file>` →
 * `<file>`) plus the skills-tree copy any `skillsMirror` declares — same
 * exists/skip/force semantics as base files, and stubs contain no render
 * placeholders. Existing files are never touched without `--force`;
 * `nodrift.yml` stays user-owned even under `--force` and is reported as
 * `configPreserved`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { CONFIG_FILE_NAME } from '../core/config.js'
import { TEMPLATES } from '../generated/embedded-templates.js'
import { AGENT_IDS, agentAdapter, AGENT_STUBS_PREFIX, agentStubPrefix, SKILLS_TEMPLATE_PREFIX } from './agents.js'
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
   * Adapter ids to install after the base set; each must name the closed
   * registry in `init/agents` (the CLI resolves this through resolveAgentIds).
   * The default installs the generic AGENTS.md-only set.
   */
  agents?: string[]
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

  const release = (rel: string, raw: string): void => {
    const content = renderContent(raw, context)
    const target = join(options.targetDir, rel)
    if (existsSync(target)) {
      const same = readFileSync(target, 'utf8') === content
      if (same) {
        plan.skipped.push(rel)
        return
      }
      if (rel === CONFIG_FILE_NAME) {
        plan.skipped.push(rel)
        plan.configPreserved = true
        return
      }
      if (options.force === true) {
        writeFileSync(target, content)
        plan.overwritten.push(rel)
        return
      }
      plan.skipped.push(rel)
      return
    }
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content)
    plan.created.push(rel)
  }

  for (const [rel, raw] of Object.entries(templates)) {
    if (rel.startsWith(AGENT_STUBS_PREFIX)) continue
    release(rel, raw)
  }

  const agentFiles = new Map<string, string>()
  for (const id of options.agents ?? []) {
    const adapter = agentAdapter(id)
    if (adapter === undefined) {
      throw new Error(`unknown agent id ${JSON.stringify(id)} (valid: ${AGENT_IDS.join(', ')})`)
    }
    const prefix = agentStubPrefix(id)
    for (const [rel, raw] of Object.entries(templates)) {
      if (rel.startsWith(prefix)) {
        agentFiles.set(rel.slice(prefix.length), raw)
      }
    }
    const mirror = adapter.skillsMirror
    if (mirror !== undefined) {
      for (const [rel, raw] of Object.entries(templates)) {
        if (rel.startsWith(SKILLS_TEMPLATE_PREFIX)) {
          agentFiles.set(mirror + '/' + rel.slice(SKILLS_TEMPLATE_PREFIX.length), raw)
        }
      }
    }
  }
  for (const [rel, raw] of agentFiles) release(rel, raw)

  return plan
}
