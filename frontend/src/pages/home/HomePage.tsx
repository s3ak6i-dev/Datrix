import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Check, Database, GitBranch, Zap, FlaskConical,
  Tag, Shield, BarChart2, Loader2, ChevronRight, GitPullRequest,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import './HomePage.css'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function authFetch(path: string, token: string, init?: RequestInit) {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
  }).then(r => r.ok ? r.json() : Promise.reject(r.statusText))
}

// ── Onboarding wizard ────────────────────────────────────────────────────────

const ROLES = [
  'Data Engineer', 'ML Engineer', 'Data Scientist', 'Data Analyst',
  'Product Manager', 'Researcher', 'Developer', 'Other',
]

const USE_CASES = [
  { id: 'clean',    label: 'Clean & validate data' },
  { id: 'synthetic', label: 'Generate synthetic data' },
  { id: 'benchmark', label: 'Benchmark ML models' },
  { id: 'label',    label: 'Label & annotate data' },
  { id: 'compliance', label: 'Compliance & privacy' },
  { id: 'pipeline', label: 'Build data pipelines' },
]

function StepTrack({ current, total }: { current: number; total: number }) {
  return (
    <div className="ob-step-track">
      {Array.from({ length: total }, (_, i) => (
        <>
          <div
            key={`dot-${i}`}
            className={`ob-step-dot ${i < current ? 'done' : i === current ? 'active' : ''}`}
          >
            {i < current ? <Check size={11} /> : i + 1}
          </div>
          {i < total - 1 && (
            <div key={`line-${i}`} className={`ob-step-line ${i < current ? 'done' : ''}`} />
          )}
        </>
      ))}
    </div>
  )
}

interface OnboardingWizardProps {
  onComplete: (profile: Profile) => void
}

