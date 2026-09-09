import { resolveClaude } from '../chat/claude-agent-sdk/resolve-claude'
import { resolveCodexRuntime } from '../chat/codex-subscription/runtime-resolver'
import { readyRuntimeAsset } from '../runtime-assets/app-service'
import path from 'node:path'
import os from 'node:os'
import { app } from 'electron'
import { HttpTransport } from '@maestrly/client-sdk'
import {
  ClaudeAgentExecutor,
  CodexExecutor,
  RunnerEngine,
  RunnerJournal,
  WorkspaceManager,
  RuntimeCatalog,
  ContainerCommandRunner,
  inspectRepositories,
  type ApprovedRepository,
  type ExecutorAdapter,
  type DeliveryArtifact,
  type ExecutionArtifact,
  type RunnerClaim,
  type RunnerServer,
} from '@maestrly/runner-core'
import type { EmbeddedRunnerView } from '../../shared/platform'
import { getWorkspace } from '../store'
import { secureGet, secureSet, secureRemove } from '../secure-store'
import { platformConnections } from './connection-service'
import { platformProjectBindings } from './project-bindings'

interface MachineIdentity {
  organizationId: string
  ownerUserId: string
  runnerId: string
  credential: string
}

class DesktopRunnerServer implements RunnerServer {
  private readonly transport: HttpTransport
  constructor(
    url: string,
    private readonly identity: MachineIdentity,
    private readonly repositories: ApprovedRepository[],
    private readonly catalog: RuntimeCatalog
  ) {
    this.transport = new HttpTransport({ baseUrl: url })
  }
  private headers() {
    return {
      authorization: `Runner ${this.identity.credential}`,
      'x-maestrly-organization-id': this.identity.organizationId,
      'x-maestrly-runner-id': this.identity.runnerId,
    }
  }
  async claim(): Promise<RunnerClaim | null> {
    const claim = await this.transport.request<RunnerClaim | null>('POST', '/api/v1/runners/claim', {
      body: {
        repositories: await inspectRepositories(this.repositories),
        automationCapabilities: await this.catalog.read(),
      },
      headers: this.headers(),
    })
    if (
      claim &&
      (claim.envelope.organizationId !== this.identity.organizationId ||
        claim.envelope.snapshot.personalDevice?.deviceId !== this.identity.runnerId ||
        claim.envelope.snapshot.personalDevice?.ownerUserId !== this.identity.ownerUserId)
    )
      throw new Error('This computer accepts only personal executions requested by its owner.')
    return claim
  }
  presence(online: boolean) {
    return this.transport.request<{ enabled: boolean }>('POST', '/api/v1/personal-devices/presence', {
      body: { online },
      headers: this.headers(),
      signal: AbortSignal.timeout(5000),
    })
  }
  renew(runId: string, leaseId: string) {
    return this.transport.request<{ leaseExpiresAt: string; cancellationRequested: boolean }>(
      'POST',
      `/api/v1/runners/runs/${runId}/lease`,
      { body: { leaseId }, headers: this.headers() }
    )
  }
  event(
    runId: string,
    leaseId: string,
    event: { eventId: string; type: string; data: Record<string, unknown> }
  ): Promise<void> {
    return this.transport.request('POST', `/api/v1/runners/runs/${runId}/events`, {
      body: { leaseId, ...event },
      headers: this.headers(),
    })
  }
  complete(runId: string, leaseId: string, completion: Record<string, unknown>): Promise<void> {
    return this.transport.request('POST', `/api/v1/runners/runs/${runId}/complete`, {
      body: { leaseId, completion },
      headers: this.headers(),
    })
  }
  uploadArtifact(runId: string, leaseId: string, artifact: ExecutionArtifact): Promise<DeliveryArtifact> {
    return this.transport.request('POST', `/api/v1/runners/runs/${runId}/artifacts`, {
      body: {
        leaseId,
        kind: artifact.kind,
        name: artifact.name,
        contentType: artifact.contentType,
        contentBase64: Buffer.from(artifact.bytes).toString('base64'),
      },
      headers: this.headers(),
    })
  }
  async reconcile(run: { runId: string; leaseId: string }): Promise<'active' | 'terminal' | 'unknown'> {
    try {
      const result = await this.transport.request<{ state: string }>(
        'GET',
        `/api/v1/runners/runs/${run.runId}/status?leaseId=${encodeURIComponent(run.leaseId)}`,
        { headers: this.headers() }
      )
      return ['claimed', 'running', 'cancelling'].includes(result.state) ? 'active' : 'terminal'
    } catch {
      return 'unknown'
    }
  }
}

