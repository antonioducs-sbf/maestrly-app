import { expect, it } from 'vitest'
import { chatDecisionSchema, chatInventorySchema, projectChatMessageSchema } from '../src/project-chat.js'
it('rejects remote global permission and internal messages', () => {
  expect(chatDecisionSchema.safeParse({ type: 'permission', reply: 'always' }).success).toBe(false)
  expect(
    projectChatMessageSchema.safeParse({
      id: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      turnId: null,
      role: 'system',
      parts: [],
      createdAt: new Date().toISOString(),
    }).success
  ).toBe(false)
  expect(chatInventorySchema.safeParse({ capability: 'executor:codex', enabled: true }).success).toBe(false)
})