function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [useCases, setUseCases] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const { accessToken } = useAuth()

  const toggleUseCase = (id: string) =>
    setUseCases(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const finish = async () => {
    setSaving(true)
    try {
      const token = accessToken()!
      const profile = await authFetch('/profile/me/complete-onboarding', token, {
        method: 'POST',
        body: JSON.stringify({ full_name: fullName.trim(), role, company: company.trim() || null, use_cases: useCases }),
      })
      onComplete(profile)
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="ob-shell">
      <div className="ob-card">
        <StepTrack current={step} total={3} />

        {step === 0 && (
          <>
            <p className="ob-eyebrow">Welcome to Datrix</p>
            <h2 className="ob-title">Hey there, what's your name?</h2>
            <p className="ob-sub">Let's personalize your experience. You can always update this later.</p>

            <div className="ob-field">
              <label className="ob-label" htmlFor="ob-name">Full name</label>
              <input
                id="ob-name"
                className="ob-input"
                placeholder="Jane Smith"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="ob-field">
              <label className="ob-label" htmlFor="ob-company">Company / team <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
              <input
                id="ob-company"
                className="ob-input"
                placeholder="Acme Corp"
                value={company}
                onChange={e => setCompany(e.target.value)}
              />
            </div>

            <div className="ob-actions">
              <button
                className="ob-btn-primary"
                disabled={fullName.trim().length < 1}
                onClick={() => setStep(1)}
              >
                Continue <ArrowRight size={15} />
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="ob-eyebrow">Step 2 of 3</p>
            <h2 className="ob-title">What's your role?</h2>
            <p className="ob-sub">We'll tailor your home dashboard to what matters most for your workflow.</p>

            <div className="ob-role-grid">
              {ROLES.map(r => (
                <button
                  key={r}
                  type="button"
                  className={`ob-role-opt${role === r ? ' sel' : ''}`}
                  onClick={() => setRole(r)}
                >
                  <span className="ob-role-dot" />
                  {r}
                </button>
              ))}
            </div>

            <div className="ob-actions">
              <button className="ob-btn-back" onClick={() => setStep(0)}>Back</button>
              <button
                className="ob-btn-primary"
                disabled={!role}
                onClick={() => setStep(2)}
              >
                Continue <ArrowRight size={15} />
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="ob-eyebrow">Step 3 of 3</p>
            <h2 className="ob-title">What will you use Datrix for?</h2>
            <p className="ob-sub">Select everything that applies — we'll highlight the right tools for you.</p>

            <div className="ob-use-grid">
              {USE_CASES.map(uc => (
                <button
                  key={uc.id}
                  type="button"
                  className={`ob-use-chip${useCases.includes(uc.id) ? ' sel' : ''}`}
                  onClick={() => toggleUseCase(uc.id)}
                >
                  {useCases.includes(uc.id) && <Check size={12} />}
                  {uc.label}
                </button>
              ))}
            </div>

            <div className="ob-actions">
              <button className="ob-btn-back" onClick={() => setStep(1)}>Back</button>
              <button
                className="ob-btn-primary"
                disabled={saving}
                onClick={finish}
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {saving ? 'Saving…' : "Let's go"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Home dashboard ───────────────────────────────────────────────────────────

interface Profile {
  user_id: string
  full_name: string | null
  role: string | null
  use_cases: string[]
  onboarding_completed: boolean
}

interface DatasetItem {
  id: string; name: string; status: string; created_at: string; row_count: number | null
}

interface ActivityItem {
  id: string
  org_id: string
  user_name: string | null
  user_color: string | null
  title: string
  status: string
  reviewed_at: string | null
  created_at: string
}

interface PipelineItem {
  id: string; name: string; status: string; created_at: string
}

function greeting(name: string | null) {
  const h = new Date().getHours()
  const tod = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  return name ? `Good ${tod}, ${name.split(' ')[0]}` : `Good ${tod}`
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const ACTION_MAP: Record<string, { label: string; sub: string; icon: React.ReactNode; path: string }> = {
  clean:      { label: 'Clean data',        sub: 'Fix issues in your datasets',  icon: <Database size={17} />,    path: '/datasets' },
  synthetic:  { label: 'Generate data',     sub: 'Create synthetic datasets',    icon: <FlaskConical size={17} />, path: '/synthetic' },
  benchmark:  { label: 'Run benchmark',     sub: 'Compare ML models',            icon: <BarChart2 size={17} />,   path: '/benchmark' },
  label:      { label: 'Label data',        sub: 'Active learning sessions',     icon: <Tag size={17} />,         path: '/active-learning' },
  compliance: { label: 'Compliance scan',   sub: 'Check privacy & policies',     icon: <Shield size={17} />,      path: '/compliance' },
  pipeline:   { label: 'Build pipeline',    sub: 'Automate data processing',     icon: <GitBranch size={17} />,   path: '/pipelines' },
}

const DEFAULT_ACTIONS = ['clean', 'pipeline', 'synthetic']

export default function HomePage() {
  const { accessToken } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [datasets, setDatasets] = useState<DatasetItem[]>([])
  const [pipelines, setPipelines] = useState<PipelineItem[]>([])
  const [jobCount, setJobCount] = useState(0)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  // Track home page visit for recently-used navigation
  useEffect(() => {
    const recent: string[] = JSON.parse(localStorage.getItem('datrix_recent') ?? '[]')
    const next = ['/home', ...recent.filter(p => p !== '/home')].slice(0, 5)
    localStorage.setItem('datrix_recent', JSON.stringify(next))
  }, [])

  useEffect(() => {
    const token = accessToken()
    if (!token) return

    Promise.all([
      authFetch('/profile/me', token),
      authFetch('/datasets', token).catch(() => []),
      authFetch('/pipelines', token).catch(() => []),
      authFetch('/synthetic/jobs', token).catch(() => []),
      authFetch('/orgs', token).catch(() => []),
    ]).then(async ([prof, ds, pl, jobs, orgs]) => {
      setProfile(prof)
      setDatasets(ds)
      setPipelines(pl)
      setJobCount(Array.isArray(jobs) ? jobs.length : 0)

      // Load recent team activity (approved + rolled_back) from first org
      if (Array.isArray(orgs) && orgs.length > 0) {
        const orgId = orgs[0].id
        const allChanges = await authFetch(`/changes?org_id=${orgId}`, token).catch(() => [])
        const filtered = Array.isArray(allChanges)
          ? allChanges.filter((c: ActivityItem) => c.status === 'approved' || c.status === 'auto_approved' || c.status === 'rolled_back')
          : []
        setActivity(filtered.slice(0, 6))
      }
    }).finally(() => setLoading(false))
  }, [accessToken])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  if (profile && !profile.onboarding_completed) {
    return <OnboardingWizard onComplete={p => setProfile(p)} />
  }

  const useCases = profile?.use_cases ?? []
  const actionKeys = useCases.length > 0
    ? useCases.filter(k => ACTION_MAP[k]).slice(0, 4)
    : DEFAULT_ACTIONS

  const hasDataset = datasets.length > 0
  const hasPipeline = pipelines.length > 0
  const allDone = hasDataset && hasPipeline

  return (
    <div className="home-page">
      {/* Greeting */}
      <div className="home-greeting">
        <h1>{greeting(profile?.full_name ?? null)}</h1>
        <p>Here's what's happening with your data workspace.</p>
      </div>

      {/* Stats */}
      <div className="home-stats">
        <div className="home-stat">
          <span className="home-stat-num">{datasets.length}</span>
          <span className="home-stat-label">Datasets</span>
        </div>
        <div className="home-stat">
          <span className="home-stat-num">{pipelines.length}</span>
          <span className="home-stat-label">Pipelines</span>
        </div>
        <div className="home-stat">
          <span className="home-stat-num">{jobCount}</span>
          <span className="home-stat-label">Jobs run</span>
        </div>
      </div>

      {/* Getting started checklist — hidden when all done */}
      {!allDone && (
        <div>
          <div className="home-section-header">
            <span className="home-section-title">Getting started</span>
          </div>
          <div className="home-checklist">
            <div className={`home-check-item${hasDataset ? ' done' : ''}`}>
              <div className="home-check-tick">{hasDataset && <Check size={11} />}</div>
              Upload your first dataset
            </div>
            <div className={`home-check-item${hasPipeline ? ' done' : ''}`}>
              <div className="home-check-tick">{hasPipeline && <Check size={11} />}</div>
              Create a data pipeline
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <div className="home-section-header">
          <span className="home-section-title">Quick actions</span>
        </div>
        <div className="home-actions">
          {actionKeys.map(key => {
            const a = ACTION_MAP[key]
            if (!a) return null
            return (
              <button key={key} className="home-action-card" onClick={() => navigate(a.path)}>
                <div className="home-action-icon">{a.icon}</div>
                <div>
                  <div className="home-action-label">{a.label}</div>
                  <div className="home-action-sub">{a.sub}</div>
                </div>
              </button>
            )
          })}
          <button className="home-action-card" onClick={() => navigate('/marketplace')}>
            <div className="home-action-icon"><Zap size={17} /></div>
            <div>
              <div className="home-action-label">Marketplace</div>
              <div className="home-action-sub">Browse templates & datasets</div>
            </div>
          </button>
        </div>
      </div>

      {/* Team activity feed */}
      {activity.length > 0 && (
        <div>
          <div className="home-section-header">
            <span className="home-section-title">Team activity</span>
            <button className="home-see-all" onClick={() => navigate('/changes')}>
              View board <ChevronRight size={11} style={{ verticalAlign: 'middle' }} />
            </button>
          </div>
          <div className="home-activity-list">
            {activity.map(item => {
              const isRolledBack = item.status === 'rolled_back'
              return (
                <div
                  key={item.id}
                  className="home-activity-item clickable"
                  onClick={() => navigate(`/changes?org=${item.org_id}&cr=${item.id}`)}
                >
                  <div
                    className="home-activity-dot"
                    style={{ background: item.user_color ?? '#64748b', opacity: isRolledBack ? 0.5 : 1 }}
                    title={item.user_name ?? undefined}
                  >
                    {(item.user_name ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="home-activity-body">
                    <span className="home-activity-name" style={{ opacity: isRolledBack ? 0.6 : 1 }}>
                      {item.user_name ?? 'Someone'}
                    </span>
                    <span className="home-activity-action" style={{ opacity: isRolledBack ? 0.6 : 1, textDecoration: isRolledBack ? 'line-through' : 'none' }}>
                      <GitPullRequest size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                      {item.title}
                    </span>
                    {isRolledBack && (
                      <span className="home-activity-rolled-back">rolled back</span>
                    )}
                  </div>
                  <span className="home-activity-time">
                    {relTime(item.reviewed_at ?? item.created_at)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent datasets + pipelines */}
      <div className="home-two-col">
        {/* Datasets */}
        <div>
          <div className="home-section-header">
            <span className="home-section-title">Recent datasets</span>
            <button className="home-see-all" onClick={() => navigate('/datasets')}>
              See all <ChevronRight size={11} style={{ verticalAlign: 'middle' }} />
            </button>
          </div>
          <div className="home-card-list">
            {datasets.length === 0 ? (
              <div className="home-empty">No datasets yet — upload one to get started.</div>
            ) : (
              datasets.slice(0, 3).map(ds => (
                <div key={ds.id} className="home-card-item" onClick={() => navigate(`/datasets/${ds.id}`)}>
                  <div className="home-card-icon"><Database size={14} /></div>
                  <div className="home-card-info">
                    <div className="home-card-name">{ds.name}</div>
                    <div className="home-card-meta">
                      {ds.row_count != null ? `${ds.row_count.toLocaleString()} rows · ` : ''}{relTime(ds.created_at)}
                    </div>
                  </div>
                  <span className={`home-card-badge ${ds.status}`}>{ds.status}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pipelines */}
        <div>
          <div className="home-section-header">
            <span className="home-section-title">Recent pipelines</span>
            <button className="home-see-all" onClick={() => navigate('/pipelines')}>
              See all <ChevronRight size={11} style={{ verticalAlign: 'middle' }} />
            </button>
          </div>
          <div className="home-card-list">
            {pipelines.length === 0 ? (
              <div className="home-empty">No pipelines yet — create one to automate your workflow.</div>
            ) : (
              pipelines.slice(0, 3).map(pl => (
                <div key={pl.id} className="home-card-item" onClick={() => navigate(`/pipelines/${pl.id}`)}>
                  <div className="home-card-icon"><GitBranch size={14} /></div>
                  <div className="home-card-info">
                    <div className="home-card-name">{pl.name}</div>
                    <div className="home-card-meta">{relTime(pl.created_at)}</div>
                  </div>
                  <span className={`home-card-badge ${pl.status}`}>{pl.status}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
