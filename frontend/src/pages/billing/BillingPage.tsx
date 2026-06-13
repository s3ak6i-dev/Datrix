import { useState, useEffect } from 'react'
import { Check, Zap, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import './BillingPage.css'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

interface Plan {
  plan: string
  datasets_used: number
  datasets_limit: number
  pipelines_used: number
  pipelines_limit: number
  storage_used_mb: number
  storage_limit_mb: number
  features: string[]
}

const PRO_FEATURES = [
  'Unlimited datasets',
  'Unlimited pipelines',
  '50 GB storage',
  'Team collaboration',
  'Priority support',
  'API access',
  'Advanced compliance reports',
  'Custom integrations',
]

const ENT_FEATURES = [
  'Everything in Pro',
  'SSO / SAML',
  'Audit logs (90 day)',
  'Role-based access control',
  'Dedicated support',
  'SLA guarantee',
  'On-premise deployment',
]

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = Math.min((used / limit) * 100, 100)
  const warn = pct > 80
  return (
    <div className="billing-usage-item">
      <div className="billing-usage-top">
        <span>{label}</span>
        <span style={{ color: warn ? 'var(--warn)' : 'var(--text-secondary)' }}>{used} / {limit}</span>
      </div>
      <div className="billing-usage-track">
        <div
          className="billing-usage-fill"
          style={{ width: `${pct}%`, background: warn ? 'var(--warn)' : 'var(--accent)' }}
        />
      </div>
    </div>
  )
}

export default function BillingPage() {
  const { accessToken } = useAuth()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = accessToken()
    if (!token) return
    fetch(`${BASE}/billing/plan`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setPlan)
      .finally(() => setLoading(false))
  }, [accessToken])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  return (
    <div className="billing-page">
      <h1>Billing & Plan</h1>
      <p className="billing-sub">You're on the <strong>Free</strong> plan. Upgrade anytime to unlock more.</p>

      {/* Current usage */}
      {plan && (
        <div className="billing-section">
          <p className="billing-section-title">Current usage</p>
          <UsageBar used={plan.datasets_used} limit={plan.datasets_limit} label="Datasets" />
          <UsageBar used={plan.pipelines_used} limit={plan.pipelines_limit} label="Pipelines" />
          <UsageBar used={plan.storage_used_mb} limit={plan.storage_limit_mb} label="Storage (MB)" />
        </div>
      )}

      {/* Plan cards */}
      <div className="billing-plans">
        {/* Free */}
        <div className="billing-plan-card current">
          <div className="billing-plan-badge">Current plan</div>
          <div className="billing-plan-name">Free</div>
          <div className="billing-plan-price">$0<span>/mo</span></div>
          <div className="billing-plan-desc">Everything you need to get started.</div>
          <ul className="billing-feature-list">
            {(plan?.features ?? []).map(f => (
              <li key={f}><Check size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />{f}</li>
            ))}
          </ul>
        </div>

        {/* Pro */}
        <div className="billing-plan-card pro">
          <div className="billing-plan-badge pro">Most popular</div>
          <div className="billing-plan-name">Pro</div>
          <div className="billing-plan-price">$29<span>/mo</span></div>
          <div className="billing-plan-desc">For teams who need more scale and power.</div>
          <ul className="billing-feature-list">
            {PRO_FEATURES.map(f => (
              <li key={f}><Check size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />{f}</li>
            ))}
          </ul>
          <button className="billing-upgrade-btn">
            <Zap size={14} /> Upgrade to Pro
          </button>
        </div>

        {/* Enterprise */}
        <div className="billing-plan-card ent">
          <div className="billing-plan-name">Enterprise</div>
          <div className="billing-plan-price">Custom</div>
          <div className="billing-plan-desc">For organizations with advanced security and compliance needs.</div>
          <ul className="billing-feature-list">
            {ENT_FEATURES.map(f => (
              <li key={f}><Check size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />{f}</li>
            ))}
          </ul>
          <button className="billing-contact-btn">Contact sales</button>
        </div>
      </div>

      <p className="billing-note">
        Payments are not yet enabled. Upgrade options will be available soon.
      </p>
    </div>
  )
}
