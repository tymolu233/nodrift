import { describe, expect, it } from 'vitest'
import { AGENT_STUB_FILES, TEMPLATES } from '../../src/generated/embedded-templates.js'
import {
  AGENT_ADAPTERS,
  AGENT_IDS,
  agentAdapter,
  agentStubPrefix,
  AGENT_STUBS_PREFIX,
  resolveAgentIds,
  SKILLS_TEMPLATE_PREFIX,
  validateAgentIds,
} from '../../src/init/agents.js'

describe('AGENT_ADAPTERS registry', () => {
  it('declares the closed five-adapter set in help order with unique native targets', () => {
    expect(AGENT_IDS).toEqual(['claude', 'cursor', 'copilot', 'gemini', 'windsurf'])
    expect(new Set(AGENT_ADAPTERS.map((adapter) => adapter.target)).size).toBe(AGENT_ADAPTERS.length)
    for (const adapter of AGENT_ADAPTERS) {
      expect(adapter.target.length, adapter.id).toBeGreaterThan(0)
    }
  })

  it('only claude mirrors the skills tree', () => {
    expect(agentAdapter('claude')?.skillsMirror).toBe('.claude/skills')
    for (const id of AGENT_IDS.filter((id) => id !== 'claude')) {
      expect(agentAdapter(id)?.skillsMirror).toBeUndefined()
    }
  })

  it('every adapter ships its stub in the embedded map at agents/<id>/<target>', () => {
    expect(AGENT_STUB_FILES.length).toBe(AGENT_ADAPTERS.length)
    for (const adapter of AGENT_ADAPTERS) {
      const key = `${AGENT_STUBS_PREFIX}${adapter.id}/${adapter.target}`
      expect(AGENT_STUB_FILES, key).toContain(key)
      expect((TEMPLATES[key] ?? '').length, key).toBeGreaterThan(0)
    }
  })

  it('the canonical skills tree holds the six skills the mirror copies', () => {
    const skillKeys = Object.keys(TEMPLATES).filter((rel) => rel.startsWith(SKILLS_TEMPLATE_PREFIX))
    expect(skillKeys).toContain('.agents/skills/pre-push-checks/SKILL.md')
    expect(skillKeys.length).toBe(6)
  })

  it('lookups and prefixes stay explicit', () => {
    expect(agentAdapter('opencode')).toBeUndefined()
    expect(agentStubPrefix('cursor')).toBe('agents/cursor/')
    expect(AGENT_STUBS_PREFIX).toBe('agents/')
    expect(SKILLS_TEMPLATE_PREFIX).toBe('.agents/skills/')
  })
})

describe('resolveAgentIds precedence', () => {
  it('defaults to the generic AGENTS.md-only install', () => {
    expect(resolveAgentIds(undefined, undefined)).toEqual([])
  })

  it('reads the config selection when the flag is absent', () => {
    expect(resolveAgentIds(undefined, ['cursor'])).toEqual(['cursor'])
  })

  it('flag beats config, trims the comma list, drops empties, and dedupes', () => {
    expect(resolveAgentIds(' claude, cursor,claude,', ['gemini'])).toEqual(['claude', 'cursor'])
  })

  it('an explicit empty flag list selects no adapters', () => {
    expect(resolveAgentIds('', ['claude'])).toEqual([])
    expect(resolveAgentIds(' , ', ['claude'])).toEqual([])
  })
})

describe('validateAgentIds', () => {
  it('passes valid ids de-duplicated in first-use order', () => {
    expect(validateAgentIds(['copilot', 'copilot', 'windsurf'])).toEqual(['copilot', 'windsurf'])
    expect(validateAgentIds([])).toEqual([])
  })

  it('fails loud on unknown flag ids naming every valid id', () => {
    expect(() => resolveAgentIds('claude,wat', undefined)).toThrow(
      'unknown agent id(s) "wat" (valid: claude, cursor, copilot, gemini, windsurf)',
    )
    expect(() => resolveAgentIds('nope,nada', undefined)).toThrow(/unknown agent id\(s\) "nope", "nada"/)
  })

  it('fails loud on unknown config ids too', () => {
    expect(() => resolveAgentIds(undefined, ['gemini', 'wat'])).toThrow(/unknown agent id\(s\) "wat"/)
    expect(() => validateAgentIds(['wat'])).toThrow(/valid: claude, cursor, copilot, gemini, windsurf/)
  })
})
