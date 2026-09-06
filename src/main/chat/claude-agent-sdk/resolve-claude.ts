import { accessSync, constants } from 'node:fs'
import { isWin, winCliCandidates, whichBin } from '../../platform'

let cached: string | null = null

function candidates(): string[] {
  return isWin
    ? winCliCandidates('claude')
    : [
        '/opt/homebrew/bin/claude',
        '/usr/local/bin/claude',
        `${process.env.HOME ?? ''}/.npm-global/bin/claude`,
        '/usr/bin/claude',
        '/snap/bin/claude',
        `${process.env.HOME ?? ''}/.local/bin/claude`,
      ]
}

/** Resolve the executable used exclusively by the Claude Agent SDK provider. */
export function resolveClaude(): string {
  if (cached) return cached
  for (const candidate of candidates()) {
    try {
      accessSync(candidate, constants.X_OK)
      cached = candidate
      return candidate
    } catch {
      // Next candidate.
    }
  }
  cached = whichBin('claude') ?? 'claude'
  return cached
}

export function clearClaudeCache(): void {
  cached = null
}
