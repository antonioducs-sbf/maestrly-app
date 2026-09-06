#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createBundleSizeReport, formatBytes } from './report-bundle-size.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const defaultConfig = path.join(root, 'config', 'bundle-size-budgets.json')
const METRICS = [
  'unpackedAppBytes',
  'appAsarBytes',
  'appAsarUnpackedBytes',
  'frameworksBytes',
  'extraResourcesBytes',
  'mlAggregateBytes',
  'maxArtifactBytes',
]

function withArtifactMetric(report, item) {
  const platformExtensions =
    item.platform === 'mac' ? ['.dmg', '.zip'] : item.platform === 'win' ? ['.exe'] : ['.appimage', '.deb']
  return {
    ...item,
    maxArtifactBytes: Math.max(
      0,
      ...report.artifacts
        .filter((x) => platformExtensions.some((ext) => x.path.toLowerCase().endsWith(ext)))
        .map((x) => x.bytes)
    ),
  }
}

function budgetsForTarget(target, config) {
  if (target?.budgets && typeof target.budgets === 'object') return target.budgets
  if (target?.status === 'fallback') return config.fallbackBudgets
  return null
}

export function checkBundleSizeReport(report, config) {
  const failures = []
  const skipped = []
  for (const original of report.packages) {
    const item = withArtifactMetric(report, original)
    for (const leak of item.leakage) failures.push(`${item.id}: leakage: ${leak}`)
    const target = config.targets?.[item.id]
    const budgets = budgetsForTarget(target, config)
    if (!budgets) {
      failures.push(`${item.id}: no size budget configured; add a fallback budget or run --update-baseline`)
      continue
    }
    for (const metric of METRICS) {
      const maximum = budgets[metric]
      if (!Number.isFinite(maximum)) {
        failures.push(`${item.id}: missing finite size budget for ${metric}`)
      } else if (item[metric] > maximum) {
        failures.push(`${item.id}: ${metric} ${formatBytes(item[metric])} exceeds ${formatBytes(maximum)}`)
      }
    }
  }
  if (report.packages.length === 0) failures.push('no unpacked packaged app found')
  return { failures, skipped }
}

export function updateBaseline(report, config, onlyTarget) {
  const headroom = Number(config.baselineHeadroomPercent ?? 10)
  config.targets ??= {}
  const selected = report.packages.filter((item) => !onlyTarget || item.id === onlyTarget)
  if (selected.length === 0) throw new Error(`no packaged layout found${onlyTarget ? ` for ${onlyTarget}` : ''}`)
  for (const original of selected) {
    if (original.leakage.length > 0)
      throw new Error(`refusing baseline with leakage in ${original.id}: ${original.leakage.join(', ')}`)
    const item = withArtifactMetric(report, original)
    if (item.maxArtifactBytes === 0) throw new Error(`refusing baseline without a release artifact for ${item.id}`)
    const baseline = Object.fromEntries(METRICS.map((metric) => [metric, item[metric]]))
    const budgets = Object.fromEntries(
      METRICS.map((metric) => [metric, Math.ceil(item[metric] * (1 + headroom / 100))])
    )
    config.targets[item.id] = { status: 'measured', measuredAt: report.generatedAt, baseline, budgets }
  }
  return config
}

function parseArgs(argv) {
  const options = { input: 'dist', report: null, config: defaultConfig, update: false, target: null }
  for (const arg of argv) {
    if (arg === '--update-baseline') options.update = true
    else if (arg.startsWith('--report=')) options.report = path.resolve(root, arg.slice(9))
    else if (arg.startsWith('--config=')) options.config = path.resolve(root, arg.slice(9))
    else if (arg.startsWith('--target=')) options.target = arg.slice(9)
    else if (arg.startsWith('--')) throw new Error(`unknown flag: ${arg}`)
    else options.input = arg
  }
  return options
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  const report = options.report
    ? JSON.parse(await readFile(options.report, 'utf8'))
    : await createBundleSizeReport(path.resolve(root, options.input))
  const config = JSON.parse(await readFile(options.config, 'utf8'))
  if (options.update) {
    updateBaseline(report, config, options.target)
    await writeFile(options.config, `${JSON.stringify(config, null, 2)}\n`)
    console.log(`[bundle-size] baseline updated: ${path.relative(root, options.config)}`)
    return
  }
  const result = checkBundleSizeReport(report, config)
  for (const message of result.skipped) console.warn(`[bundle-size] SKIP ${message}`)
  if (result.failures.length) throw new Error(result.failures.join('\n'))
  console.log(`[bundle-size] budgets ok (${report.packages.length} package(s))`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[bundle-size] ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
