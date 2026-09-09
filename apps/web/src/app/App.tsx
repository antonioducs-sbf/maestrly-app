import { AccountDialog } from '../features/auth/AccountDialog.js'
import { PersonalDevicesPanel } from '../features/devices/PersonalDevicesPanel.js'
import { TeamPanel } from '../features/team/TeamPanel.js'
import { RepositoriesPanel } from '../features/repositories/RepositoriesPanel.js'
import { BoardTabs } from '../features/boards/BoardTabs.js'
import { t, useLocale, LanguageSelector } from '../i18n/index.js'
import { FormDialog } from '../components/FormDialog.js'
import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { Activity, Bot, Columns3, LogOut, Moon, Sun, Users, BarChart3, GitBranch, PanelLeftClose, PanelLeftOpen, FolderKanban, Languages, Cpu, Monitor, UserRound } from 'lucide-react'
import type { Project, Board } from '@maestrly/protocol'
import { api, write } from './api.js'
import { Login } from '../features/auth/Login.js'
import { DeviceApproval } from '../features/auth/DeviceApproval.js'
import { Invitation } from '../features/auth/Invitation.js'
import { ProjectSwitcher } from '../features/projects/ProjectSwitcher.js'
import { BoardView, BoardSummary, type BoardSnapshot } from '../features/boards/BoardView.js'
import { AutomationPanel } from '../features/automations/AutomationPanel.js'
import { RunnersPanel } from '../features/runners/RunnersPanel.js'
import { OperationsPanel } from '../features/executions/OperationsPanel.js'
import { ReportsPanel } from '../features/reports/ReportsPanel.js'

interface Session {
  user: { id: string; name: string; email: string }
}
interface Organization {
  id: string
  name: string
  role: string
}
type View = 'board' | 'automations' | 'runners' | 'executions' | 'reports' | 'repositories' | 'team' | 'devices'

const nav: Array<{ id: View; label: string; icon: typeof Columns3 }> = [
  { id: 'board', label: 'Board', icon: Columns3 },
  { id: 'automations', label: 'Automations', icon: Bot },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'devices', label: 'My computers', icon: Monitor },
  { id: 'runners', label: 'Runners', icon: Cpu },
  { id: 'executions', label: 'Executions', icon: Activity },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'repositories', label: 'Git repositories', icon: GitBranch },
]

export function App() {
  useLocale()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const load = useCallback(() => {
    void api<Session | null>('/api/auth/get-session')
      .then(setSession)
      .catch(() => setSession(null))
  }, [])
  useEffect(load, [load])
  if (location.pathname === '/device')
    return (
      <>
        <LanguageSelector />
        {session===undefined?<p role="status">{t('Loading…')}</p>:session?<DeviceApproval />:<Login onSignedIn={load}/>}
      </>
    )
  if (location.pathname === '/invite')
    return (
      <>
        <LanguageSelector />
        <Invitation />
      </>
    )
  if (session === undefined)
    return (
      <div className="boot-screen">
        <img className="brand-symbol" src="/brand/mark-full.svg" alt="Maestrly" />
        <span>{t('Opening your instance…')}</span>
      </div>
    )
  if (!session)
    return (
      <>
        <LanguageSelector />
        <Login onSignedIn={load} />
      </>
    )
  return <Workspace session={session} onSignedOut={() => setSession(null)} />
}

