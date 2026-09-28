/**
 * Contract between the nodrift runner, built-in gates, and CLI commands.
 * Every collaborator codes against this file; changing it is an API review.
 */

/** One rule violation surfaced by a gate. All paths are repo-relative, forward slashes. */
export interface Violation {
  /** Id of the gate that produced the violation. */
  gate: string
  /** Repo-relative file the violation belongs to, when it has a single location. */
  file?: string
  /** 1-based line number inside `file`, when known. */
  line?: number
  /** Human-readable explanation including the remediation hint. */
  message: string
}

/**
 * Corpus accounting a gate must return so the runner can detect silent discovery
 * narrowing ("the gate went green because it found nothing to check").
 */
export interface CorpusReport {
  /** Number of files the gate admitted for checking after include/exclude filtering. */
  admitted: number
}

export interface GateResult {
  violations: Violation[]
  corpus: CorpusReport
}

export interface GateContext {
  /** Absolute path of the repository being checked. */
  repoRoot: string
  /** This gate's section of nodrift.yml, with `enabled` already handled by the runner. */
  options: Record<string, unknown>
  /** Normalized full configuration for cross-gate facts (e.g. notes root). */
  config: KitConfig
}

/**
 * A built-in gate.
 *
 * `doc` is the gate's honesty contract: it must state what a green run proves
 * AND what it does not prove. It is printed in `nodrift check --list` and in
 * failure reports, so users never mistake "checked" for "correct".
 */
export interface Gate {
  id: string
  doc: string
  /**
   * Minimum corpus size. The runner fails the gate when `corpus.admitted`
   * falls below this (default 1), regardless of violations.
   */
  minCorpus?: number
  run(ctx: GateContext): Promise<GateResult>
}

/** Notes subsystem configuration. */
export interface NotesConfig {
  /** Repo-relative root of the notes tree. Default `.agents/notes`. */
  root: string
  /** Closed set of note classes. Default: feature, bug-fix, simplification, architecture, process, testing. */
  classes: string[]
}

/** A gate's raw configuration section: `enabled` plus gate-specific keys. */
export interface GateSection {
  enabled?: boolean
  [key: string]: unknown
}

/** Normalized nodrift.yml contents. */
export interface KitConfig {
  notes: NotesConfig
  gates: Record<string, GateSection>
  /**
   * Agent-adapter ids opted into for `nodrift init` (closed set from
   * `init/agents`); the empty default means a generic AGENTS.md-only install.
   */
  agents: string[]
}
