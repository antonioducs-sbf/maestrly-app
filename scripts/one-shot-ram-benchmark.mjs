import process from 'node:process'

const sample = (phase) => ({ phase, at: Date.now(), ...process.memoryUsage() })
const samples = [sample('baseline')]
let blocks = Array.from({ length: 32 }, () => new Uint8Array(1024 * 1024))
for (const block of blocks) block[0] = 1
samples.push(sample('32MiB-binary-live'))
blocks = []
globalThis.gc?.()
samples.push(sample('after-release'))
console.log(JSON.stringify({ platform: process.platform, arch: process.arch, node: process.version, samples }, null, 2))
