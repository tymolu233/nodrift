import { describe, expect, it } from 'vitest'
import { parseArgs, requireFlag } from '../../src/cli/args.js'

describe('parseArgs', () => {
  it('splits command, subcommand, and positionals', () => {
    const parsed = parseArgs(['note', 'archive', '.agents/notes/implemented/feature/2026-09-28-x.md'])
    expect(parsed.command).toBe('note')
    expect(parsed.subcommand).toBe('archive')
    expect(parsed.positionals).toEqual(['.agents/notes/implemented/feature/2026-09-28-x.md'])
  })

  it('keeps later tokens as positionals when no subcommand exists', () => {
    const parsed = parseArgs(['check', 'extra'])
    expect(parsed.command).toBe('check')
    expect(parsed.subcommand).toBe('extra')
    expect(parsed.positionals).toEqual([])
  })

  it('parses value flags, = form, and booleans', () => {
    const parsed = parseArgs(['init', '--level', '2', '--dir=/tmp/x', '--force'])
    expect(parsed.flags).toEqual({ level: '2', dir: '/tmp/x', force: true })
  })

  it('treats a value flag followed by another flag or end of input as boolean', () => {
    const parsed = parseArgs(['check', '--config', '--fail-fast', '--only'])
    expect(parsed.flags['config']).toBe(true)
    expect(parsed.flags['fail-fast']).toBe(true)
    expect(parsed.flags['only']).toBe(true)
    expect(parsed.command).toBe('check')
  })

  it('returns undefined command on empty argv', () => {
    expect(parseArgs([]).command).toBeUndefined()
  })
})

describe('requireFlag', () => {
  it('returns string values and rejects missing, boolean, or empty flags', () => {
    expect(requireFlag({ title: 'hello' }, 'title')).toBe('hello')
    expect(() => requireFlag({}, 'title')).toThrow('--title is required')
    expect(() => requireFlag({ title: true }, 'title')).toThrow('--title is required')
    expect(() => requireFlag({ title: '' }, 'title')).toThrow('--title is required')
  })
})
