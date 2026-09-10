import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, FolderOpen, GitBranch, Link2, Loader2 } from 'lucide-react'
import type { Workspace } from '../../../preload'
import type { PlatformConnectionView, PlatformProjectBinding, RemotePlatformProject } from '../../../shared/platform'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

const WITHOUT_CODE = 'without-code'

export function ProjectBindingSection({ connections }: { connections: PlatformConnectionView[] }) {
  const { i18n } = useTranslation()
  const L = (en: string, pt: string) => (i18n.language.startsWith('pt') ? pt : en)
  const id = useId()
  const [connectionId, setConnectionId] = useState('')
  const connection =
    connections.find((c) => c.id === connectionId && c.state === 'connected') ??
    connections.find((c) => c.state === 'connected')
  const [data, setData] = useState<{
    projects: RemotePlatformProject[]
    workspaces: Workspace[]
    bindings: PlatformProjectBinding[]
  }>({ projects: [], workspaces: [], bindings: [] })
  const [projectId, setProjectId] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [repositoryId, setRepositoryId] = useState(WITHOUT_CODE)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState<'folder' | 'save' | 'remove' | null>(null)
  const [error, setError] = useState('')
  const [folderError, setFolderError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(false)
  const [removed, setRemoved] = useState<PlatformProjectBinding | null>(null)

  useEffect(() => {
    if (!connection) return
    let active = true
    setLoading(true)
    setLoadError(false)
    setError('')
    setFolderError('')
    setNotice('')
    setWorkspaceId('')
    setRemoved(null)
    setEditing(false)
    void Promise.all([
      window.api.platformListRemoteProjects(connection.id),
      window.api.listWorkspaces(),
      window.api.platformListProjectBindings(),
    ])
      .then(([projects, workspaces, bindings]) => {
        if (!active) return
        setData({ projects, workspaces, bindings })
        const first = projects.length === 1 ? projects[0] : undefined
        setProjectId(first?.projectId ?? '')
        setRepositoryId(
          first?.repositories?.length === 1 ? first.repositories[0].id : first?.repositories?.length ? '' : WITHOUT_CODE
        )
      })
      .catch(() => {
        if (active) setLoadError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [connection?.id, revision])

  if (!connection) return null
  const project = data.projects.find((p) => p.projectId === projectId)
  const workspace = data.workspaces.find((w) => w.id === workspaceId)
  const repositories = project?.repositories ?? []
  const existing = data.bindings.find((b) => b.workspaceId === workspaceId)
  const occupied = !!existing && (existing.connectionId !== connection.id || existing.projectId !== projectId)
  const matchesSaved =
    !!existing &&
    !occupied &&
    existing.repositoryBindingId === (repositoryId === WITHOUT_CODE ? undefined : repositoryId)
  const linked = data.bindings.filter((b) => b.connectionId === connection.id)
  const ready = !!project && !!workspace && !!project.boards.length && !!repositoryId && !occupied && !matchesSaved

  function chooseProject(value: string) {
    const next = data.projects.find((p) => p.projectId === value)
    setProjectId(value)
    setWorkspaceId('')
    setNotice('')
    setError('')
    setFolderError('')
    setRepositoryId(
      next?.repositories?.length === 1 ? next.repositories[0].id : next?.repositories?.length ? '' : WITHOUT_CODE
    )
  }
  function chooseWorkspace(value: string) {
    setWorkspaceId(value)
    setNotice('')
    setError('')
    setFolderError('')
    const saved = data.bindings.find(
      (b) => b.workspaceId === value && b.connectionId === connection!.id && b.projectId === projectId
    )
    if (saved) setRepositoryId(saved.repositoryBindingId ?? WITHOUT_CODE)
  }
  async function act(kind: NonNullable<typeof busy>, operation: () => Promise<void>) {
    if (busy) return
    setBusy(kind)
    setError('')
    setFolderError('')
    setNotice('')
    try {
      await operation()
    } catch (e) {
      const message = (e as Error).message.replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, '')
      if (kind === 'folder') setFolderError(message)
      else setError(message)
    } finally {
      setBusy(null)
    }
  }
  async function chooseFolder() {
    const folder = await window.api.pickFolder()
    if (!folder) return
    const selected = await window.api.addWorkspace(folder)
    const workspaces = await window.api.listWorkspaces()
    setData((current) => ({ ...current, workspaces }))
    chooseWorkspace(selected.id)
  }
  async function save() {
    if (!ready || !connection || !project) return
    await window.api.platformSetProjectBinding({
      workspaceId,
      connectionId: connection.id,
      organizationId: project.organizationId,
      projectId,
      boardId: project.boards[0].id,
      ...(repositoryId !== WITHOUT_CODE ? { repositoryBindingId: repositoryId } : {}),
    })
    const bindings = await window.api.platformListProjectBindings()
    setData((current) => ({ ...current, bindings }))
    setRemoved(null)
    setEditing(false)
    setNotice('saved')
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="min-w-0 space-y-5 rounded-xl border border-border p-5"
      data-testid="project-binding-section"
    >
      <header className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <h3 id={`${id}-title`} className="text-sm font-semibold">
            {L('Projects on this computer', 'Projetos neste computador')}
          </h3>
          <Button variant="ghost" size="sm" disabled={loading || !!busy} onClick={() => setRevision((n) => n + 1)}>
            {L('Refresh', 'Atualizar')}
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {L(
            'Link a Kanban project to a local folder so this computer can execute its cards.',
            'Vincule um projeto do Kanban a uma pasta local para que este computador possa executar os cards dele.'
          )}
        </p>
      </header>
      {connections.filter((c) => c.state === 'connected').length > 1 ? (
        <div className="space-y-2">
          <label className="text-xs font-medium" htmlFor={`${id}-connection`}>
            {L('Kanban instance', 'Instância do Kanban')}
          </label>
          <Select value={connection.id} onValueChange={setConnectionId} disabled={!!busy}>
            <SelectTrigger className="min-w-0 [&>span]:min-w-0 [&>span]:truncate" id={`${id}-connection`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {connections
                .filter((c) => c.state === 'connected')
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} · {c.url}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {loading ? (
        <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {L('Loading projects…', 'Carregando projetos…')}
        </p>
      ) : loadError ? (
        <div className="space-y-2">
          <p role="alert" className="text-xs text-destructive">
            {L(
              'Could not load projects. Check the Kanban connection and try again.',
              'Não foi possível carregar os projetos. Verifique a conexão com o Kanban e tente novamente.'
            )}
          </p>
          <Button variant="outline" size="sm" onClick={() => setRevision((n) => n + 1)}>
            {L('Try again', 'Tentar novamente')}
          </Button>
        </div>
      ) : !data.projects.length ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {L(
              'No projects are available for this account. Create a project in the Kanban or ask for access, then refresh this list.',
              'Nenhum projeto está disponível para esta conta. Crie um projeto no Kanban ou peça acesso e atualize esta lista.'
            )}
          </p>
          <Button variant="outline" size="sm" onClick={() => setRevision((n) => n + 1)}>
            {L('Refresh projects', 'Atualizar projetos')}
          </Button>
        </div>
      ) : (
        <>
          {editing || !linked.length ? (
            <>
              <fieldset disabled={!!busy} className="min-w-0 space-y-5">
                <div className="space-y-2">
                  <label htmlFor={`${id}-project`} className="text-xs font-medium">
                    {L('1. Kanban project', '1. Projeto do Kanban')}
                  </label>
                  <Select value={projectId} onValueChange={chooseProject}>
                    <SelectTrigger className="min-w-0 [&>span]:min-w-0 [&>span]:truncate" id={`${id}-project`}>
                      <SelectValue placeholder={L('Select a project…', 'Selecione um projeto…')} />
                    </SelectTrigger>
                    <SelectContent>
                      {data.projects.map((p) => (
                        <SelectItem key={p.projectId} value={p.projectId}>
                          {p.projectName} · {p.organizationName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  {data.workspaces.length ? (
                    <label htmlFor={`${id}-folder`} className="text-xs font-medium">
                      {L('2. Folder on this computer', '2. Pasta neste computador')}
                    </label>
                  ) : (
                    <p className="text-xs font-medium">
                      {L('2. Folder on this computer', '2. Pasta neste computador')}
                    </p>
                  )}
                  {data.workspaces.length ? (
                    <Select value={workspaceId} onValueChange={chooseWorkspace} disabled={!project}>
                      <SelectTrigger
                        className="min-w-0 [&>span]:min-w-0 [&>span]:truncate"
                        id={`${id}-folder`}
                        aria-describedby={`${id}-folder-help`}
                      >
                        <SelectValue placeholder={L('Select a local folder…', 'Selecione uma pasta local…')}>
                          {workspace?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {data.workspaces.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            <span className="block text-xs">{w.name}</span>
                            <span className="block max-w-[min(28rem,calc(100vw-3rem))] break-all whitespace-normal text-[11px] text-muted-foreground">
                              {w.path}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {L('No local folder selected yet.', 'Nenhuma pasta local selecionada ainda.')}
                    </p>
                  )}
                  {workspace ? (
                    <p className="break-all font-mono text-xs leading-relaxed text-muted-foreground" translate="no">
                      {workspace.path}
                    </p>
                  ) : null}
                  <Button
                    id={`${id}-pick-folder`}
                    variant="outline"
                    size="sm"
                    disabled={!project}
                    onClick={() => void act('folder', chooseFolder)}
                  >
                    <FolderOpen size={14} aria-hidden="true" />
                    {L(
                      workspace ? 'Choose another folder…' : 'Choose folder…',
                      workspace ? 'Escolher outra pasta…' : 'Escolher pasta…'
                    )}
                  </Button>
                  <p id={`${id}-folder-help`} className="text-xs leading-relaxed text-muted-foreground">
                    {L(
                      'Choose the folder of a Git repository already on this computer. Linking it does not download code or start a task.',
                      'Escolha a pasta de um repositório Git que já está neste computador. Vincular não baixa o código nem inicia uma tarefa.'
                    )}
                  </p>
                  {folderError ? (
                    <p role="alert" className="text-xs text-destructive">
                      {folderError}
                    </p>
                  ) : null}
                </div>
                {project ? (
                  <div className="space-y-2 border-t border-border pt-4">
                    {repositories.length ? (
                      <>
                        <label htmlFor={`${id}-repo`} className="text-xs font-medium">
                          {L('Code repository', 'Repositório do código')}
                        </label>
                        <Select
                          value={repositoryId}
                          onValueChange={(value) => {
                            setRepositoryId(value)
                            setNotice('')
                            setError('')
                            setFolderError('')
                          }}
                        >
                          <SelectTrigger
                            className="min-w-0 [&>span]:min-w-0 [&>span]:truncate"
                            id={`${id}-repo`}
                            aria-describedby={`${id}-repo-help`}
                          >
                            <SelectValue placeholder={L('Select a repository…', 'Selecione um repositório…')} />
                          </SelectTrigger>
                          <SelectContent>
                            {repositories.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name}
                                {r.baseBranch ? ` · ${r.baseBranch}` : ''}
                              </SelectItem>
                            ))}
                            <SelectItem value={WITHOUT_CODE}>
                              {L('Tasks without code', 'Tarefas sem código')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p id={`${id}-repo-help`} className="text-xs leading-relaxed text-muted-foreground">
                          {repositoryId === WITHOUT_CODE
                            ? L(
                                'Conversations are grouped under the selected folder. Tasks run in a separate folder without repository code.',
                                'As conversas ficam agrupadas na pasta escolhida. As tarefas usam uma pasta separada, sem o código de um repositório.'
                              )
                            : L(
                                'The selected local folder must contain this repository. The executor works in a separate copy of its committed code.',
                                'A pasta local escolhida deve conter esse repositório. O executor trabalha em uma cópia separada do código salvo no Git.'
                              )}
                        </p>
                      </>
                    ) : (
                      <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                        <GitBranch size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <p>
                          {L(
                            'This Kanban project has no code repository. This link supports analysis tasks. For code tasks, add a repository to the project in the Kanban.',
                            'Este projeto do Kanban ainda não tem repositório de código. O vínculo permite tarefas de análise. Para trabalhar com código, cadastre o repositório no projeto do Kanban.'
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}
              </fieldset>
              {project && !project.boards.length ? (
                <p role="alert" className="text-xs text-destructive">
                  {L(
                    'This project has no board yet. Create one in the Kanban before linking it.',
                    'Este projeto ainda não tem um quadro. Crie um no Kanban antes de vincular.'
                  )}
                </p>
              ) : null}
              {occupied ? (
                <p role="alert" className="text-xs text-destructive">
                  {L(
                    'This folder is already linked to another project. Choose another folder or remove its existing link below.',
                    'Esta pasta já está vinculada a outro projeto. Escolha outra pasta ou remova o vínculo existente abaixo.'
                  )}
                </p>
              ) : null}
              <div className="space-y-2">
                <Button disabled={!ready || !!busy} onClick={() => void act('save', save)}>
                  {busy === 'save' ? (
                    <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <Link2 size={14} aria-hidden="true" />
                  )}
                  {L(
                    matchesSaved ? 'Project linked' : existing && !occupied ? 'Update link' : 'Link project',
                    matchesSaved
                      ? 'Projeto vinculado'
                      : existing && !occupied
                        ? 'Atualizar vínculo'
                        : 'Vincular projeto'
                  )}
                </Button>
                {linked.length ? (
                  <Button
                    variant="ghost"
                    disabled={!!busy}
                    onClick={() => {
                      setEditing(false)
                      setError('')
                      setFolderError('')
                      setNotice('')
                    }}
                  >
                    {L('Cancel', 'Cancelar')}
                  </Button>
                ) : null}
                {!workspace && !loading ? (
                  <p className="text-xs text-muted-foreground">
                    {L(
                      'Select a project and a local folder to link them.',
                      'Escolha um projeto e uma pasta local para criar o vínculo.'
                    )}
                  </p>
                ) : null}
                {error ? (
                  <p role="alert" className="text-xs text-destructive">
                    {error}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
          {notice ? (
            <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400">
              {L(
                'Project linked. You can now start the executor below.',
                'Projeto vinculado. Agora você pode iniciar o executor abaixo.'
              )}
            </p>
          ) : null}
          {linked.length ? (
            <div className={editing ? 'space-y-3 border-t border-border pt-4' : 'space-y-3'}>
              <h4 className="text-xs font-medium">{L('Linked projects', 'Projetos vinculados')}</h4>
              {linked.map((b) => {
                const p = data.projects.find((p) => p.projectId === b.projectId),
                  w = data.workspaces.find((w) => w.id === b.workspaceId)
                return (
                  <article
                    key={b.workspaceId}
                    className="flex flex-wrap items-start gap-3"
                    data-testid="saved-project-binding"
                  >
                    <Check size={15} className="mt-0.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="break-words text-xs font-medium">
                        {p?.projectName ?? L('Linked project', 'Projeto vinculado')}
                      </p>
                      <p className="break-all font-mono text-[11px] text-muted-foreground" translate="no">
                        {w?.path ?? L('Local folder unavailable', 'Pasta local indisponível')}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {b.repositoryBindingId
                          ? (p?.repositories?.find((r) => r.id === b.repositoryBindingId)?.name ??
                            L('Code repository', 'Repositório de código'))
                          : L('Tasks without code', 'Tarefas sem código')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!!busy}
                      onClick={() =>
                        void act('remove', async () => {
                          await window.api.platformRemoveProjectBinding(b.workspaceId)
                          setData((current) => ({
                            ...current,
                            bindings: current.bindings.filter((item) => item.workspaceId !== b.workspaceId),
                          }))
                          setRemoved(b)
                        })
                      }
                    >
                      {L('Remove link', 'Remover vínculo')}
                    </Button>
                  </article>
                )
              })}
            </div>
          ) : null}
          {linked.length && !editing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(true)
                setWorkspaceId('')
                setNotice('')
                setError('')
                setFolderError('')
              }}
            >
              <Link2 size={14} aria-hidden="true" />
              {L('Link another project', 'Vincular outro projeto')}
            </Button>
          ) : null}
          {error && !editing && linked.length ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
          {removed ? (
            <div role="status" className="flex flex-wrap items-center gap-2 text-xs">
              <span>
                {L(
                  'Link removed. Your folder and conversations are preserved.',
                  'Vínculo removido. Sua pasta e suas conversas foram preservadas.'
                )}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={!!busy}
                onClick={() =>
                  void act('save', async () => {
                    await window.api.platformSetProjectBinding(removed)
                    setData((current) => ({
                      ...current,
                      bindings: [...current.bindings.filter((b) => b.workspaceId !== removed.workspaceId), removed],
                    }))
                    setRemoved(null)
                  })
                }
              >
                {L('Undo', 'Desfazer')}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
