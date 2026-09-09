import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { createPool } from './db/pool.js'
import { createAuth } from './modules/auth/auth.js'
import { reconcileExpiredLeases } from './modules/jobs/reconcile.js'

const config = loadConfig()
const pool = createPool(config.databaseUrl)
const auth = createAuth(config, pool)
const app = await buildApp({ config, pool, auth })
const reconciler = setInterval(() => {
  void reconcileExpiredLeases(pool).catch((error) => app.log.error({ err: error }, 'lease reconciliation failed'))
}, 30_000)
reconciler.unref()

async function shutdown(signal: string) {
  app.log.info({ signal }, 'shutting down')
  clearInterval(reconciler)
  await app.close()
  await pool.end()
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void shutdown(signal) })
}

await app.listen({ host: config.host, port: config.port })
