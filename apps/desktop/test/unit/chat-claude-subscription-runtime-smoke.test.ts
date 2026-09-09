import { mkdtemp, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CLAUDE_AGENT_SDK_VERSION, ClaudeSubscriptionManager } from '../../src/main/chat/claude-agent-sdk/manager'
import { gatedClaudeHumanText } from '../../src/main/chat/claude-agent-sdk/user-prompt'

const temporaryDirectories: string[] = []
const managers: ClaudeSubscriptionManager[] = []

async function realManager(): Promise<ClaudeSubscriptionManager> {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'maestrly-claude-smoke-'))
  temporaryDirectories.push(userData)
  const manager = new ClaudeSubscriptionManager({ getUserDataPath: () => userData })
  managers.push(manager)
  return manager
}

afterEach(async () => {
  for (const manager of managers.splice(0)) manager.dispose()
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('Claude subscription runtime smoke', () => {
  it('probes the real CLI version and isolated auth status without starting a model turn', async () => {
    const manager = await realManager()
    const status = await manager.status({ refresh: true })

    expect(status.sdkVersion).toBe(CLAUDE_AGENT_SDK_VERSION)
    if (!status.available) {
      expect(status.state).toBe('unavailable')
      expect(status.error).toBeTruthy()
      return
    }
    expect(status.cliVersion).toMatch(/^\d+\.\d+\.\d+$/)
    expect(['ready', 'signed-out', 'error']).toContain(status.state)
    if (status.authenticated) {
      expect(status.accountFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/)
      const models = await manager.listModels()
      expect(models.length).toBeGreaterThan(0)
      await manager.deleteManagedSession(randomUUID(), process.cwd()).catch((error) => {
        expect(String(error)).toMatch(/not found|does not exist|unknown session/i)
      })
      const localLogout = await manager.logout()
      expect(localLogout.status.authenticated).toBe(false)

      const secondManager = await realManager()
      const untouchedDefaultIdentity = await secondManager.status({ refresh: true })
      expect(untouchedDefaultIdentity.authenticated).toBe(true)
      expect(untouchedDefaultIdentity.accountFingerprint).toBe(status.accountFingerprint)
    }
  })

  it.skipIf(process.env.MAESTRLY_CLAUDE_QUERY_SMOKE !== '1')(
    'completes an opt-in, tool-free query using the isolated subscription profile',
    async () => {
      const manager = await realManager()
      const status = await manager.status({ refresh: true })
      expect(status.state).toBe('ready')

      const prompt = gatedClaudeHumanText('Reply with exactly OK.')
      const session = manager.createQuery({
        prompt: prompt.prompt,
        options: {
          settingSources: [],
          strictMcpConfig: true,
          mcpServers: {},
          tools: [],
          allowedTools: [],
          disallowedTools: ['Agent', 'Task', 'Skill', 'TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskGet', 'TaskList'],
          skills: [],
          plugins: [],
          permissionMode: 'dontAsk',
          persistSession: false,
          maxTurns: 1,
          systemPrompt: 'This is an opt-in Maestrly runtime smoke test. Do not use tools.',
        },
      })
      let completed = false
      try {
        const initialized = await session.initializationResult()
        manager.assertSubscriptionRuntimeAccount(initialized.account)
        prompt.release()
        for await (const message of session) {
          if (message.type === 'result' && message.subtype === 'success') completed = true
        }
      } finally {
        prompt.reject(new Error('Smoke query closed before prompt release.'))
        session.close()
      }
      expect(completed).toBe(true)
    },
    120_000
  )
})
