import { describe, expect, it } from 'vitest'
import type { ToolSet } from 'ai'
import { selectedSubagentToolNames } from '../../src/main/chat/claude-agent-sdk/task-runtime'

describe('Claude Agent SDK managed task runtime', () => {
  it('removes recursive and parent-only tools from configured subagent tools', () => {
    const selected = selectedSubagentToolNames(false, [
      'read',
      'bash',
      'task',
      'delegate',
      'review_plan',
      'ask_question',
      'todo_write',
      'use_skill',
      'generate_image',
    ])
    expect([...selected]).toEqual(['read', 'bash'])
  })

  it('delegates generate_image only with the parent host capability and a mutable child', () => {
    const provided = { generate_image: {} as never } as ToolSet
    expect(selectedSubagentToolNames(false, ['read', 'bash', 'generate_image'], provided)).toEqual(
      new Set(['read', 'bash', 'generate_image'])
    )
    expect(selectedSubagentToolNames(false, ['read', 'bash', 'generate_image'])).not.toContain('generate_image')
    expect(selectedSubagentToolNames(true, ['read', 'bash', 'generate_image'], provided)).not.toContain(
      'generate_image'
    )
  })

  it('enforces the read-only allowlist regardless of a mutating agent profile', () => {
    const selected = selectedSubagentToolNames(true, ['bash', 'write', 'edit'])
    expect(selected.has('read')).toBe(true)
    expect(selected.has('bash')).toBe(false)
    expect(selected.has('write')).toBe(false)
    expect(selected.has('task')).toBe(false)
  })
})
