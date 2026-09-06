import { readFile } from 'node:fs/promises'
import process from 'node:process'

const checks = [
  ['policy', 'src/shared/memory-policy.ts', 'MEMORY_AUTO_RECLAIM_KEY'],
  ['reclaimer', 'src/main/performance/memory-reclaimer.ts', 'runMemoryReclaim'],
  ['artifacts', 'src/main/chat/attachment-artifacts.ts', 'MAX_ATTACHMENT_IMAGE_BYTES'],
  ['workers', 'src/main/asr-service.ts', 'WORKER_IDLE_TTL_MS'],
  ['pixels', 'src/main/browser-control.ts', 'SCREENSHOT_MAX_PIXELS'],
]
const results = []
for (const [name, file, marker] of checks) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8')
  results.push({ name, ok: source.includes(marker) })
}
const report = { platform: process.platform, arch: process.arch, node: process.version, results }
console.log(JSON.stringify(report, null, 2))
if (results.some((result) => !result.ok)) process.exitCode = 1
