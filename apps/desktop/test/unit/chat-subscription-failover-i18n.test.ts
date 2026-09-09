import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import en from '../../src/shared/i18n/en/chat'
import pt from '../../src/shared/i18n/pt-BR/chat'

const chatViewSource = readFileSync(new URL('../../src/renderer/components/chat/ChatView.tsx', import.meta.url), 'utf8')
const messageListSource = readFileSync(
  new URL('../../src/renderer/components/chat/ChatMessageList.tsx', import.meta.url),
  'utf8'
)

const KEYS = [
  'automaticRotation',
  'automaticRotationDescription',
  'addFallbackAccount',
  'moveFallbackUp',
  'moveFallbackDown',
  'removeFallback',
  'fallbackDisconnectedWarning',
  'accountsExhaustedError',
  'failoverSwitchStatus',
] as const

describe('subscription failover i18n', () => {
  it('keeps settings keys in both locales', () => {
    for (const key of KEYS) {
      expect(typeof en.settings[key]).toBe('string')
      expect(en.settings[key].length).toBeGreaterThan(0)
      expect(typeof pt.settings[key]).toBe('string')
      expect(pt.settings[key].length).toBeGreaterThan(0)
    }
    expect(en.settings.failoverSwitchStatus).toContain('{{from}}')
    expect(pt.settings.failoverSwitchStatus).toContain('{{to}}')
    expect(en.messages.accountsExhaustedError.length).toBeGreaterThan(0)
    expect(pt.messages.accountsExhaustedError.length).toBeGreaterThan(0)
  })

  it('uses the same localized exhaustion message for admission errors and stream errors', () => {
    expect(chatViewSource).toMatch(
      /error === 'codex-accounts-exhausted'\s*\n\s*\? t\('messages\.accountsExhaustedError'\)/
    )
    expect(messageListSource).toContain("message.errorCode === 'codex-accounts-exhausted'")
    expect(messageListSource).toContain("t('messages.accountsExhaustedError')")
  })
})