export class EmbeddedRunnerHost {
  private revision = 0
  private server: DesktopRunnerServer | null = null
  private heartbeat: ReturnType<typeof setInterval> | null = null
  private pinging = false
  private engine: RunnerEngine | null = null
  private state: EmbeddedRunnerView = { state: 'stopped' }
  private stopping = false
  private loop: Promise<void> | null = null
  private readonly memoryIdentities = new Map<string, MachineIdentity>()
  status(): EmbeddedRunnerView {
    return { ...this.state }
  }

  async start(connectionId: string): Promise<EmbeddedRunnerView> {
    if (this.state.state === 'error' && this.engine) await this.stop()
    if (this.engine || this.state.state === 'starting') return this.status()
    const revision = ++this.revision
    this.state = { state: 'starting' }
    try {
      const connection = platformConnections.list().find((item) => item.id === connectionId)
      const humanToken = platformConnections.token(connectionId)
      if (!connection || !humanToken) throw new Error('Connect to the platform before enabling the embedded runner.')
      const connectionBindings = platformProjectBindings.list().filter((item) => item.connectionId === connectionId)
      const binding = connectionBindings.at(-1)
      if (!binding) throw new Error('Bind a remote project to a local workspace before enabling this machine.')
      const bindings = connectionBindings.filter((item) => item.organizationId === binding.organizationId)
      const projectIds = [...new Set(bindings.map((item) => item.projectId))].sort()
      const repositories: ApprovedRepository[] = []
      for (const item of bindings) {
        if (!item.repositoryBindingId) continue
        const workspace = getWorkspace(item.workspaceId)
        if (!workspace) throw new Error('The bound local workspace no longer exists.')
        const prior = repositories.find((repo) => repo.bindingId === item.repositoryBindingId)
        if (prior && prior.localPath !== workspace.path)
          throw new Error('A repository binding must identify one local checkout on this runner.')
        if (!prior) repositories.push({ bindingId: item.repositoryBindingId, localPath: workspace.path })
      }
      const manager = new WorkspaceManager({ repositories, isolated: true })
      const inventory = await manager.inventory()
      if (inventory.some((r) => !r.available))
        throw new Error('The bound repository has no available committed branch. Check the local workspace.')
      const human = new HttpTransport({
        baseUrl: connection.url,
        authentication: { headers: () => ({ authorization: `Bearer ${humanToken}` }) },
      })
      const owner = await human.request<{ userId: string }>('GET', '/api/v1/me')
      if (!owner?.userId) throw new Error('Sign in to the platform before enabling personal execution.')
      const identityKey = `platform.personal-device.v1.${connection.id}.${owner.userId}.${binding.organizationId}`
      let identity: MachineIdentity | null = this.memoryIdentities.get(identityKey) ?? null
      try {
        const stored = secureGet(identityKey)
        if (stored) identity = JSON.parse(stored) as MachineIdentity
      } catch {
        /* Use an explicit enrollment when no protected identity exists. */
      }
      if (identity?.ownerUserId !== owner.userId) identity = null
      try {
        const enrolled = await human.request<{ runnerId: string; credential?: string; ownerUserId: string }>(
          'POST',
          '/api/v1/personal-devices',
          {
            body: {
              organizationId: binding.organizationId,
              projectIds,
              name: os.hostname().slice(0, 160),
              ...(identity ? { deviceId: identity.runnerId } : {}),
            },
            idempotencyKey: crypto.randomUUID(),
          }
        )
        if (enrolled.ownerUserId !== owner.userId)
          throw new Error('Personal device owner did not match the signed-in account.')
        identity = {
          organizationId: binding.organizationId,
          runnerId: enrolled.runnerId,
          ownerUserId: owner.userId,
          credential: enrolled.credential ?? identity?.credential ?? '',
        }
        if (!identity.credential) throw new Error('Personal device credential is missing.')
      } catch (error) {
        if ((error as { status?: number }).status === 403) {
          secureRemove(identityKey)
          this.memoryIdentities.delete(identityKey)
        }
        throw error
      }
      if (!secureSet(identityKey, JSON.stringify(identity))) this.memoryIdentities.set(identityKey, identity)
      let codexExecutable: string | undefined
      try {
        codexExecutable = (
          app.isPackaged
            ? resolveCodexRuntime({ managedAssetPath: (await readyRuntimeAsset('codex-runtime')).path })
            : resolveCodexRuntime()
        ).executablePath
      } catch {
        /* Catalog will report an unavailable executor. */
      }
      const commandRunner = new ContainerCommandRunner(
        process.env.MAESTRLY_COMMAND_IMAGE ?? 'maestrly/runner-executor:local'
      )
      const claudeExecutable=resolveClaude()
      const catalog = new RuntimeCatalog({
        claudeExecutable,
        codexExecutable,
        environment: {
          ...(process.env.OPENAI_API_KEY ? { OPENAI_API_KEY: process.env.OPENAI_API_KEY } : {}),
          ...(process.env.ANTHROPIC_API_KEY ? { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY } : {}),
        },
        preCommandsAvailable: () => commandRunner.available(),
      })
      const executors = new Map<string, ExecutorAdapter>([
        [
          'codex',
          new CodexExecutor({
            executable: codexExecutable,
            extraEnvironment: process.env.OPENAI_API_KEY ? { OPENAI_API_KEY: process.env.OPENAI_API_KEY } : {},
          }),
        ],
        [
          'claude-agent',
          new ClaudeAgentExecutor({
            executable:claudeExecutable,
            environment: process.env.ANTHROPIC_API_KEY ? { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY } : {},
          }),
        ],
      ])
      const server = new DesktopRunnerServer(connection.url, identity, repositories, catalog)
      if (revision !== this.revision) {
        await server.presence(false).catch(() => {})
        return this.status()
      }
      this.server = server
      const engine = new RunnerEngine(
        server,
        executors,
        manager,
        new RunnerJournal(path.join(app.getPath('userData'), `platform-personal-${identity.runnerId}-journal.json`)),
        { commandRunner }
      )
      await engine.recover()
      if (revision !== this.revision) {
        await server.presence(false).catch(() => {})
        return this.status()
      }
      this.engine = engine
      this.stopping = false
      this.state = this.memoryIdentities.has(identityKey)
        ? {
            state: 'running',
            deviceId: identity.runnerId,
            ownerUserId: owner.userId,
            error: 'Device identity is held in memory only because secure storage is unavailable.',
          }
        : { state: 'running', deviceId: identity.runnerId, ownerUserId: owner.userId }
      this.heartbeat = setInterval(() => {
        if (this.pinging || this.stopping) return
        this.pinging = true
        void server
          .presence(true)
          .then((result) => {
            if (!result.enabled) {
              this.stopping = true
              this.state = { state: 'error', error: 'Personal execution was disabled.' }
              if (this.heartbeat) clearInterval(this.heartbeat)
              void engine.stop('Personal execution was disabled.')
            }
          })
          .catch((error) => {
            if ([401, 403].includes((error as { status: number }).status)) {
              this.stopping = true
              this.state = { state: 'error', error: 'Personal device was revoked.' }
              if (this.heartbeat) clearInterval(this.heartbeat)
              void engine.stop('Personal device was revoked.')
            }
          })
          .finally(() => {
            this.pinging = false
          })
      }, 15000)
      this.loop = this.runLoop(engine)
    } catch (error) {
      if (revision === this.revision)
        this.state = { state: 'error', error: error instanceof Error ? error.message : String(error) }
    }
    return this.status()
  }

