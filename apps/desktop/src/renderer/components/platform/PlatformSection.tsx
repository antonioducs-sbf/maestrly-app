import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Link2, Server, Unplug } from 'lucide-react'
import type { DeviceAuthorizationView, PlatformConnectionView, RemotePlatformProject } from '../../../shared/platform'
import { Button } from '../ui/button'

export function PlatformSection() {
  const { i18n } = useTranslation()
  const L = (en: string, pt: string) => (i18n.language.startsWith('pt') ? pt : en)
  const [connections, setConnections] = useState<PlatformConnectionView[]>([])
  const [url, setUrl] = useState('http://127.0.0.1:14310')
  const [clientId, setClientId] = useState('')
  const [authorization, setAuthorization] = useState<DeviceAuthorizationView | null>(null)
  const [error, setError] = useState('')
  const [runner, setRunner] = useState<Awaited<ReturnType<typeof window.api.platformRunnerStatus>> | null>(null)
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string }>>([])
  const [remoteProjects, setRemoteProjects] = useState<RemotePlatformProject[]>([])
  const [workspaceId, setWorkspaceId] = useState('')
  const [remoteProjectId, setRemoteProjectId] = useState('')
  const [repositoryBindingId, setRepositoryBindingId] = useState('')
  const [cardId, setCardId] = useState('')
  const reload = () => window.api.platformListConnections().then(setConnections)
  useEffect(() => {
    void reload()
    void window.api.platformRunnerStatus().then(setRunner)
    void window.api.listWorkspaces().then((items) => {
      setWorkspaces(items)
      setWorkspaceId(items[0]?.id ?? '')
    })
  }, [])
  useEffect(() => {
    const timer = setInterval(() => void window.api.platformRunnerStatus().then(setRunner), 3000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    const connection = connections.find((item) => item.state === 'connected')
    if (!connection) {
      setRemoteProjects([])
      return
    }
    void window.api
      .platformListRemoteProjects(connection.id)
      .then((items) => {
        setRemoteProjects(items)
        setRemoteProjectId(items[0]?.projectId ?? '')
      })
      .catch(() => setRemoteProjects([]))
  }, [connections])

  useEffect(() => {
    if (!authorization) return
    let active = true,
      pending = false
    const timer = setInterval(() => {
      if (pending) return
      pending = true
      void window.api
        .platformPollDeviceAuthorization(authorization.connectionId)
        .then((result) => {
          if (active && result.state === 'connected') {
            setAuthorization(null)
            void reload()
          }
        })
        .catch((e) => {
          if (active) {
            setError(e.message)
            setAuthorization(null)
          }
        })
        .finally(() => {
          pending = false
        })
    }, authorization.interval * 1000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [authorization])
  async function add() {
    setError('')
    try {
      await window.api.platformAddConnection(url)
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }
  async function authorize(connectionId: string) {
    const connection = connections.find((c) => c.id === connectionId)
    if (!clientId.trim() && !connection?.desktopClientId) {
      setError('Enter the public OAuth client ID registered by this installation.')
      return
    }
    const pending = await window.api.platformBeginDeviceAuthorization(connectionId, clientId.trim())
    setAuthorization(pending)
    await window.api.openExternalUrl(pending.verificationUriComplete ?? pending.verificationUri)
  }
  async function poll() {
    if (!authorization) return
    const result = await window.api.platformPollDeviceAuthorization(authorization.connectionId)
    if (result.state === 'connected') setAuthorization(null)
    await reload()
  }
  async function bindProject() {
    const connection = connections.find((item) => item.state === 'connected')
    const project = remoteProjects.find((item) => item.projectId === remoteProjectId)
    const board = project?.boards[0]
    if (!connection || !project || !board || !workspaceId) {
      setError('Choose a connected project and local workspace.')
      return
    }
    await window.api.platformSetProjectBinding({
      workspaceId,
      connectionId: connection.id,
      organizationId: project.organizationId,
      projectId: project.projectId,
      boardId: board.id,
      ...(repositoryBindingId.trim() ? { repositoryBindingId: repositoryBindingId.trim() } : {}),
      ...(cardId.trim() ? { cardId: cardId.trim() } : {}),
    })
    setRunner({ state: 'stopped' })
    setError('')
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center gap-3">
        <Server className="size-5 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-semibold">Platform connections</h2>
          <p className="text-xs text-muted-foreground">
            Optional. Local conversations and tools continue to work while disconnected.
          </p>
        </div>
      </header>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          aria-label="Instance URL"
        />
        <Button onClick={() => void add()}>
          <Link2 className="size-4" /> Add instance
        </Button>
      </div>
      {!connections.some((c) => c.desktopClientId) ? (
        <input
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          placeholder="Public OAuth client ID for this instance"
          aria-label="OAuth client ID"
        />
      ) : null}
      <div className="space-y-2">
        {connections.map((connection) => (
          <article key={connection.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
            <span
              className={`size-2 rounded-full ${connection.state === 'connected' ? 'bg-emerald-500' : 'bg-muted-foreground'}`}
            />
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-sm">{connection.name}</strong>
              <span className="block truncate text-xs text-muted-foreground">
                {connection.url} · {connection.state}
                {connection.credentialPersistence === 'memory' ? ' · token held in memory only' : ''}
              </span>
            </div>
            {connection.state === 'connected' ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void window.api.platformDisconnect(connection.id).then(reload)}
                title="Disconnect"
              >
                <Unplug className="size-4" />
              </Button>
            ) : (
              <Button variant="outline" onClick={() => void authorize(connection.id)}>
                <ExternalLink className="size-4" /> Connect
              </Button>
            )}
          </article>
        ))}
      </div>
      {authorization ? (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground">Confirm this exact code in your browser</p>
          <strong className="my-2 block font-mono text-xl tracking-widest">{authorization.userCode}</strong>
          <Button onClick={() => void poll()}>I approved the code</Button>
        </div>
      ) : null}
      {remoteProjects.length > 0 ? (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <div>
            <strong className="block text-sm">Bind project to local workspace</strong>
            <span className="text-xs text-muted-foreground">
              No conversations, notes, memory, or credentials are synchronized.
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
              aria-label="Local workspace"
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={remoteProjectId}
              onChange={(event) => setRemoteProjectId(event.target.value)}
              aria-label="Remote project"
            >
              {remoteProjects.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.organizationName} · {project.projectName}
                </option>
              ))}
            </select>
            <input
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={repositoryBindingId}
              onChange={(event) => setRepositoryBindingId(event.target.value)}
              placeholder="Approved repository binding ID (optional)"
            />
            <input
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={cardId}
              onChange={(event) => setCardId(event.target.value)}
              placeholder="Card ID for board tools (optional)"
            />
          </div>
          <Button variant="outline" onClick={() => void bindProject()}>
            Bind project
          </Button>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
        <div>
          <strong className="block text-sm">
            {L('Enable personal execution on this computer', 'Habilitar execução pessoal neste computador')}
          </strong>
          <span className="text-xs text-muted-foreground">
            {L(
              'Only your explicit requests · Not part of the team runner pool',
              'Somente suas solicitações explícitas · Fora do pool da equipe'
            )}{' '}
            · {runner?.state ?? 'stopped'}
          </span>
        </div>
        {runner?.state === 'running' ? (
          <Button
            variant="outline"
            onClick={() => void window.api.platformRunnerStop().then(() => setRunner({ state: 'stopped' }))}
          >
            {L('Disable personal execution', 'Desabilitar execução pessoal')}
          </Button>
        ) : (
          <Button
            disabled={!connections.some((item) => item.state === 'connected')}
            onClick={() => {
              const connection = connections.find((item) => item.state === 'connected')
              if (connection) void window.api.platformRunnerStart(connection.id).then(setRunner)
            }}
          >
            {L('Enable my computer', 'Habilitar meu computador')}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {L(
          'Closing or disconnecting the desktop stops personal execution. Connect the same account used in the web. Configure provider credentials on this computer; they are not sent to the server.',
          'Fechar ou desconectar o desktop interrompe a execução pessoal. Conecte a mesma conta usada na web. Configure as credenciais dos provedores neste computador; elas não são enviadas ao servidor.'
        )}
      </p>
      {runner?.deviceId ? (
        <p className="text-xs text-muted-foreground">
          {L('Device', 'Dispositivo')}: {runner.deviceId}
        </p>
      ) : null}
      {runner?.error ? (
        <p className="text-xs text-amber-500" role="status">
          {runner.error}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
