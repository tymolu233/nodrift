/**
 * Gate runner: executes resolved gates sequentially in registry order, stamps
 * gate ids onto violations, synthesizes corpus-shortfall failures, and
 * supports fail-fast. Harness/flaky-bridge semantics (parallelism, process
 * isolation) are roadmap items; sequential order keeps reports deterministic.
 */
import type { Gate, GateResult, GovkitConfig, Violation } from '../core/types.js'

/** Outcome of running one gate, including crashes and corpus shortfalls. */
export interface GateRun {
  gate: Gate
  violations: Violation[]
  admitted: number
  error?: Error
}

export interface RunOptions {
  repoRoot: string
  /** Final gate list, already filtered for enabled/--only by the caller. */
  gates: Gate[]
  config: GovkitConfig
  failFast?: boolean
}

export interface RunSummary {
  runs: GateRun[]
  failed: boolean
}

/**
 * Run each gate and collect results. A gate that throws is a failed gate
 * (its error is reported, never swallowed); remaining gates still run unless
 * failFast is set.
 *
 * @returns summary whose `failed` is true when any gate produced violations,
 *          crashed, or admitted fewer files than its `minCorpus`
 */
export async function runGates(options: RunOptions): Promise<RunSummary> {
  const runs: GateRun[] = []
  let failed = false
  for (const gate of options.gates) {
    const run: GateRun = { gate, violations: [], admitted: 0 }
    runs.push(run)
    try {
      const result: GateResult = await gate.run({
        repoRoot: options.repoRoot,
        options: options.config.gates[gate.id] ?? {},
        config: options.config,
      })
      run.violations = result.violations.map((v) => ({ ...v, gate: gate.id }))
      run.admitted = result.corpus.admitted
      const min = gate.minCorpus ?? 1
      if (run.admitted < min) {
        run.violations.push({
          gate: gate.id,
          message: `admitted ${run.admitted} file(s), below minCorpus ${min}; discovery may have silently narrowed`,
        })
      }
    } catch (error) {
      run.error = error as Error
    }
    if (run.violations.length > 0 || run.error !== undefined) {
      failed = true
      if (options.failFast) break
    }
  }
  return { runs, failed }
}
