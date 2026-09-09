import type { ChatProviderInfo, ChatSubscriptionFailoverRoute } from '../../../shared/chat'
import { subscriptionBaseProviderId } from '../../../shared/chat'

const CODEX_BASE = 'builtin_codex_subscription'

function isCodexProviderId(providerId: string): boolean {
  return subscriptionBaseProviderId(providerId) === CODEX_BASE
}

/** Candidate account for a failover dropdown (excludes self / duplicates / other providers). */
export interface FailoverRouteCandidate {
  providerId: string
  label: string
  connected: boolean
}

export function emptyFailoverRoute(primaryProviderId: string): ChatSubscriptionFailoverRoute {
  return {
    primaryProviderId,
    enabled: false,
    fallbackProviderIds: [],
  }
}

export function routeForPrimary(
  routes: readonly ChatSubscriptionFailoverRoute[],
  primaryProviderId: string
): ChatSubscriptionFailoverRoute {
  return routes.find((route) => route.primaryProviderId === primaryProviderId) ?? emptyFailoverRoute(primaryProviderId)
}

export function availableCandidates(args: {
  primaryProviderId: string
  fallbackProviderIds: readonly string[]
  providers: readonly ChatProviderInfo[]
  defaultLabel: string
}): FailoverRouteCandidate[] {
  const base = subscriptionBaseProviderId(args.primaryProviderId)
  const excluded = new Set<string>([args.primaryProviderId, ...args.fallbackProviderIds])
  const out: FailoverRouteCandidate[] = []
  for (const provider of args.providers) {
    if (provider.kind !== 'codex-subscription' && !isCodexProviderId(provider.id)) continue
    if (subscriptionBaseProviderId(provider.id) !== base) continue
    if (excluded.has(provider.id)) continue
    out.push({
      providerId: provider.id,
      label: provider.accountId ? provider.accountLabel?.trim() || provider.accountId : args.defaultLabel,
      connected: provider.connected ?? provider.apiKeyPresent,
    })
  }
  return out
}

export function addFallback(
  route: ChatSubscriptionFailoverRoute,
  fallbackProviderId: string
): ChatSubscriptionFailoverRoute {
  const id = fallbackProviderId.trim()
  if (!id || id === route.primaryProviderId) return route
  if (!isCodexProviderId(id)) return route
  if (subscriptionBaseProviderId(id) !== subscriptionBaseProviderId(route.primaryProviderId)) return route
  if (route.fallbackProviderIds.includes(id)) return route
  return { ...route, fallbackProviderIds: [...route.fallbackProviderIds, id] }
}

export function removeFallback(
  route: ChatSubscriptionFailoverRoute,
  fallbackProviderId: string
): ChatSubscriptionFailoverRoute {
  return {
    ...route,
    fallbackProviderIds: route.fallbackProviderIds.filter((id) => id !== fallbackProviderId),
  }
}

export function moveFallbackUp(route: ChatSubscriptionFailoverRoute, index: number): ChatSubscriptionFailoverRoute {
  if (index <= 0 || index >= route.fallbackProviderIds.length) return route
  const next = [...route.fallbackProviderIds]
  ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
  return { ...route, fallbackProviderIds: next }
}

export function moveFallbackDown(route: ChatSubscriptionFailoverRoute, index: number): ChatSubscriptionFailoverRoute {
  if (index < 0 || index >= route.fallbackProviderIds.length - 1) return route
  const next = [...route.fallbackProviderIds]
  ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
  return { ...route, fallbackProviderIds: next }
}

export function withEnabled(route: ChatSubscriptionFailoverRoute, enabled: boolean): ChatSubscriptionFailoverRoute {
  return { ...route, enabled }
}

/** Display label for a Codex provider id given the chat config providers list. */
export function labelForCodexProvider(
  providerId: string,
  providers: readonly ChatProviderInfo[],
  defaultLabel: string
): string {
  const provider = providers.find((entry) => entry.id === providerId)
  if (!provider) return providerId
  if (provider.accountId) return provider.accountLabel?.trim() || provider.accountId
  return defaultLabel
}
