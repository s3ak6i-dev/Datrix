import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'

export interface AppNotification {
  id: string
  title: string
  body: string
  type: 'success' | 'error' | 'info'
  category: 'job' | 'workspace'
  color?: string   // member's chosen color for workspace notifications
  link?: string    // route to navigate to on click
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

// ── Job polling ───────────────────────────────────────────────────────────────

type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'training' | 'annotating'
interface Job { id: string; name?: string; status: JobStatus }

function isTerminal(s: JobStatus) { return s === 'completed' || s === 'failed' }
function isActive(s: JobStatus) { return s === 'pending' || s === 'running' || s === 'training' }

async function fetchJobs(token: string): Promise<Job[]> {
  const headers = { Authorization: `Bearer ${token}` }
  const results = await Promise.allSettled([
    fetch(`${BASE}/synthetic/jobs`, { headers }).then(r => r.ok ? r.json() : []),
    fetch(`${BASE}/benchmark/jobs`, { headers }).then(r => r.ok ? r.json() : []),
    fetch(`${BASE}/al/sessions`, { headers }).then(r => r.ok ? r.json() : []),
  ])
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
}

// ── Change request polling ────────────────────────────────────────────────────

type CRStatus = 'pending' | 'approved' | 'rejected' | 'auto_approved' | 'rolled_back'

interface CR {
  id: string
  org_id: string
  user_id: string
  user_name: string | null
  user_color: string | null
  title: string
  impact: string
  status: CRStatus
  reviewer_comment: string | null
  rollback_comment: string | null
  reviewed_at: string | null
}

async function fetchCRsForOrg(token: string, orgId: string): Promise<CR[]> {
  const res = await fetch(`${BASE}/changes?org_id=${orgId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.ok ? res.json() : []
}

async function fetchOrgs(token: string): Promise<{ id: string; role: string }[]> {
  const res = await fetch(`${BASE}/orgs`, { headers: { Authorization: `Bearer ${token}` } })
  return res.ok ? res.json() : []
}

const IMPACT_LABELS: Record<string, string> = {
  low: 'Low impact', medium: 'Medium impact', high: 'High impact', critical: 'Critical impact',
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, user } = useAuth()

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try { return JSON.parse(localStorage.getItem('datrix_notifs') ?? '[]') } catch { return [] }
  })

  // Job state tracking: id → last known status
  const jobSeenRef = useRef<Map<string, JobStatus>>(new Map())

  // CR state tracking: cr_id → last known status
  const crSeenRef = useRef<Map<string, CRStatus>>(new Map())

  // CR IDs we've already notified about — persisted so page refresh doesn't re-fire
  const notifiedNewCRsRef = useRef<Set<string>>(
    new Set(JSON.parse(localStorage.getItem('datrix_notif_cr_seen') ?? '[]'))
  )

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const push = useCallback((n: Omit<AppNotification, 'id' | 'read' | 'ts'>) => {
    const notif: AppNotification = { ...n, id: crypto.randomUUID(), read: false, ts: Date.now() }
    setNotifications(prev => {
      const next = [notif, ...prev].slice(0, 50)
      localStorage.setItem('datrix_notifs', JSON.stringify(next))
      return next
    })
  }, [])

  const poll = useCallback(async () => {
    const token = accessToken()
    if (!token || !user) return

    // ── 1. Jobs ──────────────────────────────────────────────────────────────
    try {
      const jobs = await fetchJobs(token)
      const seen = jobSeenRef.current
      for (const job of jobs) {
        const prev = seen.get(job.id)
        if (prev !== undefined && isActive(prev) && isTerminal(job.status)) {
          const label = job.name ?? job.id.slice(0, 8)
          push({
            category: 'job',
            title: job.status === 'completed' ? 'Job completed' : 'Job failed',
            body: `"${label}" ${job.status === 'completed' ? 'finished successfully' : 'encountered an error'}`,
            type: job.status === 'completed' ? 'success' : 'error',
          })
        }
        seen.set(job.id, job.status)
      }
    } catch { /* ignore */ }

    // ── 2. Change requests ───────────────────────────────────────────────────
    try {
      const orgs = await fetchOrgs(token)
      const crSeen = crSeenRef.current
      const notifiedNew = notifiedNewCRsRef.current

      for (const org of orgs) {
        const isReviewer = org.role === 'owner' || org.role === 'reviewer'
        const crs = await fetchCRsForOrg(token, org.id)

        for (const cr of crs) {
          const prev = crSeen.get(cr.id)

          const crLink = `/changes?org=${org.id}&cr=${cr.id}`

          // ── New pending CR → notify reviewer/owner (anyone but the submitter themselves)
          if (
            isReviewer &&
            cr.user_id !== user.id &&
            cr.status === 'pending' &&
            !notifiedNew.has(cr.id)
          ) {
            notifiedNew.add(cr.id)
            const seen = [...notifiedNew]
            localStorage.setItem('datrix_notif_cr_seen', JSON.stringify(seen))
            push({
              category: 'workspace',
              color: cr.user_color ?? undefined,
              title: `${cr.user_name ?? 'Someone'} requested a change`,
              body: `"${cr.title}" · ${IMPACT_LABELS[cr.impact] ?? cr.impact}`,
              type: 'info',
              link: crLink,
            })
          }

          // ── My own CR status changed → notify me (the submitter)
          if (cr.user_id === user.id && prev !== undefined && prev === 'pending') {
            if (cr.status === 'approved') {
              push({
                category: 'workspace',
                title: 'Change approved',
                body: cr.reviewer_comment
                  ? `"${cr.title}" — ${cr.reviewer_comment}`
                  : `"${cr.title}" was approved`,
                type: 'success',
                link: crLink,
              })
            } else if (cr.status === 'auto_approved') {
              push({
                category: 'workspace',
                title: 'Change auto-approved',
                body: `"${cr.title}" was automatically approved after 24 hours`,
                type: 'success',
                link: crLink,
              })
            } else if (cr.status === 'rejected') {
              push({
                category: 'workspace',
                title: 'Change rejected',
                body: cr.reviewer_comment
                  ? `"${cr.title}" — ${cr.reviewer_comment}`
                  : `"${cr.title}" was rejected`,
                type: 'error',
                link: crLink,
              })
            }
          }

          // ── Approved CR rolled back → notify submitter
          if (
            cr.user_id === user.id &&
            prev !== undefined &&
            (prev === 'approved' || prev === 'auto_approved') &&
            cr.status === 'rolled_back'
          ) {
            push({
              category: 'workspace',
              title: 'Approval rolled back',
              body: cr.rollback_comment
                ? `"${cr.title}" — ${cr.rollback_comment}`
                : `"${cr.title}" was rolled back`,
              type: 'error',
              link: crLink,
            })
          }

          crSeen.set(cr.id, cr.status)
        }
      }
    } catch { /* ignore */ }
  }, [accessToken, user, push])

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
