#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listPackage, statFile } from '@electron/asar'
import { findLeanCoreLeaks } from './after-pack.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const ARTIFACT_EXTENSIONS = ['.dmg', '.zip', '.exe', '.appimage', '.deb']
const ML_PACKAGES = [/^@xenova\/transformers$/, /^onnxruntime(?:-|$)/, /^@huggingface\/transformers$/]

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—'
  const units = ['B', 'KiB', 'MiB', 'GiB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

async function sizeOf(target) {
  if (!existsSync(target)) return 0
  const info = await stat(target)
  if (!info.isDirectory()) return info.size
  let total = 0
  for (const entry of await readdir(target, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue
    total += await sizeOf(path.join(target, entry.name))
  }
  return total
}

function moduleName(entry) {
  const normalized = entry.replaceAll('\\', '/').replace(/^\/+/, '')
  const marker = 'node_modules/'
  const index = normalized.indexOf(marker)
  if (index < 0) return null
  const parts = normalized.slice(index + marker.length).split('/')
  return parts[0]?.startsWith('@') ? `${parts[0]}/${parts[1] ?? ''}` : parts[0]
}

async function diskModuleSizes(nodeModules) {
  const totals = new Map()
  if (!existsSync(nodeModules)) return totals
  for (const first of await readdir(nodeModules, { withFileTypes: true })) {
    if (!first.isDirectory()) continue
    if (first.name.startsWith('@')) {
      for (const second of await readdir(path.join(nodeModules, first.name), { withFileTypes: true })) {
        if (!second.isDirectory()) continue
        totals.set(`${first.name}/${second.name}`, await sizeOf(path.join(nodeModules, first.name, second.name)))
      }
    } else totals.set(first.name, await sizeOf(path.join(nodeModules, first.name)))
  }
  return totals
}

async function moduleSizes(resources) {
  const totals = new Map()
  const archive = path.join(resources, 'app.asar')
  if (existsSync(archive)) {
    for (const entry of listPackage(archive)) {
      const name = moduleName(entry)
      if (!name) continue
      try {
        const info = statFile(archive, path.normalize(entry).replace(/^[/\\]+/, ''), false)
        // Unpacked entries are counted from app.asar.unpacked below.
        if (!info.files && !info.unpacked) totals.set(name, (totals.get(name) ?? 0) + (info.size ?? 0))
      } catch {
        // listPackage can include synthetic directory entries; they carry no bytes.
      }
    }
  }
  const disk = await diskModuleSizes(path.join(resources, 'app.asar.unpacked', 'node_modules'))
  for (const [name, bytes] of disk) totals.set(name, (totals.get(name) ?? 0) + bytes)
  return totals
}

async function findLayouts(input) {
  const layouts = []
  if (input.endsWith('.app') && existsSync(path.join(input, 'Contents', 'Resources', 'app.asar'))) {
    return [{ appRoot: input, resources: path.join(input, 'Contents', 'Resources'), platform: 'mac' }]
  }
  if (existsSync(path.join(input, 'resources', 'app.asar'))) {
    return [
      { appRoot: input, resources: path.join(input, 'resources'), platform: input.includes('win') ? 'win' : 'linux' },
    ]
  }
  const visit = async (dir, depth = 0) => {
    if (depth > 7) return
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const full = path.join(dir, entry.name)
      if (entry.name.endsWith('.app') && existsSync(path.join(full, 'Contents', 'Resources', 'app.asar'))) {
        layouts.push({ appRoot: full, resources: path.join(full, 'Contents', 'Resources'), platform: 'mac' })
      } else if (existsSync(path.join(full, 'resources', 'app.asar'))) {
        layouts.push({
          appRoot: full,
          resources: path.join(full, 'resources'),
          platform: full.includes('win') ? 'win' : 'linux',
        })
      } else await visit(full, depth + 1)
    }
  }
  await visit(input)
  return layouts
}

function inferredArch(appRoot) {
  const normalized = appRoot.toLowerCase()
  if (normalized.includes('arm64') || normalized.includes('aarch64')) return 'arm64'
  return 'x64'
}

async function extraResources(resources) {
  const excluded = new Set(['app.asar', 'app.asar.unpacked', 'icon.icns', 'app-update.yml'])
  const entries = []
  for (const entry of await readdir(resources, { withFileTypes: true })) {
    if (excluded.has(entry.name) || entry.name.endsWith('.lproj')) continue
    entries.push({ name: entry.name, bytes: await sizeOf(path.join(resources, entry.name)) })
  }
  return entries.sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name))
}

