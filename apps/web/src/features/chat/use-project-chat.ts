import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { HttpTransport, ProjectChatClient, applyProjectChatEvent, readProjectChatEvents } from '@maestrly/client-sdk'
import type {
  ChatCreate,
  ProjectChatDestination,
  ProjectChatSession,
  ProjectChatSnapshot,
  ProjectChatMessage,
  ChatDecision,
} from '@maestrly/protocol'
import { serverUrl } from '../../app/api.js'

export function useProjectChat(organizationId: string, projectId: string, userId: string) {
  const transport = useMemo(() => new HttpTransport({ baseUrl: serverUrl }), [])
  const client = useMemo(
    () => new ProjectChatClient(transport, organizationId, projectId),
    [transport, organizationId, projectId]
  )
  const storageKey = 'maestrly-chat-v1:' + userId + ':' + organizationId + ':' + projectId
  const [sessionId, setSessionId] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey) ?? ''
    } catch {
      return ''
    }
  })
  const [sessions, setSessions] = useState<ProjectChatSession[]>([]),
    [destinations, setDestinations] = useState<ProjectChatDestination[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [data, setData] = useState<ProjectChatSnapshot | null>(null),
    [error, setError] = useState(''),
    [connection, setConnection] = useState('connecting')
  const [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0)
  const current = useRef<ProjectChatSnapshot | null>(null),
    selected = useRef(sessionId),
    mounted = useRef(true)
  selected.current = sessionId
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, sessionId)
    } catch {}
  }, [sessionId, storageKey])
  const reloadList = useCallback(async () => {
    const result = await client.sessions()
    if (mounted.current) {
      setSessions(result.items)
      setNextCursor(result.nextCursor)
    }
  }, [client])
  useEffect(() => {
    let active = true
    void Promise.allSettled([client.destinations(), client.sessions()]).then(([d, s]) => {
      if (!active) return
      if (d.status === 'fulfilled') setDestinations(d.value)
      if (s.status === 'fulfilled') {
        setSessions(s.value.items)
        setNextCursor(s.value.nextCursor)
      } else setError(s.reason.message)
    })
    return () => {
      active = false
    }
  }, [client])
  useEffect(() => {
    const controller = new AbortController()
    let active = true,
      timer: ReturnType<typeof setTimeout> | undefined
    current.current = null
    setData(null)
    setError('')
    if (!sessionId) {
      setConnection('idle')
      return () => controller.abort()
    }
    const connect = async () => {
      try {
        setConnection('connecting')
        const snapshot = await client.snapshot(sessionId)
        if (!active) return
        current.current = snapshot
        setData(snapshot)
        const response = await client.events(sessionId, snapshot.cursor, controller.signal)
        if (!active) return
        setConnection('live')
        setError('')
        for await (const event of readProjectChatEvents(response)) {
          if (!active || !current.current) return
          current.current = applyProjectChatEvent(current.current, event)
          setData(current.current)
        }
      } catch (e) {
        if (!active) return
        setError((e as Error).message)
      }
      if (active) {
        setConnection('reconnecting')
        timer = setTimeout(() => void connect(), 1000)
      }
    }
    void connect()
    return () => {
      active = false
      controller.abort()
      clearTimeout(timer)
    }
  }, [client, sessionId, refresh])
  const act = async <T>(operation: () => Promise<T>): Promise<T> => {
    setBusy(true)
    setError('')
    try {
      return await operation()
    } catch (e) {
      if (mounted.current) setError((e as Error).message)
      throw e
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  return {
    client,
    storageKey,
    sessionId,
    setSessionId,
    sessions,
    destinations,
    nextCursor,
    data,
    error,
    connection,
    busy,
    refresh: () => setRefresh((v) => v + 1),
    create: (input: ChatCreate) =>
      act(async () => {
        const result = await client.create(input, crypto.randomUUID())
        if (mounted.current) {
          await reloadList()
          setSessionId(result.id)
        }
        return result
      }),
    send: (text: string, id: string) =>
      act(async () => {
        const target = sessionId
        await client.send(target, text, id)
        if (mounted.current && selected.current === target) setRefresh((v) => v + 1)
      }),
    cancel: () =>
      act(async () => {
        if (data?.turn) await client.cancel(sessionId, data.turn.id)
      }),
    decide: (id: string, version: number, decision: ChatDecision) =>
      act(() => client.decide(sessionId, id, version, decision, 'decision-' + id + '-' + version)),
    rename: (title: string) =>
      act(async () => {
        if (!data) return
        await transport.request('PATCH', client.path + '/sessions/' + sessionId, {
          body: { title, expectedVersion: data.session.version },
          idempotencyKey: crypto.randomUUID(),
        })
        await reloadList()
        setRefresh((v) => v + 1)
      }),
    archive: () =>
      act(async () => {
        if (!data) return
        await transport.request('PATCH', client.path + '/sessions/' + sessionId, {
          body: { archived: true, expectedVersion: data.session.version },
          idempotencyKey: crypto.randomUUID(),
        })
        await reloadList()
        setSessionId('')
      }),
    moreSessions: () =>
      act(async () => {
        if (!nextCursor) return
        const page = await client.sessions(nextCursor)
        setSessions((v) => [...v, ...page.items])
        setNextCursor(page.nextCursor)
      }),
    earlier: () =>
      act(async () => {
        const target = sessionId,
          before = data?.messages[0]?.id
        if (!before) return
        const page = await transport.request<{ items: ProjectChatMessage[]; more: boolean }>(
          'GET',
          client.path + '/sessions/' + target + '/messages?before=' + before
        )
        if (selected.current !== target || !current.current) return
        current.current = {
          ...current.current,
          messages: [...page.items, ...current.current.messages],
          more: page.more,
        }
        setData(current.current)
      }),
  }
}