function Workspace({ session, onSignedOut }: { session: Session; onSignedOut(): void }) {
  useLocale()
  const [desktopCollapsed,setDesktopCollapsed]=useState(()=>{try{return localStorage.getItem('maestrly-sidebar-collapsed')==='true'}catch{return false}})
  const [smallScreen,setSmallScreen]=useState(()=>window.matchMedia('(max-width: 850px)').matches)
  const [mobileOpen,setMobileOpen]=useState(false)
  const [sidebarTooltip,setSidebarTooltip]=useState<{text:string;x:number;y:number}|null>(null)
  const collapsed=smallScreen?!mobileOpen:desktopCollapsed
  useEffect(()=>{
    const media=window.matchMedia('(max-width: 850px)')
    const changed=()=>{setSmallScreen(media.matches);setMobileOpen(false);setSidebarTooltip(null)}
    media.addEventListener('change',changed)
    return()=>media.removeEventListener('change',changed)
  },[])
  function setSidebarOpen(open:boolean) {
    if(smallScreen)setMobileOpen(open)
    else {setDesktopCollapsed(!open);try{localStorage.setItem('maestrly-sidebar-collapsed',String(!open))}catch{}}
    setSidebarTooltip(null)
  }
  function showSidebarTooltip(event:SyntheticEvent) {
    const target=event.target
    if(!(target instanceof Element))return
    const button=target.closest<HTMLElement>('[data-sidebar-tooltip]')
    if(!button)return
    const rect=button.getBoundingClientRect()
    setSidebarTooltip({text:button.dataset.sidebarTooltip??'',x:rect.right+10,y:Math.max(8,Math.min(rect.top,innerHeight-48))})
  }
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [organizationId, setOrganizationId] = useState('')
  const [projects, setProjects] = useState<Array<Project & { currentRole?: 'maintainer' | 'contributor' | 'viewer' }>>(
    []
  )
  const [projectId, setProjectId] = useState('')
  const [boards, setBoards] = useState<Board[]>([])
  const [boardId, setBoardId] = useState('')
  const [loadError, setLoadError] = useState('')
  const [snapshot, setSnapshot] = useState<BoardSnapshot | null>(null)
  const [view, setView] = useState<View>('board')
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('maestrly-theme') as 'light' | 'dark') ?? 'light'
  )
  const [streamState, setStreamState] = useState<'live' | 'reconnecting'>('reconnecting')
  const lastFocused = useRef<HTMLElement | null>(null)
  const currentScope = useRef({ organizationId, projectId, boardId })
  currentScope.current = { organizationId, projectId, boardId }
  const boardRequest = useRef(0),
    boardsRequest = useRef(0)
  function selectProject(id: string) {
    if (id === projectId) return
    currentScope.current = { organizationId, projectId: id, boardId: '' }
    boardRequest.current++
    boardsRequest.current++
    setProjectId(id)
    setBoardId('')
    setBoards([])
    setSnapshot(null)
    setLoadError('')
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('maestrly-theme', theme)
  }, [theme])
  useEffect(() => {
    void api<Organization[]>('/api/v1/organizations').then((items) => {
      setOrganizations(items)
      setOrganizationId((current) => current || items[0]?.id || '')
    })
  }, [])
  useEffect(() => {
    if (!organizationId) return
    void api<Project[]>(`/api/v1/organizations/${organizationId}/projects`).then((items) => {
      setProjects(items)
      setProjectId((current) => (items.some((item) => item.id === current) ? current : (items[0]?.id ?? '')))
    })
  }, [organizationId])

  const reloadBoards = useCallback(async () => {
    if (!organizationId || !projectId) return
    const request = ++boardsRequest.current
    const all = await api<Board[]>(
      `/api/v1/organizations/${organizationId}/projects/${projectId}/boards?includeArchived=true`
    )
    if (
      request !== boardsRequest.current ||
      currentScope.current.projectId !== projectId ||
      currentScope.current.organizationId !== organizationId
    )
      return
    setBoards(all)
    setBoardId((current) => {
      let remembered = ''
      try {
        remembered = localStorage.getItem('maestrly-board:' + organizationId + ':' + projectId) ?? ''
      } catch {}
      return all.some((b) => b.id === current && !b.archivedAt)
        ? current
        : all.some((b) => b.id === remembered && !b.archivedAt)
          ? remembered
          : (all.find((b) => !b.archivedAt)?.id ?? '')
    })
  }, [organizationId, projectId])
  useEffect(() => {
    setSnapshot(null)
    setBoards([])
    void reloadBoards().catch((e) => setLoadError(e.message))
  }, [reloadBoards])
  const reloadBoard = useCallback(async () => {
    if (!organizationId || !projectId || !boardId) {
      setSnapshot(null)
      return
    }
    const request = ++boardRequest.current
    const data = await api<BoardSnapshot>(`/api/v1/organizations/${organizationId}/boards/${boardId}`)
    if (
      request !== boardRequest.current ||
      currentScope.current.projectId !== projectId ||
      currentScope.current.boardId !== boardId
    )
      return
    setSnapshot(data)
    setLoadError('')
    setBoards((current) => current.map((b) => (b.id === data.board.id ? data.board : b)))
  }, [organizationId, projectId, boardId])
  useEffect(() => {
    setSnapshot(null)
    if (organizationId && boardId) {
      try {
        localStorage.setItem('maestrly-board:' + organizationId + ':' + projectId, boardId)
      } catch {}
      void reloadBoard().catch((e) => setLoadError(e.message))
    }
  }, [organizationId, projectId, boardId, reloadBoard])
  const loaders = useRef({ reloadBoard, reloadBoards })
  loaders.current = { reloadBoard, reloadBoards }

  useEffect(() => {
    if (!organizationId || !projectId) return
    let eventSource: EventSource | undefined
    let reconnect: ReturnType<typeof setTimeout> | undefined
    let closed = false
    let cursor = 0
    let refresh: ReturnType<typeof setTimeout> | undefined
    let refreshBoards = false
    let refreshTeam = false
    const refreshAccess=async()=>{
      const items=await api<Array<Project & {currentRole?:'maintainer'|'contributor'|'viewer'}>>(`/api/v1/organizations/${organizationId}/projects`)
      if(closed)return
      setProjects(items)
      if(!items.some(p=>p.id===projectId)){eventSource?.close();selectProject('');setView('board');setLoadError('Your project access was removed.')}
    }
    const changed=()=>void refreshAccess().catch(()=>{})
    window.addEventListener('maestrly-team-changed',changed)
    const connect = () => {
      setStreamState('reconnecting')
      eventSource = new EventSource(
        `/api/v1/organizations/${organizationId}/projects/${projectId}/events?cursor=${cursor}&protocolVersion=1.0`,
        { withCredentials: true }
      )
      eventSource.addEventListener('access_revoked',()=>{eventSource?.close();void refreshAccess().catch(()=>{})})
      eventSource.onopen = () => setStreamState('live')
      eventSource.onmessage = (event) => {
        cursor = Number(event.lastEventId) || cursor
        try {
          const type = JSON.parse(event.data).type
          refreshTeam ||= type.startsWith('team.')
          refreshBoards ||= type.startsWith('board.') || type.startsWith('column.')
        } catch {}
        if (refresh) return
        refresh = setTimeout(() => {
          refresh = undefined
          if (closed) return
          void loaders.current.reloadBoard().catch((e) => setLoadError(e.message))
          if (refreshBoards) void loaders.current.reloadBoards().catch((e) => setLoadError(e.message))
          refreshBoards = false
          if(refreshTeam)window.dispatchEvent(new Event('maestrly-team-changed'))
          refreshTeam=false
        }, 100)
      }
      eventSource.onerror = () => {
        eventSource?.close()
        void refreshAccess().catch(()=>{})
        if (!closed) reconnect = setTimeout(connect, 1_500)
      }
    }
    connect()
    return () => {
      closed = true
      window.removeEventListener('maestrly-team-changed',changed)
      eventSource?.close()
      if (reconnect) clearTimeout(reconnect)
      if (refresh) clearTimeout(refresh)
    }
  }, [organizationId, projectId])

  const [accountOpen,setAccountOpen]=useState(false),[passwordChanged,setPasswordChanged]=useState(false)
  const [creatingProject, setCreatingProject] = useState(false)
  async function createProject(data: FormData) {
    const name = String(data.get('name') ?? '').trim()
    const description = String(data.get('description') ?? '').trim()
    if (!name) throw new Error('Enter a project name.')
    if (!organizationId) throw new Error('Select an organization first.')
    const created = await write<{ project: Project; boardId: string }>(
      `/api/v1/organizations/${organizationId}/projects`,
      'POST',
      { name, description }
    )
    setProjects((current) => [...current, created.project])
    selectProject(created.project.id)
    setView('board')
  }
  async function signOut() {
    await api('/api/auth/sign-out', { method: 'POST' })
    onSignedOut()
  }

  const activeProject = projects.find((project) => project.id === projectId)
  const role = organizations.find((o) => o.id === organizationId)?.role
  const canManage = role === 'owner' || role === 'admin' || activeProject?.currentRole === 'maintainer'
  const readOnly = activeProject?.currentRole === 'viewer' && !canManage
  return (
    <div className={'workspace-shell '+(collapsed?'sidebar-collapsed':'sidebar-expanded')+(smallScreen&&mobileOpen?' sidebar-mobile-open':'')}>
      {accountOpen?<AccountDialog user={session.user} onClose={()=>setAccountOpen(false)} onChanged={()=>setPasswordChanged(true)}/>:null}
      {creatingProject ? (
        <FormDialog
          title={t('Create project')}
          submitLabel={t('Create project')}
          onClose={() => setCreatingProject(false)}
          onSubmit={createProject}
        >
          <p className="form-description">{t('Give your project a name. A board will be created for its work.')}</p>
          <label>
            {t('Project name')}
            <input name="name" required maxLength={160} placeholder={t('e.g. Website launch')} />
          </label>
          <label>
            {t('Description (optional)')}
            <textarea name="description" rows={4} placeholder={t('What is this project about?')} />
          </label>
        </FormDialog>
      ) : null}
      {smallScreen&&mobileOpen?<button className="sidebar-backdrop" aria-label={t('Close sidebar')} onClick={()=>setSidebarOpen(false)}/>:null}
      {sidebarTooltip?createPortal(<div className="sidebar-tooltip" role="tooltip" style={{left:sidebarTooltip.x,top:sidebarTooltip.y}}>{sidebarTooltip.text}</div>,document.body):null}
      <aside id="project-sidebar" className="rail" onMouseOver={showSidebarTooltip} onMouseLeave={()=>setSidebarTooltip(null)} onFocusCapture={showSidebarTooltip} onBlurCapture={()=>setSidebarTooltip(null)} onPointerDown={()=>setSidebarTooltip(null)}>
        <div className="sidebar-header">
          <div className="workspace-brand" id="project-sidebar-content">
          <img className="brand-symbol small" src="/brand/mark-full.svg" alt="" />
          <strong>maestrly</strong>
          <small>WORK</small>
        </div>
          <button type="button" className="sidebar-toggle" aria-label={t(collapsed?'Open sidebar':'Close sidebar')} data-sidebar-tooltip={t(collapsed?'Open sidebar':'Close sidebar')} aria-expanded={!collapsed} aria-controls="project-sidebar" onClick={()=>setSidebarOpen(collapsed)}>
          {collapsed?<PanelLeftOpen size={21}/>:<PanelLeftClose size={21}/>}
        </button>
        </div>
        {collapsed?<button className="sidebar-project-shortcut" aria-label={t('Project')+': '+(activeProject?.name??'—')} data-sidebar-tooltip={t('Project')+': '+(activeProject?.name??'—')} onClick={()=>setSidebarOpen(true)}><FolderKanban size={20}/></button>:null}
        <div className="sidebar-projects">
          <p className="nav-caption"><span className="project-caption-full">{t('Selected project')}</span><span className="project-caption-short">{t('Project')}</span></p>
          {projects.length ? (
            <ProjectSwitcher
              projects={projects}
              selectedId={projectId}
              onSelect={selectProject}
              onCreate={() => setCreatingProject(true)}
            />
          ) : null}
          <p className="project-scope-note" id="project-scope-note">{t('Navigation below belongs to this project.')}</p>
        </div>
        <p className="nav-caption project-nav-caption">{t('In this project')}</p>
        <nav aria-label={t('Workspace')} aria-describedby="project-scope-note">
          {nav.map((item) => (
            <button
              key={item.id}
              disabled={!projectId}
              className={view === item.id ? 'active' : ''}
              onClick={(event) => {
                lastFocused.current = event.currentTarget
                setView(item.id)
                if(smallScreen)setSidebarOpen(false)
              }}
              aria-label={t(item.label)}
              data-sidebar-tooltip={collapsed?t(item.label):undefined}
            >
              <item.icon />
              <span>{t(item.label)}</span>
            </button>
          ))}
        </nav>
        <div className="rail-bottom">
          <div className="sidebar-user">
            <div className="avatar">{session.user.name.slice(0, 2).toUpperCase()}</div>
            <span>{session.user.name}</span>
          </div>
          {collapsed?<button className="sidebar-language-shortcut" aria-label={t('Language')} data-sidebar-tooltip={t('Language')} onClick={()=>setSidebarOpen(true)}><Languages size={19}/></button>:null}
          <LanguageSelector />
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            aria-label={t(theme === 'light' ? 'Use dark theme' : 'Use light theme')}
            data-sidebar-tooltip={collapsed?t(theme === 'light' ? 'Use dark theme' : 'Use light theme'):undefined}
          >
            {theme === 'light' ? <Moon /> : <Sun />}
          </button>
          <button onClick={()=>{setPasswordChanged(false);setAccountOpen(true)}} aria-label={t('My account')} data-sidebar-tooltip={collapsed?t('My account'):undefined}><UserRound/><span>{t('My account')}</span></button>
          <button onClick={() => void signOut()} aria-label={t('Sign out')} data-sidebar-tooltip={collapsed?t('Sign out'):undefined}>
            <LogOut />
          </button>
        </div>
      </aside>
      <main className="workspace-main">
        {passwordChanged?<p className="form-note account-notice" role="status">{t('Password changed successfully.')}</p>:null}
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {organizations.find((item) => item.id === organizationId)?.name ?? t('Your organization')}
            </p>
            {projects.length ? (
              <span className="breadcrumb-project" title={activeProject?.name}><span className="scope-label">{t('Project')}:</span> <strong>{activeProject?.name}</strong></span>
            ) : (
              <button className="primary" onClick={() => setCreatingProject(true)}>
                {t('Create first project')}
              </button>
            )}
          </div>
          <div className="topbar-status">
            <span className={streamState}>
              <i />
              {streamState === 'live' ? t('Live') : t('Reconnecting')}
            </span>
            <div className="avatar" title={session.user.email}>
              {session.user.name.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>
        {view==='board' && snapshot && snapshot.board.id===boardId ? <div className="board-summary-top"><BoardSummary snapshot={snapshot}/></div> : null}
        <div className="view-heading">
          <div>
            <p className="page-project-context">{t('Project')}: <strong>{activeProject?.name ?? '—'}</strong></p>
            <h1>
              {view === 'board'
                ? (activeProject?.name ?? t('Board'))
                : t(nav.find((item) => item.id === view)?.label ?? '')}
            </h1>
            <span className="view-subtitle" role="heading" aria-level={2}>
              {view === 'board' ? t('Board') : ''}
            </span>
          </div>
          {view === 'board' ? (
            <p>{t('Move work deliberately. Automation starts only on a real column entry.')}</p>
          ) : null}
        </div>
        <div className="view-content">
          {loadError ? <p role="alert">{t(loadError)}</p> : null}
          {projectId && view === 'board' ? (
            <BoardTabs
              boards={boards}
              selectedId={boardId}
              organizationId={organizationId}
              projectId={projectId}
              readOnly={!!readOnly}
              onSelect={setBoardId}
              onReload={reloadBoards}
            />
          ) : null}
          {!organizationId ? (
            <div className="empty">
              <h2>{t('No organization access')}</h2>
              <p>{t('Ask an administrator for an invitation link.')}</p>
            </div>
          ) : null}
          {organizationId && !projectId ? (
            <div className="empty">
              <h2>{t('No projects yet')}</h2>
              <p>{t('Create a project to start a delivery board.')}</p>
              <button className="primary" onClick={() => setCreatingProject(true)}>
                {t('Create project')}
              </button>
            </div>
          ) : null}
          {projectId && view === 'board' && snapshot && snapshot.board.id === boardId ? (
            <BoardView
              canManageAutomation={canManage}
              key={boardId}
              organizationId={organizationId}
              snapshot={snapshot}
              readOnly={readOnly}
              onReload={() => void reloadBoard()}
            />
          ) : null}
          {projectId && view === 'automations' && snapshot ? (
            !canManage ? (
              <div className="empty">
                <h2>{t('Read-only project')}</h2>
                <p>{t('A maintainer manages automation policies.')}</p>
              </div>
            ) : (
              <AutomationPanel
                key={projectId+boardId}
                board={snapshot.board}
                organizationId={organizationId}
                projectId={projectId}
                columns={snapshot.columns}
                onChanged={() => void reloadBoard()}
              />
            )
          ) : null}
          {projectId && view === 'devices' ? <PersonalDevicesPanel key={organizationId+projectId} organizationId={organizationId} projectId={projectId}/> : null}
          {projectId && view === 'team' ? <TeamPanel key={organizationId+projectId} organizationId={organizationId} projectId={projectId} projectName={activeProject?.name??''}/> : null}
          {projectId && view === 'runners' ? (
            <RunnersPanel organizationId={organizationId} projectId={projectId} canManage={canManage} />
          ) : null}
          {projectId && view === 'executions' ? (
            <OperationsPanel organizationId={organizationId} projectId={projectId} />
          ) : null}
          {projectId && view === 'repositories' ? (
            <RepositoriesPanel
              organizationId={organizationId}
              projectId={projectId}
              canManage={canManage}
              onChanged={() => {
                void reloadBoard()
              }}
            />
          ) : null}
          {projectId && view === 'reports' ? (
            <ReportsPanel organizationId={organizationId} projectId={projectId} />
          ) : null}
        </div>
      </main>
    </div>
  )
}