async function artifactSizes(input) {
  const artifacts = []
  const visit = async (dir, depth = 0) => {
    if (depth > 4) return
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await visit(full, depth + 1)
      else if (entry.isFile() && ARTIFACT_EXTENSIONS.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
        artifacts.push({ path: path.relative(input, full), bytes: (await stat(full)).size })
      }
    }
  }
  await visit(input)
  return artifacts.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path))
}

export async function createBundleSizeReport(input, options = {}) {
  const absoluteInput = path.resolve(input)
  if (!existsSync(absoluteInput)) throw new Error(`bundle-size input not found: ${absoluteInput}`)
  const packages = []
  for (const layout of await findLayouts(absoluteInput)) {
    const arch = options.arch ?? inferredArch(layout.appRoot)
    const modules = await moduleSizes(layout.resources)
    const topNodeModules = [...modules].map(([name, bytes]) => ({ name, bytes })).sort((a, b) => b.bytes - a.bytes)
    const extras = await extraResources(layout.resources)
    const frameworks =
      layout.platform === 'mac'
        ? path.join(layout.appRoot, 'Contents', 'Frameworks')
        : path.join(layout.appRoot, 'frameworks')
    packages.push({
      id: `${layout.platform}-${arch}`,
      platform: layout.platform,
      arch,
      path: path.relative(absoluteInput, layout.appRoot),
      unpackedAppBytes: await sizeOf(layout.appRoot),
      appAsarBytes: await sizeOf(path.join(layout.resources, 'app.asar')),
      appAsarUnpackedBytes: await sizeOf(path.join(layout.resources, 'app.asar.unpacked')),
      frameworksBytes: await sizeOf(frameworks),
      extraResourcesBytes: extras.reduce((sum, item) => sum + item.bytes, 0),
      extraResources: extras,
      topNodeModules: topNodeModules.slice(0, options.top ?? 20),
      mlAggregateBytes: topNodeModules
        .filter((item) => ML_PACKAGES.some((pattern) => pattern.test(item.name)))
        .reduce((sum, item) => sum + item.bytes, 0),
      leakage: await findLeanCoreLeaks(layout.resources, layout.platform, arch),
    })
  }
  return {
    schema: 1,
    generatedAt: new Date().toISOString(),
    input: absoluteInput,
    packages,
    artifacts: await artifactSizes(absoluteInput),
  }
}

export function printBundleSizeReport(report, output = console.log) {
  output('Bundle size report')
  for (const item of report.packages) {
    output(`\n${item.id} (${item.path})`)
    output(`  unpacked app       ${formatBytes(item.unpackedAppBytes)}`)
    output(`  app.asar           ${formatBytes(item.appAsarBytes)}`)
    output(`  app.asar.unpacked  ${formatBytes(item.appAsarUnpackedBytes)}`)
    output(`  Frameworks         ${formatBytes(item.frameworksBytes)}`)
    output(`  extraResources     ${formatBytes(item.extraResourcesBytes)}`)
    output(`  ML aggregate       ${formatBytes(item.mlAggregateBytes)}`)
    output(`  leakage            ${item.leakage.length ? item.leakage.join('; ') : 'none'}`)
    if (item.extraResources.length)
      output(`  extraResources top ${item.extraResources.map((x) => `${x.name}=${formatBytes(x.bytes)}`).join(', ')}`)
    if (item.topNodeModules.length)
      output(`  node_modules top   ${item.topNodeModules.map((x) => `${x.name}=${formatBytes(x.bytes)}`).join(', ')}`)
  }
  if (report.artifacts.length) {
    output('\nArtifacts')
    for (const artifact of report.artifacts) output(`  ${artifact.path}  ${formatBytes(artifact.bytes)}`)
  }
}

function parseArgs(argv) {
  let input = 'dist'
  let json = null
  let arch
  let top = 20
  for (const arg of argv) {
    if (arg.startsWith('--json=')) json = arg.slice(7)
    else if (arg.startsWith('--arch=')) arch = arg.slice(7)
    else if (arg.startsWith('--top=')) top = Number(arg.slice(6))
    else if (arg.startsWith('--')) throw new Error(`unknown flag: ${arg}`)
    else input = arg
  }
  return { input, json, arch, top }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  const report = await createBundleSizeReport(path.resolve(root, options.input), options)
  printBundleSizeReport(report, (line) => console.error(line))
  if (options.json) {
    const serialized = `${JSON.stringify(report, null, 2)}\n`
    if (options.json === '-') process.stdout.write(serialized)
    else await writeFile(path.resolve(root, options.json), serialized)
  }
  return report
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[bundle-size] ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