  private async runLoop(engine: RunnerEngine): Promise<void> {
    try {
      while (!this.stopping) {
        let worked: boolean
        try {
          worked = await engine.runOnce()
        } catch (error) {
          const status = (error as { status?: number }).status
          if (!(error instanceof TypeError) && status !== 408 && status !== 429 && !(status && status >= 500))
            throw error
          if (this.stopping) break
          await new Promise((resolve) => setTimeout(resolve, 2000))
          continue
        }
        if (!worked) await new Promise((resolve) => setTimeout(resolve, 2_000))
      }
    } catch (error) {
      if (!this.stopping) this.state = { state: 'error', error: error instanceof Error ? error.message : String(error) }
      if (this.heartbeat) clearInterval(this.heartbeat)
    }
  }

  async stop(): Promise<void> {
    this.revision++
    if (this.heartbeat) clearInterval(this.heartbeat)
    this.heartbeat = null
    const server = this.server
    this.server = null
    const offline = server?.presence(false).catch(() => {})
    if (!this.engine) {
      await offline
      this.state = { state: 'stopped' }
      return
    }
    this.state = { state: 'stopping' }
    this.stopping = true
    await this.engine.stop('Desktop application is closing.')
    await this.loop
    await offline
    this.engine = null
    this.loop = null
    this.state = { state: 'stopped' }
  }
}

export const embeddedRunnerHost = new EmbeddedRunnerHost()
