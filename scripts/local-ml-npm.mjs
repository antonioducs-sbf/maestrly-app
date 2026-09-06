import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

function pathApiFor(platform) {
  return platform === 'win32' ? path.win32 : path.posix
}

export const LOCAL_ML_INSTALL_STAMP = '.local-ml-install.json'

export function npmCliCandidates({
  platform = process.platform,
  execPath = process.execPath,
  npmExecPath = process.env.npm_execpath,
} = {}) {
  const pathApi = pathApiFor(platform)
  const candidates = []

  if (npmExecPath && pathApi.extname(npmExecPath).toLowerCase() === '.js') candidates.push(npmExecPath)

  const execDirectory = pathApi.dirname(execPath)
  candidates.push(
    pathApi.resolve(execDirectory, 'node_modules/npm/bin/npm-cli.js'),
    pathApi.resolve(execDirectory, '../lib/node_modules/npm/bin/npm-cli.js')
  )

  return [...new Set(candidates)]
}

export function resolveNpmCli({
  platform = process.platform,
  execPath = process.execPath,
  npmExecPath = process.env.npm_execpath,
  exists = existsSync,
} = {}) {
  const candidates = npmCliCandidates({ platform, execPath, npmExecPath })
  const resolved = candidates.find((candidate) => exists(candidate))
  if (resolved) return resolved

  throw new Error(`Could not resolve npm CLI JS; candidates=${candidates.join(', ')}`)
}

export function installLocalMlDependencies({
  cwd,
  sourcePackage,
  targetPlatform = process.platform,
  targetArch = process.arch,
  resolveNpm = resolveNpmCli,
  exists = existsSync,
  spawn = spawnSync,
}) {
  const npmCli = resolveNpm()
  const install = spawn(process.execPath, [npmCli, 'ci', '--omit=dev'], {
    cwd,
    env: {
      ...process.env,
      // Native install scripts honor these values. This lets the pinned dependency closure be
      // materialized for win32-x64 on an Apple Silicon release host.
      npm_config_platform: targetPlatform,
      npm_config_arch: targetArch,
      // npm's platform-filtered optional packages (including modern Sharp binaries) use os/cpu.
      npm_config_os: targetPlatform,
      npm_config_cpu: targetArch,
    },
    stdio: 'inherit',
    shell: false,
  })
  const spawnError = install.error ? `${install.error.name ?? 'Error'}: ${install.error.message}` : 'none'
  const status = install.status ?? 'null'
  const sourcePackagePresent = exists(sourcePackage)

  if (install.error || install.status !== 0 || !sourcePackagePresent) {
    throw new Error(
      `Could not materialize the pinned build-time local ML dependency closure (spawn error=${spawnError}; status=${status}; source package=${sourcePackagePresent ? 'present' : 'missing'})`
    )
  }

  return install
}

function lockfileSha256(lockfilePath, readFile = readFileSync) {
  return createHash('sha256').update(readFile(lockfilePath)).digest('hex')
}

function readInstallStamp(stampPath, readFile = readFileSync) {
  try {
    return JSON.parse(readFile(stampPath, 'utf8'))
  } catch {
    return null
  }
}

export function ensureLocalMlDependencies({
  cwd,
  sourcePackage,
  installTarget,
  targetPlatform = process.platform,
  targetArch = process.arch,
  lockfilePath = path.join(cwd, 'package-lock.json'),
  stampPath = path.join(cwd, 'node_modules', LOCAL_ML_INSTALL_STAMP),
  resolveNpm = resolveNpmCli,
  exists = existsSync,
  spawn = spawnSync,
  readFile = readFileSync,
  remove = rmSync,
  writeFile = writeFileSync,
}) {
  const expected = {
    schema: 2,
    installTarget,
    lockfileSha256: lockfileSha256(lockfilePath, readFile),
  }
  const cached = readInstallStamp(stampPath, readFile)
  const cacheValid =
    exists(sourcePackage) &&
    cached?.schema === expected.schema &&
    cached?.installTarget === expected.installTarget &&
    cached?.lockfileSha256 === expected.lockfileSha256

  if (cacheValid) return { installed: false, ...expected }

  // npm ci also cleans its own cwd, but remove the stale closure explicitly so a
  // cache produced on another host/target cannot be consulted before npm runs.
  remove(path.join(cwd, 'node_modules'), { recursive: true, force: true })
  installLocalMlDependencies({
    cwd,
    sourcePackage,
    targetPlatform,
    targetArch,
    resolveNpm,
    exists,
    spawn,
  })
  writeFile(stampPath, `${JSON.stringify(expected)}\n`)
  return { installed: true, ...expected }
}
