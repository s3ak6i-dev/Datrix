import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  CheckCircle2, Zap, AlertCircle, Eye,
  ChevronRight, RotateCcw, HelpCircle, AlertTriangle,
} from 'lucide-react'
import { api } from '@/lib/api'
import { SeverityBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { QualityIssue, CleaningFix } from '@/types'

interface Props {
  datasetId: string
  issues: QualityIssue[]
  initialIssue?: QualityIssue | null
  onComplete: () => void
}

interface ManualOption {
  label: string
  description: string
  method: string
  caution?: string
  recommended?: boolean
}

interface ManualGuidance {
  why: string
  options: ManualOption[]
}

const MANUAL_GUIDANCE: Record<string, ManualGuidance> = {
  class_imbalance: {
    why: "A model trained on this data learns to predict the dominant class almost exclusively and still achieves high accuracy — while completely ignoring the rare class. Real-world metrics like F1, AUC-ROC, and recall on the minority class will be near zero, making the model useless for detecting the thing you care about.",
    options: [
      {
        label: 'Oversample minority class',
        description: 'Randomly duplicate rows from the minority class until the ratio is closer to 1:1. Non-destructive — no original data is removed. Best when you have limited data.',
        method: 'oversample',
        recommended: true,
      },
      {
        label: 'Undersample majority class',
        description: 'Randomly remove rows from the dominant class to match the minority count. Creates a perfectly balanced dataset at the cost of discarding real observations.',
        method: 'undersample',
        caution: 'This will significantly reduce your total row count.',
      },
    ],
  },
}

const FIX_METHOD_LABEL: Record<string, string> = {
  null_values: 'Mean / mode imputation',
  null_labels: 'Mode imputation',
  duplicate_rows: 'Remove exact duplicates',
  mixed_case: 'Lowercase standardisation',
  outliers: 'Winsorise (IQR 3× fence)',
}

export function CleaningWizard({ datasetId, issues, initialIssue, onComplete }: Props) {
  const autoFixable = issues.filter((i) => i.fix_available)
  const manualIssues = issues.filter((i) => !i.fix_available)

  const defaultSelected =
    initialIssue?.id ??
    autoFixable[0]?.id ??
    manualIssues[0]?.id ??
    null

  const [selectedId, setSelectedId] = useState<string | null>(defaultSelected)
  const [resolved, setResolved] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<CleaningFix | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [applyingMethod, setApplyingMethod] = useState<string | null>(null)

  const selectedIssue = issues.find((i) => i.id === selectedId) ?? null
  const isManualSelected = selectedIssue != null && !selectedIssue.fix_available

  const unresolvedAuto = autoFixable.filter((i) => !resolved.has(i.id))
  const allAutoResolved = autoFixable.length > 0 && resolved.size === autoFixable.length
  const totalGain = autoFixable.reduce((s, i) => s + i.impact_score, 0)
  const resolvedGain = autoFixable
    .filter((i) => resolved.has(i.id))
    .reduce((s, i) => s + i.impact_score, 0)
  const progress = autoFixable.length > 0 ? resolved.size / autoFixable.length : 0

  const previewMutation = useMutation({
    mutationFn: (issueId: string) => api.cleaning.preview(datasetId, [issueId]),
    onSuccess: (fixes) => setPreview(fixes[0] ?? null),
    onError: (e) => setError(e instanceof Error ? e.message : 'Preview failed'),
  })

  const applyMutation = useMutation({
    mutationFn: ({ issueId, options }: { issueId: string; options?: Record<string, string> }) =>
      api.cleaning.apply(datasetId, [issueId], options),
    onSuccess: (_, { issueId }) => {
      const wasAuto = autoFixable.some((i) => i.id === issueId)
      if (wasAuto) {
        const next = unresolvedAuto.find((i) => i.id !== issueId)
        setResolved((r) => new Set([...r, issueId]))
        setPreview(null)
        setError(null)
        setApplyingMethod(null)
        if (next) setSelectedId(next.id)
      } else {
        // Manual fix applied — re-scan immediately
        onComplete()
      }
    },
    onError: (e) => {
      setError(e instanceof Error ? e.message : 'Fix failed')
      setApplyingMethod(null)
    },
  })

  const applyAllMutation = useMutation({
    mutationFn: () => api.cleaning.apply(datasetId, autoFixable.map((i) => i.id)),
    onSuccess: () => {
      setResolved(new Set(autoFixable.map((i) => i.id)))
      if (manualIssues.length === 0) onComplete()
      else setSelectedId(manualIssues[0].id)
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Fix all failed'),
  })

  // ── Empty state ───────────────────────────────────────────────────
  if (issues.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', textAlign: 'center' }}>
        <CheckCircle2 style={{ width: 40, height: 40, color: 'var(--green)', marginBottom: 12 }} />
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>No open issues</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-sans)' }}>Dataset has no open issues</p>
      </div>
    )
  }

  // ── Main layout ───────────────────────────────────────────────────
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 20 }}>

      {/* ── Left: issue list ──────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Progress (auto issues only) */}
        {autoFixable.length > 0 && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
                {resolved.size} / {autoFixable.length} auto-fixes applied
              </span>
              <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                +{resolvedGain.toFixed(1)} / +{totalGain.toFixed(1)} pts
              </span>
            </div>
            <div style={{ height: 8, background: 'var(--bg-inset)', borderRadius: 9999, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  background: 'var(--green)',
                  borderRadius: 9999,
                  width: `${progress * 100}%`,
                  transition: 'width 500ms ease',
                }}
              />
            </div>
            {allAutoResolved && manualIssues.length > 0 && (
              <p style={{ fontSize: 11, color: 'var(--green)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-sans)' }}>
                <CheckCircle2 style={{ width: 12, height: 12 }} />
                All auto-fixes done — review manual issues below
              </p>
            )}
          </div>
        )}

        {/* Fix all (only when unresolved auto issues remain) */}
        {unresolvedAuto.length > 1 && (
          <Button
            style={{ width: '100%' }}
            loading={applyAllMutation.isPending}
            onClick={() => applyAllMutation.mutate()}
          >
            <Zap style={{ width: 16, height: 16 }} />
            Fix all {unresolvedAuto.length} auto-fixable
          </Button>
        )}

        {/* Issue list */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>

          {/* Auto-fixable section header */}
          {autoFixable.length > 0 && manualIssues.length > 0 && (
            <div style={{ padding: '8px 16px', background: 'var(--bg-inset)', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 400 }}>
                Auto-fixable ({autoFixable.length})
              </p>
            </div>
          )}

          {autoFixable.map((issue) => {
            const isResolved = resolved.has(issue.id)
            const isActive = selectedId === issue.id
            return (
              <button
                key={issue.id}
                onClick={() => { setSelectedId(issue.id); setPreview(null) }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 16px',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--border)',
                  background: isActive && !isResolved ? 'var(--blue-tint)' : isResolved ? 'transparent' : 'transparent',
                  opacity: isResolved ? 0.5 : 1,
                  cursor: isResolved ? 'default' : 'pointer',
                  transition: 'background 0.15s',
                  fontFamily: 'var(--font-sans)',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => { if (!isResolved && !isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-inset)' }}
                onMouseLeave={(e) => { if (!isResolved && !isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  {isResolved ? (
                    <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--green)' }} />
                  ) : (
                    <div style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      border: isActive ? '2px solid var(--accent)' : '2px solid var(--border)',
                      background: isActive ? 'var(--accent)' : 'transparent',
                    }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <SeverityBadge severity={issue.severity} />
                    {issue.column_name && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {issue.column_name}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>{issue.description}</p>
                </div>
                {isActive && !isResolved && (
                  <ChevronRight style={{ width: 16, height: 16, color: 'var(--accent)', flexShrink: 0, marginTop: 4 }} />
                )}
              </button>
            )
          })}

          {/* Manual review section header */}
          {manualIssues.length > 0 && (
            <div style={{ padding: '8px 16px', background: 'var(--bg-inset)', borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 400 }}>
                Manual review ({manualIssues.length})
              </p>
            </div>
          )}

          {manualIssues.map((issue) => {
            const isActive = selectedId === issue.id
            return (
              <button
                key={issue.id}
                onClick={() => setSelectedId(issue.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 16px',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--border)',
                  background: isActive ? 'var(--warn-dim)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  fontFamily: 'var(--font-sans)',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-inset)' }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                <HelpCircle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2, color: isActive ? 'var(--warn)' : 'var(--text-tertiary)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <SeverityBadge severity={issue.severity} />
                    {issue.column_name && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {issue.column_name}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>{issue.description}</p>
                </div>
                {isActive && <ChevronRight style={{ width: 16, height: 16, color: 'var(--warn)', flexShrink: 0, marginTop: 4 }} />}
              </button>
            )
          })}
        </div>

        {/* Re-scan CTA — shown when all auto done and no manual */}
        {allAutoResolved && manualIssues.length === 0 && (
          <Button onClick={onComplete}>
            Re-scan to see updated score →
          </Button>
        )}
      </div>

      {/* ── Right: detail / guidance panel ───────────────────────── */}
      <div>
        {isManualSelected && selectedIssue ? (
          <ManualGuidancePanel
            issue={selectedIssue}
            applyingMethod={applyingMethod}
            error={error}
            onApply={(issueId, method) => {
              setApplyingMethod(method)
              setError(null)
              applyMutation.mutate({ issueId, options: { method } })
            }}
          />
        ) : selectedIssue && !resolved.has(selectedIssue.id) ? (
          <AutoFixPanel
            issue={selectedIssue}
            issueIndex={autoFixable.findIndex((i) => i.id === selectedIssue.id)}
            totalAuto={autoFixable.length}
            preview={preview}
            error={error}
            previewPending={previewMutation.isPending}
            applyPending={applyMutation.isPending}
            onPreview={() => previewMutation.mutate(selectedIssue.id)}
            onApply={() => applyMutation.mutate({ issueId: selectedIssue.id })}
            onSkip={() => {
              const next = unresolvedAuto.find((i) => i.id !== selectedIssue.id)
              if (next) { setSelectedId(next.id); setPreview(null) }
              else if (manualIssues.length > 0) setSelectedId(manualIssues[0].id)
              else onComplete()
            }}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 192, color: 'var(--text-tertiary)', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
            Select an issue on the left.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Auto-fix detail panel ─────────────────────────────────────────────

interface AutoFixPanelProps {
  issue: QualityIssue
  issueIndex: number
  totalAuto: number
  preview: CleaningFix | null
  error: string | null
  previewPending: boolean
  applyPending: boolean
  onPreview: () => void
  onApply: () => void
  onSkip: () => void
}

function AutoFixPanel({
  issue, issueIndex, totalAuto, preview, error,
  previewPending, applyPending, onPreview, onApply, onSkip,
}: AutoFixPanelProps) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-inset)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 400, marginBottom: 2 }}>
            Issue {issueIndex + 1} of {totalAuto}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SeverityBadge severity={issue.severity} />
            {issue.column_name && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>{issue.column_name}</span>
            )}
          </div>
        </div>
        {issue.impact_score > 0 && (
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>Est. accuracy gain</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--green)', fontFamily: 'var(--font-sans)' }}>+{issue.impact_score.toFixed(1)}%</p>
          </div>
        )}
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4, fontFamily: 'var(--font-sans)' }}>What's wrong</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>{issue.description}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>
            <span>{issue.affected_pct.toFixed(1)}% of rows affected</span>
            <span>{issue.affected_count.toLocaleString()} rows</span>
          </div>
        </div>

        <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 400, marginBottom: 4 }}>
            Proposed fix
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
            {FIX_METHOD_LABEL[issue.issue_type] ?? issue.fix_type ?? 'Automated fix'}
          </p>
        </div>

        {preview && (
          <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--blue-tint)', border: '1px solid var(--border-accent)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 400 }}>Preview</p>
            <div style={{ display: 'flex', gap: 24, fontSize: 13, fontFamily: 'var(--font-sans)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                Method: <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{preview.method}</span>
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                Rows: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {preview.rows_affected.toLocaleString()}
                </span>
              </span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-sans)' }}>
              <RotateCcw style={{ width: 12, height: 12 }} />
              Every change is fully reversible
            </p>
          </div>
        )}

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bad-dim)', border: '1px solid var(--bad)', fontSize: 13, color: 'var(--bad)', fontFamily: 'var(--font-sans)' }}>
            <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
            {error}
          </div>
        )}
      </div>

      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {!preview && (
          <Button variant="secondary" size="sm" loading={previewPending} onClick={onPreview}>
            <Eye style={{ width: 14, height: 14 }} />
            Preview
          </Button>
        )}
        <Button size="sm" loading={applyPending} onClick={onApply}>
          Apply fix
        </Button>
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </div>
  )
}

