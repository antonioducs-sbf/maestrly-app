#!/usr/bin/env node
// Optional signing preflight. Local ad-hoc packages do not need Apple credentials.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const errors = []
if (process.platform !== 'darwin') errors.push('Signed macOS packaging requires a macOS host.')
const name = process.env.CSC_NAME?.trim()
if (!name) errors.push('Set CSC_NAME to your Developer ID name and team ID.')
else if (name.startsWith('Developer ID Application:')) {
  errors.push('CSC_NAME must omit the Developer ID Application: prefix.')
}
if (!process.env.CSC_LINK && process.platform === 'darwin') {
  const result = spawnSync('security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' })
  if (result.status !== 0 || !name || !result.stdout?.includes(name)) {
    errors.push('Install the matching Developer ID certificate or set CSC_LINK and CSC_KEY_PASSWORD.')
  }
}
for (const key of ['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER']) {
  if (!process.env[key]?.trim()) errors.push(`Set ${key} for notarization.`)
}
if (process.env.APPLE_API_KEY && !existsSync(process.env.APPLE_API_KEY)) {
  errors.push('APPLE_API_KEY must point to an existing App Store Connect .p8 file.')
}
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('[preflight-mac-signing] Signing identity and notarization settings are present.')
