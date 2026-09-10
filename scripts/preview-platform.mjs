#!/usr/bin/env node
/**
 * Local design-preview stack: throwaway Postgres container, API, built web app and a seeded project.
 * Prints the URL and credentials, then keeps running until Ctrl+C. Nothing here is production.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

const root = await mkdtemp(path.join(os.tmpdir(), 'maestrly-preview-'))
const container = 'maestrly-preview-' + process.pid
const children = []
const pgPassword = randomBytes(16).toString('hex')
const runtimePassword = randomBytes(16).toString('hex')
const userPassword = process.env.PREVIEW_PASSWORD || 'preview-' + randomBytes(6).toString('hex')
const email = 'owner@example.test'
let started = false

function command(executable, args, env = process.env, capture = false) {
  const result = spawnSync(executable, args, { env, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${executable} ${args[0]} exited ${result.status}`)
  return result.stdout?.trim()
}
async function port() {
  const server = createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const value = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return value
}
async function ready(url) {
  for (let attempt = 0; attempt < 120; attempt++) {
    try { if ((await fetch(url)).ok) return } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Not ready: ' + url)
}
function start(executable, args, env) {
  const child = spawn(executable, args, { env, stdio: ['ignore', 'inherit', 'inherit'], detached: process.platform !== 'win32' })
  children.push(child)
  return child
}
function stop() {
  for (const child of children) { try { process.kill(-child.pid, 'SIGTERM') } catch {} }
  if (started) spawnSync('docker', ['stop', container], { stdio: 'ignore' })
  rm(root, { recursive: true, force: true }).finally(() => process.exit(0))
}

try {
  if (!process.env.PREVIEW_SKIP_BUILD) command('npm', ['run', 'build:web'])
  command('docker', ['run', '--rm', '-d', '--name', container, '-e', `POSTGRES_PASSWORD=${pgPassword}`, '-e', 'POSTGRES_DB=maestrly', '-p', '127.0.0.1::5432', 'postgres:17-alpine'], process.env, true)
  started = true
  for (let attempt = 0; attempt < 100; attempt++) {
    if (spawnSync('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'maestrly'], { stdio: 'ignore' }).status === 0) break
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  const pgPort = command('docker', ['port', container, '5432/tcp'], process.env, true).split(':').at(-1)
  command('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'maestrly', '-v', 'ON_ERROR_STOP=1', '-c', `create role maestrly_runtime login password '${runtimePassword}' nosuperuser nobypassrls;`], process.env, true)
  const apiPort = Number(process.env.PREVIEW_API_PORT) || (await port())
  const webPort = Number(process.env.PREVIEW_WEB_PORT) || (await port())
  const apiUrl = `http://127.0.0.1:${apiPort}`, webUrl = `http://127.0.0.1:${webPort}`
  const env = {
    ...process.env, OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '', NODE_ENV: 'test', HOST: '127.0.0.1', PORT: String(apiPort), LOG_LEVEL: 'warn',
    DATABASE_URL: `postgres://maestrly_runtime:${runtimePassword}@127.0.0.1:${pgPort}/maestrly`,
    MIGRATION_DATABASE_URL: `postgres://postgres:${pgPassword}@127.0.0.1:${pgPort}/maestrly`,
    BETTER_AUTH_SECRET: randomBytes(32).toString('hex'), MAESTRLY_CANONICAL_URL: apiUrl, MAESTRLY_WEB_ORIGIN: webUrl,
    MAESTRLY_SERVER_URL: apiUrl, MAESTRLY_STORAGE_DIR: path.join(root, 'attachments'),
    MAESTRLY_BOOTSTRAP_EMAIL: email, MAESTRLY_BOOTSTRAP_PASSWORD: userPassword,
  }
  command(process.execPath, ['--import', 'tsx', 'apps/server/src/db/migrate.ts'], env)
  command(process.execPath, ['--import', 'tsx', 'apps/server/src/modules/auth/bootstrap.ts'], env)
  start(process.execPath, ['--import', 'tsx', 'apps/server/src/main.ts'], env)
  start('npm', ['exec', '--workspace', '@maestrly/web', '--', 'vite', 'preview', '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], env)
  await ready(apiUrl + '/api/v1/health/ready'); await ready(webUrl)

  // ---- Seed through the public API, exactly like the browser would. ----
  let cookie = ''
  const call = async (method, url, body) => {
    const response = await fetch(apiUrl + url, {
      method, headers: { 'content-type': 'application/json', 'x-maestrly-protocol-version': '1.0', 'idempotency-key': randomBytes(8).toString('hex'), cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const set = response.headers.getSetCookie?.() ?? []
    if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ')
    if (!response.ok) throw new Error(`${method} ${url} → ${response.status} ${await response.text()}`)
    return response.status === 204 ? null : response.json()
  }
  await call('POST', '/api/auth/sign-in/email', { email, password: userPassword })
  const [org] = await call('GET', '/api/v1/organizations')
  const O = `/api/v1/organizations/${org.id}`
  const { boardId } = await call('POST', `${O}/projects`, { name: 'Launch control', description: 'Website relaunch: content, build, review and release.' })
  const board = await call('GET', `${O}/boards/${boardId}`)
  const columnsByName = () => call('GET', `${O}/boards/${boardId}`).then((s) => new Map(s.columns.map((c) => [c.name, c])))
  let cols = await columnsByName()
  for (const name of ['Ready', 'Build', 'Review']) {
    if (cols.has(name)) continue
    const snap = await call('GET', `${O}/boards/${boardId}`)
    await call('POST', `${O}/boards/${boardId}/columns/manage`, { expectedVersion: snap.board.version, action: 'create', name })
    cols = await columnsByName()
  }
  const names = [...cols.keys()]
  const pick = (want, fallback) => cols.get(want)?.id ?? cols.get(names[fallback])?.id
  const seed = [
    ['Write launch announcement', pick('Ready', 0), 'high', ['content']],
    ['Migrate pricing page to new layout', pick('Build', 1), 'urgent', ['frontend', 'design']],
    ['Add OpenGraph images for docs', pick('Build', 1), 'medium', ['docs']],
    ['Verify release evidence', pick('Review', 2), 'high', ['release']],
    ['Refresh changelog for 2.4', pick('Ready', 0), 'low', []],
    ['Audit third-party fonts license', pick(names[0], 0), 'medium', ['legal']],
    ['Rotate staging credentials', pick(names[0], 0), 'none', ['ops']],
    ['Ship accessibility pass on forms', pick(names.at(-1), names.length - 1), 'medium', ['a11y']],
  ]
  for (const [title, columnId, priority, labels] of seed) {
    const created = await call('POST', `${O}/boards/${boardId}/cards`, { columnId, title, description: `## Goal\n\nMake **${title.toLowerCase()}** land before the launch window.\n\n- Owner reviews evidence\n- Agent proposes the change\n` })
    const card = created.card ?? created
    await call('PATCH', `${O}/cards/${card.id}`, { expectedVersion: card.version, priority, labels })
  }
  const parent = await call('POST', `${O}/boards/${boardId}/cards`, { columnId: pick('Build', 1), title: 'Rebuild navigation component', description: '' })
  for (const sub of ['Extract menu primitives', 'Keyboard navigation', 'Mobile drawer']) {
    await call('POST', `${O}/boards/${boardId}/cards`, { columnId: pick('Build', 1), title: sub, description: '', parentCardId: (parent.card ?? parent).id })
  }
  console.log('\n──────────────────────────────────────────')
  console.log(`Preview:  ${webUrl}`)
  console.log(`API:      ${apiUrl}`)
  console.log(`Login:    ${email}  /  ${userPassword}`)
  console.log(`Board:    ${board.board.name} (${names.length} columns)`)
  console.log('Ctrl+C stops everything and removes the container.')
  console.log('──────────────────────────────────────────\n')
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop)
  await new Promise(() => {})
} catch (error) {
  console.error(error)
  stop()
}
