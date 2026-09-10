import { beforeEach, afterEach, expect, it } from 'vitest'
import { freshDb, closeDb } from '../helpers/db'
import { makeWorkspace, makeConversation } from '../helpers/factories'
import { observeChatHost, emitChatHost } from '../../src/main/chat/host-events'
import {
  registerRemoteChatPolicy,
  assertRemoteChatPermission,
  withRemoteChatPolicy,
} from '../../src/main/chat/remote-policy'
import { PermissionBroker, YOLO_RULESET } from '../../src/main/chat/permission'
import { ProjectChatProjection } from '../../src/main/platform/project-chat-projection'
import { autonomousProviderAllowed } from '../../src/main/chat/autonomous'
import type { ChatPayload } from '@maestrly/protocol'
beforeEach(freshDb)
afterEach(closeDb)
it('uses one-operation approvals despite local YOLO rules and retains the provider ceiling in callbacks', async () => {
  const ws = makeWorkspace(),
    conv = makeConversation(ws.id, { cwd: '/tmp/chat' })
  const policy = {
    conversationId: conv.id,
    cwd: conv.cwd,
    mode: 'agent' as const,
    providerIds: ['allowed'],
    allowCommands: true,
    allowWeb: false,
    allowAppTools: true,
    allowMcp: false,
    allowPush: false,
  }
  const release = registerRemoteChatPolicy(policy)
  try {
    const broker = new PermissionBroker({ rulesetFor: () => YOLO_RULESET })
    const result = broker.assertDecision({
      conversationId: conv.id,
      projectId: ws.id,
      action: 'bash',
      resources: ['echo hello'],
    })
    const [request] = broker.pendingFor(conv.id)
    expect(request).toBeTruthy()
    expect(() => broker.reply({ requestId: request.id, reply: 'always' })).toThrow(/one operation/)
    broker.reply({ requestId: request.id, reply: 'once' })
    expect(await result).toBe('once')
    expect(() =>
      assertRemoteChatPermission({ ...policy, mode: 'chat' }, { action: 'edit', resources: ['file.ts'] })
    ).toThrow(/read-only/)
    expect(() => assertRemoteChatPermission(policy, { action: 'read', resources: ['../other-project'] })).toThrow(
      /outside/
    )
    expect(withRemoteChatPolicy(policy, () => autonomousProviderAllowed('other'))).toBe(false)
  } finally {
    release()
  }
})
it('projects text and interactions without a renderer and excludes raw reasoning', () => {
  const sessionId = crypto.randomUUID(),
    turnId = crypto.randomUUID(),
    out: ChatPayload[] = []
  const projection = new ProjectChatProjection(sessionId, turnId, (e) => out.push(e))
  const detach = observeChatHost('local', (e) => projection.receive(e))
  emitChatHost('local', 'chat:delta:local', { kind: 'message-start', messageId: 'native-id', createdAt: Date.now() })
  emitChatHost('local', 'chat:delta:local', {
    kind: 'text-delta',
    messageId: 'native-id',
    partId: 'text',
    delta: 'Visible',
  })
  emitChatHost('local', 'chat:delta:local', {
    kind: 'reasoning-delta',
    messageId: 'native-id',
    partId: 'internal',
    delta: 'Private raw reasoning',
  })
  emitChatHost('local', 'question', {
    toolCallId: 'question',
    questions: [{ question: 'Which branch?', options: [{ label: 'main' }] }],
  })
  expect(out.map((e) => e.type)).toEqual(['message', 'delta', 'interaction'])
  expect(JSON.stringify(out)).not.toContain('Private raw reasoning')
  emitChatHost('local','chat:public-summary',{messageId:'native-id',partId:'summary',delta:'Public progress summary'})
  expect(out.at(-1)).toMatchObject({type:'delta',kind:'reasoning',delta:'Public progress summary'})
  emitChatHost('local', 'chat:delta:local', {
    kind: 'text-delta',
    messageId: 'native-id',
    partId: 'text',
    delta: ' sk-',
  })
  emitChatHost('local', 'chat:delta:local', {
    kind: 'text-delta',
    messageId: 'native-id',
    partId: 'text',
    delta: 'credential-secret',
  })
  expect(JSON.stringify(out)).not.toContain('credential-secret')
  const count = out.length
  detach()
  emitChatHost('local', 'plan:received', { version: 1, plan: 'ignored' })
  expect(out).toHaveLength(count)
})
