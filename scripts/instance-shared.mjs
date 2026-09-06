import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const INSTANCE_LOCK_FILE = '.agents-instance.lock'
export const DEV_USER_DATA_BASE = 'maestrly-app-dev'

export const INSTANCE_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,31}$/

export function appDataRoot() {
  const home = os.homedir()
  switch (process.platform) {
    case 'darwin':
      return path.join(home, 'Library/Application Support')
    case 'win32':
      return process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
    default:
      return process.env.XDG_CONFIG_HOME || path.join(home, '.config')
  }
}

export function devUserDataDir(instanceId) {
  const base = DEV_USER_DATA_BASE
  const name = instanceId ? `${base}-${instanceId}` : base
  return path.join(appDataRoot(), name)
}

export function displayPath(absPath) {
  const home = os.homedir()
  return absPath.startsWith(home) ? `~${absPath.slice(home.length)}` : absPath
}

export function generateAutoInstanceId() {
  const hex = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, '0')
  return `auto-${hex}`
}

export function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function readInstanceLock(userDataDir) {
  const lockPath = path.join(userDataDir, INSTANCE_LOCK_FILE)
  if (!existsSync(lockPath)) return null
  try {
    const data = JSON.parse(readFileSync(lockPath, 'utf8'))
    if (typeof data?.pid !== 'number' || typeof data?.instance !== 'string') return null
    return data
  } catch {
    return null
  }
}

export function clearStaleLock(userDataDir) {
  const lock = readInstanceLock(userDataDir)
  if (!lock) return null
  if (isPidAlive(lock.pid)) return lock
  try {
    unlinkSync(path.join(userDataDir, INSTANCE_LOCK_FILE))
  } catch {
    /* ignore */
  }
  return null
}

export function validateInstanceId(id) {
  if (!INSTANCE_ID_RE.test(id)) {
    throw new Error(
      `Invalid instance ID: "${id}". Use letters, numbers, and hyphens (maximum 32; do not start with a hyphen).`
    )
  }
}
