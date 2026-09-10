import { ExecutorSection } from './ExecutorSection'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Link2, Server, Unplug } from 'lucide-react'
import type {
  DeviceAuthorizationView,
  PlatformConnectionView,
  RemotePlatformProject,
  PlatformProjectBinding,
} from '../../../shared/platform'
import { Button } from '../ui/button'

export function PlatformSection() {
  const { i18n } = useTranslation()
  const L = (en: string, pt: string) => (i18n.language.startsWith('pt') ? pt : en)
  const [connections, setConnections] = useState<PlatformConnectionView[]>([])
  const [url, setUrl] = useState('http://127.0.0.1:14310')
  const [clientId, setClientId] = useState('')
  const [authorization, setAuthorization] = useState<DeviceAuthorizationView | null>(null)
  const [error, setError] = useState('')
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string }>>([])
  const [remoteProjects, setRemoteProjects] = useState<RemotePlatformProject[]>([])
  const [workspaceId, setWorkspaceId] = useState('')
  const [remoteProjectId, setRemoteProjectId] = useState('')
  const [repositoryBindingId, setRepositoryBindingId] = useState('')
  const [bindings, setBindings] = useState<PlatformProjectBinding[]>([])
  const [saved, setSaved] = useState(false)
  const reload = () => window.api.platformListConnections().then(setConnections)
  useEffect(() => {
    void reload()
    void window.api.platformListProjectBindings().then(setBindings)
    void window.api.listWorkspaces().then((items) => {
      setWorkspaces(items)
      setWorkspaceId(items[0]?.id ?? '')
    })
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
    })
    setError('')
    setSaved(true)
    setBindings(await window.api.platformListProjectBindings())
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center gap-3">
        <Server className="size-5 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-semibold">{L('Kanban connection', 'Conexão com o Kanban')}</h2>
          <p className="text-xs text-muted-foreground">
            {L(
              'Connect this app to your Kanban, choose a project folder, then enable the executor below.',
              'Conecte este app ao seu Kanban, escolha a pasta do projeto e ative o executor abaixo.'
            )}
          </p>
        </div>
      </header>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          aria-label={L('Instance URL', 'URL da instância')}
        />
        <Button onClick={() => void add()}>
          <Link2 className="size-4" /> {L('Add instance', 'Adicionar instância')}
        </Button>
      </div>
      {connections.length > 0 && !connections.some((c) => c.desktopClientId) ? (
        <details>
          <summary className="text-xs">
            {L('Advanced connection settings', 'Configurações avançadas de conexão')}
          </summary>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            placeholder="Public OAuth client ID for this instance"
            aria-label="OAuth client ID"
          />
        </details>
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
                title={L('Disconnect', 'Desconectar')}
              >
                <Unplug className="size-4" />
              </Button>
            ) : (
              <Button variant="outline" onClick={() => void authorize(connection.id)}>
                <ExternalLink className="size-4" /> {L('Connect', 'Conectar')}
              </Button>
            )}
          </article>
        ))}
      </div>
      {authorization ? (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground">
            {L('Confirm this exact code in your browser', 'Confirme este código no navegador')}
          </p>
          <strong className="my-2 block font-mono text-xl tracking-widest">{authorization.userCode}</strong>
          <Button onClick={() => void poll()}>{L('I approved the code', 'Aprovei o código')}</Button>
        </div>
      ) : null}
      {remoteProjects.length > 0 ? (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <div>
            <strong className="block text-sm">{L('Project folder', 'Pasta do projeto')}</strong>
            <span className="text-xs text-muted-foreground">
              {L(
                'Execution conversations appear on the card. Other local conversations stay on this machine.',
                'As conversas das execuções aparecem no card. As demais conversas locais ficam nesta máquina.'
              )}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
              aria-label={L('Local workspace', 'Workspace local')}
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
              onChange={(event) => {
                setRemoteProjectId(event.target.value)
                setRepositoryBindingId('')
                setSaved(false)
              }}
              aria-label={L('Remote project', 'Projeto remoto')}
            >
              {remoteProjects.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.organizationName} · {project.projectName}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={repositoryBindingId}
              onChange={(e) => setRepositoryBindingId(e.target.value)}
              aria-label="Repository"
            >
              <option value="">{L('No repository / analysis only', 'Sem repositório / somente análise')}</option>
              {remoteProjects
                .find((p) => p.projectId === remoteProjectId)
                ?.repositories?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.baseBranch}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void bindProject().catch((e) => setError(e.message))}>
              {L('Authorize project', 'Autorizar projeto')}
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                void (async () => {
                  const folder = await window.api.pickFolder()
                  if (!folder) return
                  const workspace = await window.api.addWorkspace(folder)
                  setWorkspaces(await window.api.listWorkspaces())
                  setWorkspaceId(workspace.id)
                })().catch((e) => setError(e.message))
              }
            >
              {L('Choose another folder', 'Escolher outra pasta')}
            </Button>
          </div>
          {saved ? (
            <p role="status" className="text-xs text-emerald-600">
              {L(
                'Project authorized. You can start the executor below.',
                'Projeto autorizado. Você pode iniciar o executor abaixo.'
              )}
            </p>
          ) : null}
          {bindings.map((b) => (
            <div key={b.workspaceId} className="flex items-center justify-between gap-2 text-xs">
              <span>
                {workspaces.find((w) => w.id === b.workspaceId)?.name ?? L('Workspace', 'Workspace')} ·{' '}
                {remoteProjects.find((p) => p.projectId === b.projectId)?.projectName ??
                  L('Authorized project', 'Projeto autorizado')}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void window.api
                    .platformRemoveProjectBinding(b.workspaceId)
                    .then(() => window.api.platformListProjectBindings())
                    .then(setBindings)
                    .catch((e) => setError(e.message))
                }
              >
                {L('Remove authorization', 'Remover autorização')}
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      <ExecutorSection connections={connections} />
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
