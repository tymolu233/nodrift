/**
 * Zero-dependency argv parsing for anti-shishan. Two leading words form the
 * command/subcommand pair (`anti-shishan note new` → command `note`, subcommand
 * `new`); flags are `--key value`, `--key=value`, or booleans from a fixed
 * allowlist so a value is never swallowed from the next command word.
 */

/** Flags that never take a value; everything else consumes the next token. */
export const BOOLEAN_FLAGS = new Set(['force', 'fail-fast', 'list', 'help', 'version'])

export interface ParsedArgs {
  command: string | undefined
  subcommand: string | undefined
  positionals: string[]
  flags: Record<string, string | boolean>
}

/**
 * Parse raw argv (already shell-split, without node/script prefix).
 * Unknown flags are accepted here and rejected by the command handlers that
 * know their own flag sets — keeping the parser dumb and the errors local.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = []
  const flags: Record<string, string | boolean> = {}
  let i = 0
  while (i < argv.length) {
    const token = argv[i]
    /* v8 ignore next 1 -- noUncheckedIndexedAccess guard: the while condition bounds i, so token is never undefined */
    if (token === undefined) break
    if (token.startsWith('--')) {
      const eq = token.indexOf('=')
      if (eq !== -1) {
        flags[token.slice(2, eq)] = token.slice(eq + 1)
        i += 1
        continue
      }
      const key = token.slice(2)
      if (BOOLEAN_FLAGS.has(key)) {
        flags[key] = true
        i += 1
        continue
      }
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) {
        flags[key] = true
        i += 1
        continue
      }
      flags[key] = value
      i += 2
      continue
    }
    positionals.push(token)
    i += 1
  }
  return {
    command: positionals[0],
    subcommand: positionals[1],
    positionals: positionals.slice(2),
    flags,
  }
}

/** Read a required string flag or throw with the flag name. */
export function requireFlag(flags: Record<string, string | boolean>, name: string): string {
  const value = flags[name]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`--${name} is required`)
  }
  return value
}
