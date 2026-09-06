import { describe, expect, it } from 'vitest'
import {
  buildClaudeChatQueryOptions,
  buildClaudeCompactionQueryOptions,
  resolveClaudeEffort,
} from '../../src/main/chat/claude-agent-sdk/options'

function bridge() {
  return {
    server: { type: 'sdk', name: 'maestrly' },
    allowedTools: ['mcp__maestrly__read'],
    toolAliases: { mcp__maestrly__read: 'read' },
    preToolUseHook: async () => ({ continue: true }),
  } as never
}

describe('Claude Agent SDK query options', () => {
  it('keeps the Maestrly-only tool surface locked down', () => {
    const abortController = new AbortController()
    const options = buildClaudeChatQueryOptions({
      abortController,
      cwd: '/project',
      modelId: 'claude-opus',
      reasoningEffort: 'xhigh',
      fastMode: true,
      systemPrompt: 'Maestrly system prompt',
      bridge: bridge(),
      disallowedNativeTools: ['Bash', 'Read'],
      resume: 'session-1',
      resumeSessionAt: 'assistant-1',
      forkSession: true,
    })

    expect(options).toMatchObject({
      abortController,
      cwd: '/project',
      model: 'claude-opus',
      effort: 'xhigh',
      settingSources: [],
      strictMcpConfig: true,
      tools: [],
      allowedTools: ['mcp__maestrly__read'],
      disallowedTools: ['Bash', 'Read'],
      skills: [],
      plugins: [],
      agents: {},
      permissionMode: 'dontAsk',
      includePartialMessages: true,
      persistSession: true,
      resume: 'session-1',
      resumeSessionAt: 'assistant-1',
      forkSession: true,
    })
    expect(options.env).toBeUndefined()
    // The interactive chat has no turn cap: the user's Stop button is the guard.
    expect(options.maxTurns).toBeUndefined()
    expect(options.mcpServers).toEqual({ maestrly: expect.any(Object) })
    expect(options.settings).toMatchObject({
      fastMode: true,
      fastModePerSessionOptIn: true,
      promptSuggestionEnabled: false,
      autoMemoryEnabled: false,
      autoCompactEnabled: false,
      precomputeCompactionEnabled: false,
    })
  })

  it('rejects unknown effort values', () => {
    expect(resolveClaudeEffort('invalid')).toBeUndefined()
    expect(resolveClaudeEffort('off')).toBeUndefined()
    expect(resolveClaudeEffort('high')).toBe('high')
  })

  it('builds a minimal native compaction query', () => {
    const options = buildClaudeCompactionQueryOptions({
      abortController: new AbortController(),
      cwd: '/project',
      modelId: 'claude-sonnet',
      sessionId: 'session-1',
      disallowedNativeTools: ['Bash'],
    })

    expect(options).toMatchObject({
      cwd: '/project',
      model: 'claude-sonnet',
      resume: 'session-1',
      strictMcpConfig: true,
      mcpServers: {},
      tools: [],
      allowedTools: [],
      disallowedTools: ['Bash'],
      includePartialMessages: false,
    })
    expect(options.persistSession).toBeUndefined()
  })
})
