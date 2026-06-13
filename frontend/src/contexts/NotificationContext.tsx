import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'

export interface AppNotification {
  id: string
  title: string
  body: string
  type: 'success' | 'error' | 'info'
  read: boolean
  ts: number
}

interface NotificationContextValue {
  notifications: AppNotification[]
  unreadCount: number
  markAllRead: () => void
  dismiss: (id: string) => void
  push: (n: Omit<AppNotification, 'id' | 'read' | 'ts'>) => void
}

const Ctx = createContext<NotificationContextValue | null>(null)

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'training' | 'annotating'

interface Job { id: string; name?: string; status: JobStatus }

function isTerminal(s: JobStatus) { return s === 'completed' || s === 'failed' }
function isActive(s: JobStatus) { return s === 'pending' || s === 'running' || s === 'training' }

async function fetchJobs(token: string): Promise<Job[]> {
  const headers = { Authorization: `Bearer ${token}` }
  const fetches = [
    fetch(`${BASE}/synthetic/jobs`, { headers }).then(r => r.ok ? r.json() : []),
    fetch(`${BASE}/benchmark/jobs`, { headers }).then(r => r.ok ? r.json() : []),
    fetch(`${BASE}/active-learning/sessions`, { headers }).then(r => r.ok ? r.json() : []),
  ]
  const results = await Promise.allSettled(fetches)
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, user } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try { return JSON.parse(localStorage.getItem('datrix_notifs') ?? '[]') } catch { return [] }
  })
  const seenRef = useRef<Map<string, JobStatus>>(new Map())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const push = useCallback((n: Omit<AppNotification, 'id' | 'read' | 'ts'>) => {
    const notif: AppNotification = { ...n, id: crypto.randomUUID(), read: false, ts: Date.now() }
    setNotifications(prev => {
      const next = [notif, ...prev].slice(0, 30)
      localStorage.setItem('datrix_notifs', JSON.stringify(next))
      return next
    })
  }, [])

  const poll = useCallback(async () => {
    const token = accessToken()
    if (!token) return
    try {
      const jobs = await fetchJobs(token)
      const seen = seenRef.current
      for (const job of jobs) {
        const prev = seen.get(job.id)
        if (prev !== undefined && isActive(prev) && isTerminal(job.status)) {
          const label = job.name ?? job.id.slice(0, 8)
          push({
            title: job.status === 'completed' ? 'Job completed' : 'Job failed',
            body: `"${label}" ${job.status === 'completed' ? 'finished successfully' : 'encountered an error'}`,
            type: job.status === 'completed' ? 'success' : 'error',
          })
        }
        seen.set(job.id, job.status)
      }
    } catch { /* ignore */ }
  }, [accessToken, push])

  useEffect(() => {
    if (!user) return
    poll()
    intervalRef.current = setInterval(poll, 15_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [user, poll])

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const next = prev.map(n => ({ ...n, read: true }))
      localStorage.setItem('datrix_notifs', JSON.stringify(next))
      return next
    })
  }, [])

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => {
      const next = prev.filter(n => n.id !== id)
      localStorage.setItem('datrix_notifs', JSON.stringify(next))
      return next
    })
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <Ctx.Provider value={{ notifications, unreadCount, markAllRead, dismiss, push }}>
      {children}
    </Ctx.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useNotifications must be inside NotificationProvider')
  return ctx
}
