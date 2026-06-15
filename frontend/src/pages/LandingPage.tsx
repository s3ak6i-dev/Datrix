import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import * as THREE from 'three'
import { gsap, ScrollTrigger } from 'gsap/all'
import './LandingPage.css'

export default function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const scriptsRef = useRef<HTMLScriptElement[]>([])
  const mountedRef = useRef(false)

  // Authenticated users go straight to the app
  useEffect(() => {
    if (user) navigate('/datasets', { replace: true })
  }, [user, navigate])

  // Set body data-attributes expected by the landing scripts
  useEffect(() => {
    const prev = {
      anim: document.body.getAttribute('data-anim'),
      cursorglow: document.body.getAttribute('data-cursorglow'),
      spotlight: document.body.getAttribute('data-spotlight'),
      tilt: document.body.getAttribute('data-tilt'),
      magnetic: document.body.getAttribute('data-magnetic'),
    }
    document.body.setAttribute('data-anim', 'on')
    document.body.setAttribute('data-cursorglow', 'on')
    document.body.setAttribute('data-spotlight', 'on')
    document.body.setAttribute('data-tilt', 'on')
    document.body.setAttribute('data-magnetic', 'on')
    return () => {
      Object.entries(prev).forEach(([k, v]) => {
        if (v === null) document.body.removeAttribute(`data-${k}`)
        else document.body.setAttribute(`data-${k}`, v)
      })
    }
  }, [])

  // Expose libs on window then load datrix-landing.js
  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true

    ;(window as any).THREE = THREE
    ;(window as any).gsap = gsap
    ;(window as any).ScrollTrigger = ScrollTrigger

    const added: HTMLScriptElement[] = []

    const addScript = (src: string) =>
      new Promise<void>((resolve) => {
        const s = document.createElement('script')
        s.src = src
        s.onload = () => resolve()
        s.onerror = () => { console.warn('Landing script failed:', src); resolve() }
        document.body.appendChild(s)
        added.push(s)
        scriptsRef.current = added
      })

    addScript('/datrix-landing.js').catch(console.error)

    return () => {
      scriptsRef.current.forEach(s => { try { s.remove() } catch {} })
      try { (window as any).ScrollTrigger?.getAll().forEach((t: any) => t.kill()) } catch {}
      try { (window as any).gsap?.globalTimeline.clear() } catch {}
      delete (window as any).THREE
      delete (window as any).gsap
      delete (window as any).ScrollTrigger
    }
  }, [])

  const goRegister = () => navigate('/login?mode=register')
  const goLogin = () => navigate('/login')
  const setFeature = (i: number) => (window as any).setFeature?.(i)

  return (
    <>
      <div id="cursor-glow" />

      {/* NAV */}
      <nav>
        <a href="/" className="nav-logo">
          <span className="nav-logo-dot" />
          <span id="brandName">Datrix</span>
        </a>
        <ul className="nav-links">
          <li><a href="#how">How it works</a></li>
          <li><a href="#features">Platform</a></li>
          <li><a href="#integrations">Integrations</a></li>
          <li><a href="#security">Security</a></li>
          <li><a href="#" style={{ color: 'var(--text-secondary)' }}>Docs</a></li>
        </ul>
        <div className="nav-actions">
          <button onClick={goLogin} className="nav-demo">Sign in</button>
          <button onClick={goRegister} className="nav-cta" id="navCta">Get started</button>
        </div>
      </nav>

      {/* HERO */}
      <div className="hero">
        <canvas id="hero-canvas" data-parallax data-px-speed="0.18" />
        <div className="hero-inner" data-parallax data-px-speed="-0.12">
          <h1 className="hero-title" id="heroTitle" data-reveal>
            Your model is only as good<br />as <strong>your data</strong>
          </h1>
          <p className="hero-sub" id="heroSub" data-reveal>
            Datrix is the intelligence layer that sits beneath every AI system — scanning, cleaning, enriching, and continuously improving the data that drives your models.
          </p>
          <div className="hero-actions" data-reveal>
            <button onClick={goRegister} className="btn-primary" id="heroCta">Start free trial</button>
            <button onClick={goLogin} className="btn-secondary">Sign in</button>
          </div>
          <div className="hero-trust" data-reveal>
            <span><b>SOC&nbsp;2 Type&nbsp;II</b></span><span className="sep" /><span><b>ISO&nbsp;27001</b></span><span className="sep" /><span><b>GDPR</b> &amp; <b>HIPAA</b></span><span className="sep" /><span><b>99.99%</b> uptime SLA</span>
          </div>
        </div>
      </div>

      {/* QUALITY SCORE DEMO */}
      <div className="score-strip">
        <div className="score-card" data-reveal>
          <div className="score-header">
            <div className="score-header-left">
              <span className="dot dot-red" /><span className="dot dot-yellow" /><span className="dot dot-green" />
              <span className="score-header-title">datrix — quality scan — training_dataset_v3.parquet</span>
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>scan complete · 4.2s</span>
          </div>
          <div className="score-metrics">
            {[
              { label: 'Overall', val: 74, cls: 'good' },
              { label: 'Completeness', val: 89, cls: '' },
              { label: 'Consistency', val: 61, cls: 'warn' },
              { label: 'Bias score', val: 58, cls: 'warn' },
              { label: 'Label quality', val: 81, cls: '' },
            ].map(m => (
              <div className="score-metric" key={m.label}>
                <p className="metric-label">{m.label}</p>
                <p className={`metric-value${m.cls ? ' ' + m.cls : ''}`} data-count={m.val}>0</p>
                <div className="metric-bar"><div className={`metric-bar-fill${m.cls ? ' ' + m.cls : ''}`} data-w={m.val} /></div>
              </div>
            ))}
          </div>
          <div className="score-footer">
            <span className="score-footer-left">↑ Fix top 3 issues → estimated +18 points · +12% model accuracy</span>
            <span className="score-badge">✓ 1.2M rows scanned</span>
          </div>
        </div>
      </div>

      {/* TRUST BAR */}
      <section className="trustbar">
        <div className="section-inner trustbar-inner">
          <p className="trust-label">Trusted by data &amp; ML teams at fast-scaling companies</p>
          <div className="logo-row">
            {[
              { name: 'Northwind', cls: '' },
              { name: 'Vellum', cls: 'round' },
              { name: 'Apex Labs', cls: 'dia' },
              { name: 'Cohort', cls: '' },
              { name: 'Lumen AI', cls: 'round' },
              { name: 'Sift', cls: 'dia' },
            ].map(l => (
              <span className="logo-word" key={l.name}>
                <span className={`logo-glyph${l.cls ? ' ' + l.cls : ''}`} />{l.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how">
        <div className="section-inner">
          <p className="section-label" data-reveal>How it works</p>
          <h2 className="section-title" data-reveal>From raw data to <strong>model-ready</strong> in minutes</h2>
          <p className="section-body" data-reveal>Connect any data source. Datrix handles the rest — automatically, continuously, and with full transparency on every change made.</p>
          <div className="how-grid">
            {[
              { n: '01', icon: '⬡', title: 'Connect your data', body: 'Plug in any source — databases, files, APIs, streams. Datrix ingests everything and normalises it into a unified schema automatically.' },
              { n: '02', icon: '◈', title: 'Scan and score', body: 'Every dataset gets a quality score across five dimensions. Issues are ranked by their estimated impact on your model — not just flagged.' },
              { n: '03', icon: '◎', title: 'Fix and ship', body: 'Auto-fix what can be fixed. Review what needs judgment. Export model-ready data directly to your training infrastructure in any format.' },
            ].map(s => (
              <div className="how-step" data-reveal key={s.n}>
                <p className="step-number">{s.n}</p>
                <div className="step-icon">{s.icon}</div>
                <h3 className="step-title">{s.title}</h3>
                <p className="step-body">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--border)' }}>
        <div className="section-inner">
          <p className="section-label" data-reveal>Platform capabilities</p>
          <h2 className="section-title" data-reveal>Everything your data needs. <strong>Nothing it doesn't.</strong></h2>
          <div className="features-layout">
            <div className="feature-list" id="feature-list" data-reveal>
              {[
                { title: 'Quality Engine', body: 'Deep statistical analysis across completeness, consistency, accuracy, distribution, and bias — with quantified model impact per issue.' },
                { title: 'Pipeline Builder', body: 'Describe your AI task in plain English. Datrix builds the full data pipeline — ingestion to model-ready output — in under two minutes.' },
                { title: 'Synthetic Data Engine', body: 'Fill class imbalances, cover edge cases, and augment scarce data with statistically validated synthetic examples across text, tabular, and time-series.' },
                { title: 'Active Learning Loop', body: 'Identify exactly which unlabeled examples will move your model most. Reduce annotation cost by 50% while improving accuracy faster.' },
                { title: 'Compliance Autopilot', body: 'GDPR, EU AI Act, HIPAA, SOC 2 — monitored continuously. Audit reports generated automatically. Zero manual compliance work.' },
              ].map((f, i) => (
                <div className={`feature-item${i === 0 ? ' active' : ''}`} onClick={() => setFeature(i)} key={f.title}>
                  <p className="feature-item-title">{f.title}</p>
                  <p className="feature-item-body">{f.body}</p>
                </div>
              ))}
            </div>
            <div className="feature-preview" id="feature-preview" data-reveal>
              <p className="preview-label">Quality Engine — live scan</p>
              {[
                ['Null rate (label col)', '8.3% ↑', 'bad'],
                ['Class imbalance ratio', '1:480', 'warn'],
                ['Near-duplicate rows', '2,841', 'warn'],
                ['Label noise estimate', '6.1%', 'bad'],
                ['Date format consistency', '100%', 'good'],
                ['Est. accuracy gain (if fixed)', '+14.2%', 'good'],
              ].map(([name, val, cls]) => (
                <div className="preview-stat" key={name}>
                  <span className="preview-stat-name">{name}</span>
                  <span className={`preview-stat-val val-${cls}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section id="integrations">
        <div className="section-inner">
          <p className="section-label" data-reveal>Integrations</p>
          <h2 className="section-title" data-reveal>Drops into the stack you <strong>already run</strong></h2>
          <p className="section-body" data-reveal>Native connectors for every major warehouse, lake, and ML platform. No rip-and-replace — Datrix reads and writes where your data already lives.</p>
          <div className="integ-grid">
            {[
              { icon: '❄', name: 'Snowflake' }, { icon: '◰', name: 'Databricks' }, { icon: '▦', name: 'BigQuery' },
              { icon: '▤', name: 'Amazon S3' }, { icon: '◑', name: 'Postgres' }, { icon: '≋', name: 'Kafka' },
              { icon: '◇', name: 'Hugging Face' }, { icon: '⟲', name: 'Airflow' }, { icon: '◵', name: 'dbt' }, { icon: '✦', name: 'Spark' },
            ].map(t => (
              <div className="integ-tile" data-reveal key={t.name}>
                <span className="integ-glyph">{t.icon}</span>
                <span className="integ-name">{t.name}</span>
              </div>
            ))}
          </div>
          <p className="integ-foot" data-reveal>Plus a typed REST API + Python SDK. <a href="#">Browse all integrations →</a></p>
        </div>
      </section>

      {/* WHY */}
      <section id="why">
        <div className="section-inner">
          <p className="section-label" data-reveal>Why Datrix</p>
          <h2 className="section-title" data-reveal>The gap no one else fills</h2>
          <p className="section-body" data-reveal>Every AI team rebuilds the same data infrastructure from scratch. Datrix ends that — permanently.</p>
          <div className="stats-row">
            {[
              { count: 60, suffix: '%', desc: 'of AI engineering time spent on data prep, not model work' },
              { count: 10, suffix: '×', desc: 'model accuracy gain from data quality vs architecture changes' },
              { count: 2, suffix: 'min', desc: 'to build a full data pipeline from a plain English description' },
              { count: 50, suffix: '%', desc: 'reduction in annotation cost with active learning selection' },
            ].map(s => (
              <div className="stat-cell" data-reveal key={s.desc}>
                <p className="stat-number"><span className="cu" data-count={s.count}>0</span><span>{s.suffix}</span></p>
                <p className="stat-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section id="security" style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--border)' }}>
        <div className="section-inner security-layout">
          <div>
            <p className="section-label" data-reveal>Security &amp; governance</p>
            <h2 className="section-title" data-reveal>Built for the <strong>most regulated</strong> teams</h2>
            <p className="section-body" data-reveal>Your data never leaves your control. Datrix runs in your cloud or ours, with end-to-end encryption and a complete audit trail on every transformation.</p>
            <ul className="sec-points">
              {[
                ['Encryption everywhere', 'AES-256 at rest, TLS 1.3 in transit, customer-managed keys.'],
                ['Granular RBAC & SSO', 'SAML, SCIM provisioning, and row-level access policies.'],
                ['Immutable audit logs', 'every scan, fix, and export recorded and exportable.'],
                ['Data residency', 'pin processing to US, EU, or your own VPC / on-prem.'],
              ].map(([bold, rest]) => (
                <li data-reveal key={bold}>
                  <span className="sec-check">✓</span>
                  <span><b>{bold}</b> — {rest}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="badge-grid" data-reveal>
            {[
              { ring: 'SOC', name: 'SOC 2 Type II', desc: 'audited annually' },
              { ring: 'ISO', name: 'ISO 27001', desc: 'certified' },
              { ring: 'GDPR', name: 'GDPR', desc: 'EU compliant' },
              { ring: 'HIPAA', name: 'HIPAA', desc: 'BAA available' },
              { ring: 'SSO', name: 'SSO / SAML', desc: 'SCIM provisioning' },
              { ring: 'SLA', name: '99.99% uptime', desc: 'enterprise SLA' },
            ].map(b => (
              <div className="badge-card" key={b.name}>
                <span className="badge-ring">{b.ring}</span>
                <span className="badge-name">{b.name}</span>
                <span className="badge-desc">{b.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CASE STUDIES */}
      <section style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--border)' }}>
        <div className="section-inner">
          <p className="section-label" data-reveal>Customer results</p>
          <h2 className="section-title" data-reveal>Outcomes teams can put on the board</h2>
          <p className="section-body" data-reveal>From first scan to production — here's what changed for teams running Datrix.</p>
          <div className="cases-grid">
            <div className="case-card" data-reveal>
              <p className="case-metric"><span className="pfx">+</span><span className="cu" data-count="9">0</span></p>
              <span className="case-unit">F1 points overnight</span>
              <p className="case-quote">"Datrix found a label-noise issue we'd had for six months and missed entirely. Fixing it moved our F1 score 9 points overnight."</p>
              <div className="case-foot"><span className="case-logo"><span className="logo-glyph" />Northwind</span><span className="case-role">· Head of ML</span></div>
            </div>
            <div className="case-card" data-reveal>
              <p className="case-metric"><span className="cu" data-count="100">0</span><span className="pfx">%</span></p>
              <span className="case-unit">of pipelines automated</span>
              <p className="case-quote">"We went from two engineers full-time on data pipelines to zero. That headcount went straight back into model research."</p>
              <div className="case-foot"><span className="case-logo"><span className="logo-glyph round" />Apex Labs</span><span className="case-role">· CTO</span></div>
            </div>
            <div className="case-card" data-reveal>
              <p className="case-metric"><span className="cu" data-count="3">0</span><span className="pfx" style={{ fontSize: '22px', marginLeft: '7px' }}>weeks</span></p>
              <span className="case-unit">to pass a GDPR audit</span>
              <p className="case-quote">"The compliance autopilot is what sold our legal team. We passed a GDPR audit in 3 weeks — that used to take months of prep."</p>
              <div className="case-foot"><span className="case-logo"><span className="logo-glyph dia" />Lumen AI</span><span className="case-role">· VP Engineering</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq">
        <div className="section-inner">
          <p className="section-label" data-reveal>FAQ</p>
          <h2 className="section-title" data-reveal>Questions, answered</h2>
          <div className="faq-list" data-reveal>
            {[
              ['How does Datrix deploy in our environment?', 'Run fully managed on Datrix Cloud, or deploy into your own VPC or on-prem cluster. In both modes your raw data stays inside your perimeter — Datrix processes it in place and only writes back model-ready outputs.'],
              ['What does onboarding look like?', 'Connect a source, run your first quality scan, and see ranked issues in under an hour. A solutions engineer is assigned to every enterprise account for migration, and most teams reach production within two weeks.'],
              ['How is pricing structured?', 'Self-serve plans are usage-based on rows scanned. Enterprise is an annual contract with volume pricing, SSO/SAML, dedicated support, and custom SLAs. Talk to sales for a quote tailored to your data volume.'],
              ['Do you train models on our data?', 'Never. Your data is yours. Datrix does not use customer data to train shared models, and customer-managed encryption keys mean we cannot read it without your authorization.'],
              ['Which data sources and formats are supported?', 'Warehouses (Snowflake, BigQuery, Redshift), lakes (S3, Databricks, GCS), databases (Postgres, MySQL), streams (Kafka, Kinesis), and files (Parquet, CSV, JSON, images, text). New connectors ship every release.'],
            ].map(([q, a]) => (
              <details className="faq-item" key={q}>
                <summary>{q}<span className="chev" /></summary>
                <p className="faq-answer">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section" id="waitlist">
        <div className="cta-inner">
          <h2 className="cta-title" data-reveal>Your AI is limited by<br />your data. <strong>Fix that.</strong></h2>
          <p className="cta-sub" data-reveal>Start free in minutes, or talk to our team about an enterprise rollout.</p>
          <div className="cta-actions" data-reveal>
            <button onClick={goRegister} className="btn-primary">Start free trial</button>
            <button onClick={goLogin} className="btn-ghost">Sign in</button>
          </div>
          <p className="cta-enterprise" data-reveal>Enterprise: SSO/SAML, on-prem &amp; VPC deployment, dedicated support, custom SLAs. <a href="#">See the enterprise plan →</a></p>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <div className="footer-grid">
            <div className="footer-brandcol">
              <span className="footer-logo"><span className="nav-logo-dot" /><span id="brandFoot">Datrix</span></span>
              <p className="footer-tagline">The intelligence layer beneath every AI system.</p>
              <span className="footer-status"><span className="status-dot" />All systems operational</span>
            </div>
            <div className="footer-col">
              <h4>Product</h4>
              <ul>
                <li><a href="#features">Platform</a></li>
                <li><a href="#integrations">Integrations</a></li>
                <li><a href="#security">Security</a></li>
                <li><a href="#">Pricing</a></li>
                <li><a href="#">Changelog</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Solutions</h4>
              <ul>
                <li><a href="#">Data quality</a></li>
                <li><a href="#">Synthetic data</a></li>
                <li><a href="#">Active learning</a></li>
                <li><a href="#">Compliance</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Resources</h4>
              <ul>
                <li><a href="#">Documentation</a></li>
                <li><a href="#">API reference</a></li>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Status</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Company</h4>
              <ul>
                <li><a href="#">About</a></li>
                <li><a href="#">Careers</a></li>
                <li><a href="#">Customers</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span className="footer-copy">© 2026 Datrix, Inc. · San Francisco, CA</span>
            <div className="footer-legal">
              <a href="#">Privacy</a><a href="#">Terms</a><a href="#">DPA</a><a href="#">Trust Center</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
