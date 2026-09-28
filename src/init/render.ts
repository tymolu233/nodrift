/**
 * Init-time placeholder rendering: substitute the tokens the constitution
 * template reserves with values detected from the target repository (`npm
 * test` etc. when the target's package.json declares the matching script).
 * Undetected tokens are left as `<...>` placeholders for the user to fill —
 * detection never invents commands.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Tokens this renderer understands; unknown `<...>` tokens pass through untouched. */
export const DETECTION_TOKENS = {
  '<test command>': { script: 'test', command: 'npm test' },
  '<build command>': { script: 'build', command: 'npm run build' },
  '<lint command>': { script: 'lint', command: 'npm run lint' },
} as const

export interface RenderContext {
  /** token -> replacement; only tokens with detected values appear */
  replacements: Record<string, string>
}

/**
 * Build a render context from the target repository: for every known token,
 * include a replacement only when the target's package.json declares the
 * backing script. A missing or unparsable package.json yields an empty
 * context (placeholders are simply kept).
 */
export function detectRenderContext(targetDir: string): RenderContext {
  const packageJson = join(targetDir, 'package.json')
  if (!existsSync(packageJson)) return { replacements: {} }
  let scripts: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(readFileSync(packageJson, 'utf8')) as { scripts?: Record<string, unknown> }
    scripts = parsed.scripts ?? {}
  } catch {
    return { replacements: {} }
  }
  const replacements: Record<string, string> = {}
  for (const [token, { script, command }] of Object.entries(DETECTION_TOKENS)) {
    if (typeof scripts[script] === 'string') replacements[token] = command
  }
  return { replacements }
}

/**
 * Apply replacements to template file content. Tokens without a detected
 * value stay verbatim so the file remains a fill-in-the-blank template.
 */
export function renderContent(content: string, context: RenderContext): string {
  let out = content
  for (const [token, replacement] of Object.entries(context.replacements)) {
    out = out.replaceAll(token, replacement)
  }
  return out
}
