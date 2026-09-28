/**
 * Built-in gate registry and the enabled-set resolution policy.
 *
 * Policy: a gate runs only when it has a section in nodrift.yml and that
 * section does not say `enabled: false` — explicit opt-in, mirroring the
 * scaffolded config which lists every gate. Unknown gate ids in the config
 * fail loud at resolution time; `--only` may narrow the enabled set but
 * cannot activate a gate the config does not enable.
 */
import type { Gate, KitConfig } from '../core/types.js'
import { docBudgetsGate } from './doc-budgets.js'
import { mdLinksGate } from './md-links.js'
import { mdWrapGate } from './md-wrap.js'
import { noteArchiveSealGate } from './note-archive-seal.js'
import { noteClassificationGate } from './note-classification.js'
import { noteFormatGate } from './note-format.js'
import { ratchetGate } from './ratchet.js'

/** Every built-in gate, in default execution order (cheap structural checks first). */
export const BUILTIN_GATES: readonly Gate[] = [
  mdWrapGate,
  mdLinksGate,
  docBudgetsGate,
  noteClassificationGate,
  noteFormatGate,
  noteArchiveSealGate,
  ratchetGate,
]

function registryIds(): string[] {
  return BUILTIN_GATES.map((gate) => gate.id)
}

/**
 * Resolve which gates to run.
 *
 * @param config normalized nodrift.yml
 * @param only optional `--only` id list; every id must name an enabled gate
 * @returns enabled gates in registry order
 * @throws Error listing unknown config gate ids, or any `--only` id that is
 *   unknown or not enabled
 */
export function resolveGates(config: KitConfig, only?: string[]): Gate[] {
  const unknown = Object.keys(config.gates).filter((id) => !registryIds().includes(id))
  if (unknown.length > 0) {
    throw new Error(
      `nodrift.yml: unknown gate id(s) ${unknown.map((id) => JSON.stringify(id)).join(', ')} (known: ${registryIds().join(', ')})`,
    )
  }
  const enabled = BUILTIN_GATES.filter((gate) => {
    const section = config.gates[gate.id]
    return section !== undefined && section.enabled !== false
  })
  if (only === undefined) return enabled
  const enabledIds = new Set(enabled.map((gate) => gate.id))
  const rejected = only.filter((id) => !enabledIds.has(id))
  if (rejected.length > 0) {
    throw new Error(
      `--only: gate(s) ${rejected.map((id) => JSON.stringify(id)).join(', ')} are not enabled in nodrift.yml ` +
        `(enabled: ${[...enabledIds].join(', ') || 'none'})`,
    )
  }
  return enabled.filter((gate) => only.includes(gate.id))
}