// ── Manual guidance panel ─────────────────────────────────────────────

interface ManualGuidancePanelProps {
  issue: QualityIssue
  applyingMethod: string | null
  error: string | null
  onApply: (issueId: string, method: string) => void
}

function ManualGuidancePanel({ issue, applyingMethod, error, onApply }: ManualGuidancePanelProps) {
  const guidance = MANUAL_GUIDANCE[issue.issue_type]

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-inset)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 400, marginBottom: 2 }}>
            Manual review required
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SeverityBadge severity={issue.severity} />
            {issue.column_name && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>{issue.column_name}</span>
            )}
          </div>
        </div>
        <HelpCircle style={{ width: 20, height: 20, color: 'var(--warn)' }} />
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* What's wrong */}
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4, fontFamily: 'var(--font-sans)' }}>What's wrong</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>{issue.description}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>
            <span>{issue.affected_pct.toFixed(1)}% of rows affected</span>
            <span>{issue.affected_count.toLocaleString()} rows</span>
          </div>
        </div>

        {guidance ? (
          <>
            {/* Why it matters */}
            <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--warn-dim)', border: '1px solid var(--warn)' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--warn)', fontWeight: 400, marginBottom: 6 }}>
                Why it matters for ML
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>{guidance.why}</p>
            </div>

            {/* Fix options */}
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8, fontFamily: 'var(--font-sans)' }}>
                Choose how to fix it
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {guidance.options.map((opt) => (
                  <div
                    key={opt.method}
                    style={{
                      padding: 16,
                      borderRadius: 'var(--radius-md)',
                      border: opt.recommended ? '1px solid var(--border-accent)' : '1px solid var(--border)',
                      background: opt.recommended ? 'var(--blue-tint)' : 'var(--bg-2)',
                    }}
                  >
                    {opt.recommended && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600 }}>
                          Recommended
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>{opt.label}</p>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>
                          {opt.description}
                        </p>
                        {opt.caution && (
                          <p style={{ fontSize: 11, color: 'var(--warn)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-sans)' }}>
                            <AlertTriangle style={{ width: 12, height: 12, flexShrink: 0 }} />
                            {opt.caution}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        style={{ flexShrink: 0, marginTop: 2 }}
                        loading={applyingMethod === opt.method}
                        disabled={applyingMethod != null && applyingMethod !== opt.method}
                        onClick={() => onApply(issue.id, opt.method)}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-2)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
            This issue requires manual intervention outside of Datrix — review your data collection
            process or modelling approach to address it.
          </div>
        )}

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bad-dim)', border: '1px solid var(--bad)', fontSize: 13, color: 'var(--bad)', fontFamily: 'var(--font-sans)' }}>
            <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
