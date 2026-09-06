#!/usr/bin/env node
import { createReadStream } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { createGunzip } from 'node:zlib'
import tar from 'tar-stream'

const hostOs = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'win' : process.platform
const archive =
  process.argv[2] ??
  path.join('runtime-assets', 'local-ml', 'archives', `local-ml-runtime-2.17.2-1-${hostOs}-${process.arch}.tar.gz`)
const temporary = await mkdtemp(path.join(os.tmpdir(), 'local-ml-smoke-'))
try {
  const extract = tar.extract()
  extract.on('entry', (header, stream, next) => {
    const parts = header.name.split('/')
    if (path.isAbsolute(header.name) || parts.some((part) => !part || part === '..')) {
      extract.destroy(new Error(`Unsafe archive entry: ${header.name}`))
      return
    }
    const output = path.join(temporary, ...parts)
    void mkdir(path.dirname(output), { recursive: true })
      .then(async () => {
        const chunks = []
        for await (const chunk of stream) chunks.push(chunk)
        await writeFile(output, Buffer.concat(chunks), { mode: header.mode })
        next()
      })
      .catch((error) => extract.destroy(error))
  })
  const done = new Promise((resolve, reject) => extract.once('finish', resolve).once('error', reject))
  createReadStream(path.resolve(archive)).pipe(createGunzip()).pipe(extract)
  await done
  const runtime = await import(pathToFileURL(path.join(temporary, 'runtime.mjs')).href)
  if (typeof runtime.pipeline !== 'function' || !runtime.env)
    throw new Error('Runtime entry does not export pipeline/env')
  const requireFromRuntime = createRequire(pathToFileURL(path.join(temporary, 'runtime.mjs')))
  const ort = requireFromRuntime('onnxruntime-node')
  if (typeof ort.InferenceSession?.create !== 'function')
    throw new Error('onnxruntime-node native binding did not load')
  const sharp = requireFromRuntime('sharp')
  const pixel = await sharp({ create: { width: 1, height: 1, channels: 4, background: '#000' } })
    .png()
    .toBuffer()
  if (pixel.length === 0) throw new Error('sharp native smoke returned an empty image')
  console.log(`[smoke-local-ml-runtime] ok: ${path.resolve(archive)} (models remained lazy)`)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
