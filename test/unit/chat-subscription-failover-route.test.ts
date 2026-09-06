import { describe, expect, it } from 'vitest'
import type { ChatProviderInfo } from '../../src/shared/chat'
import {
  addFallback,
  availableCandidates,
  emptyFailoverRoute,
  moveFallbackDown,
  moveFallbackUp,
  removeFallback,
  routeForPrimary,
  withEnabled,
} from '../../src/renderer/components/chat/subscription-failover-route'

const PRIMARY = 'builtin_codex_subscription'
const ACC_A = 'builtin_codex_subscription@acc_a'
const ACC_B = 'builtin_codex_subscription@acc_b'

const providers: ChatProviderInfo[] = [
  {
    id: PRIMARY,
    name: 'Codex',
    baseURL: 'codex://x',
    apiKeyPresent: false,
    connected: true,
    kind: 'codex-subscription',
  },
  {
    id: ACC_A,
    name: 'Codex — Work',
    baseURL: 'codex://x',
    apiKeyPresent: false,
    connected: false,
    kind: 'codex-subscription',
    accountId: 'acc_a',
    accountLabel: 'Work',
  },
  {
    id: ACC_B,
    name: 'Codex — Home',
    baseURL: 'codex://x',
    apiKeyPresent: false,
    connected: true,
    kind: 'codex-subscription',
    accountId: 'acc_b',
    accountLabel: 'Home',
  },
  {
    id: 'builtin_claude_subscription',
    name: 'Claude',
    baseURL: 'claude://x',
    apiKeyPresent: false,
    connected: true,
    kind: 'claude-subscription',
  },
]

describe('subscription-failover-route helpers', () => {
  it('routeForPrimary falls back to empty disabled route', () => {
    expect(routeForPrimary([], PRIMARY)).toEqual(emptyFailoverRoute(PRIMARY))
  })

  it('availableCandidates excludes self, duplicates, and other providers', () => {
    expect(
      availableCandidates({
        primaryProviderId: PRIMARY,
        fallbackProviderIds: [ACC_A],
        providers,
        defaultLabel: 'Default Codex',
      })
    ).toEqual([{ providerId: ACC_B, label: 'Home', connected: true }])
  })

  it('add/remove/move transform the ordered fallback list', () => {
    let route = emptyFailoverRoute(PRIMARY)
    route = addFallback(route, ACC_A)
    route = addFallback(route, ACC_B)
    route = addFallback(route, ACC_A) // duplicate no-op
    route = addFallback(route, 'builtin_claude_subscription') // other provider no-op
    expect(route.fallbackProviderIds).toEqual([ACC_A, ACC_B])

    route = moveFallbackDown(route, 0)
    expect(route.fallbackProviderIds).toEqual([ACC_B, ACC_A])
    route = moveFallbackUp(route, 1)
    expect(route.fallbackProviderIds).toEqual([ACC_A, ACC_B])

    route = removeFallback(route, ACC_A)
    expect(route.fallbackProviderIds).toEqual([ACC_B])
    expect(withEnabled(route, true).enabled).toBe(true)
  })
})
