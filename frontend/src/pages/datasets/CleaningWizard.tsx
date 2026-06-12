import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  CheckCircle2, Zap, AlertCircle, Eye,
  ChevronRight, RotateCcw, HelpCircle, AlertTriangle,
} from 'lucide-react'
import { api } from '@/lib/api'
import { SeverityBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
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
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle2 className="w-10 h-10 text-success mb-3" />
        <p className="text-base font-semibold text-text-primary">No open issues</p>
        <p className="text-sm text-text-secondary mt-1">Dataset has no open issues</p>
      </div>
    )
  }

  // ── Main layout ───────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-5 gap-5">

      {/* ── Left: issue list ──────────────────────────────────────── */}
      <div className="col-span-2 flex flex-col gap-3">

        {/* Progress (auto issues only) */}
        {autoFixable.length > 0 && (
          <div className="bg-surface-primary border border-border rounded-xl p-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm font-medium text-text-primary">
                {resolved.size} / {autoFixable.length} auto-fixes applied
              </span>
              <span className="text-xs text-success font-medium">
                +{resolvedGain.toFixed(1)} / +{totalGain.toFixed(1)} pts
              </span>
            </div>
            <div className="h-2 bg-surface-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-success rounded-full transition-all duration-500"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            {allAutoResolved && manualIssues.length > 0 && (
              <p className="text-xs text-success mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                All auto-fixes done — review manual issues below
              </p>
            )}
          </div>
        )}

        {/* Fix all (only when unresolved auto issues remain) */}
        {unresolvedAuto.length > 1 && (
          <Button
            className="w-full"
            loading={applyAllMutation.isPending}
            onClick={() => applyAllMutation.mutate()}
          >
            <Zap className="w-4 h-4" />
            Fix all {unresolvedAuto.length} auto-fixable
          </Button>
        )}

        {/* Issue list */}
        <div className="bg-surface-primary border border-border rounded-xl overflow-hidden">

          {/* Auto-fixable section */}
          {autoFixable.length > 0 && manualIssues.length > 0 && (
            <div className="px-4 py-2 bg-surface-tertiary border-b border-border">
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">
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
                className={cn(
                  'w-full flex items-start gap-3 px-4 py-3 text-left border-b border-border last:border-0 transition-colors',
                  isActive && !isResolved && 'bg-brand-50',
                  isResolved ? 'opacity-50 cursor-default' : 'hover:bg-surface-tertiary cursor-pointer',
                )}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {isResolved ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : (
                    <div className={cn(
                      'w-4 h-4 rounded-full border-2',
                      isActive ? 'border-brand bg-brand' : 'border-border',
                    )} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <SeverityBadge severity={issue.severity} />
                    {issue.column_name && (
                      <span className="text-xs font-mono text-text-tertiary truncate">
                        {issue.column_name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-2">{issue.description}</p>
                </div>
                {isActive && !isResolved && (
                  <ChevronRight className="w-4 h-4 text-brand flex-shrink-0 mt-1" />
                )}
              </button>
            )
          })}

          {/* Manual review section */}
          {manualIssues.length > 0 && (
            <div className="px-4 py-2 bg-surface-tertiary border-b border-border border-t">
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">
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
                className={cn(
                  'w-full flex items-start gap-3 px-4 py-3 text-left border-b border-border last:border-0 transition-colors cursor-pointer',
                  isActive ? 'bg-warning-50' : 'hover:bg-surface-tertiary',
                )}
              >
                <HelpCircle className={cn(
                  'w-4 h-4 flex-shrink-0 mt-0.5',
                  isActive ? 'text-warning' : 'text-text-tertiary',
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <SeverityBadge severity={issue.severity} />
                    {issue.column_name && (
                      <span className="text-xs font-mono text-text-tertiary truncate">
                        {issue.column_name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-2">{issue.description}</p>
                </div>
                {isActive && <ChevronRight className="w-4 h-4 text-warning flex-shrink-0 mt-1" />}
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
      <div className="col-span-3">
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
          <div className="flex items-center justify-center h-48 text-text-tertiary text-sm">
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
    <div className="bg-surface-primary border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-surface-tertiary flex items-center justify-between">
        <div>
          <p className="text-xs text-text-tertiary uppercase tracking-wide font-medium mb-0.5">
            Issue {issueIndex + 1} of {totalAuto}
          </p>
          <div className="flex items-center gap-2">
            <SeverityBadge severity={issue.severity} />
            {issue.column_name && (
              <span className="font-mono text-sm text-text-primary">{issue.column_name}</span>
            )}
          </div>
        </div>
        {issue.impact_score > 0 && (
          <div className="text-right">
            <p className="text-xs text-text-tertiary">Est. accuracy gain</p>
            <p className="text-base font-semibold text-success">+{issue.impact_score.toFixed(1)}%</p>
          </div>
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        <div>
          <p className="text-sm font-medium text-text-primary mb-1">What's wrong</p>
          <p className="text-sm text-text-secondary">{issue.description}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-text-tertiary">
            <span>{issue.affected_pct.toFixed(1)}% of rows affected</span>
            <span>{issue.affected_count.toLocaleString()} rows</span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-surface-secondary border border-border">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
            Proposed fix
          </p>
          <p className="text-sm text-text-primary">
            {FIX_METHOD_LABEL[issue.issue_type] ?? issue.fix_type ?? 'Automated fix'}
          </p>
        </div>

        {preview && (
          <div className="p-3 rounded-lg bg-brand-50 border border-brand/20 space-y-1">
            <p className="text-xs font-medium text-brand uppercase tracking-wide">Preview</p>
            <div className="flex gap-6 text-sm">
              <span className="text-text-secondary">
                Method: <span className="text-text-primary font-mono">{preview.method}</span>
              </span>
              <span className="text-text-secondary">
                Rows: <span className="text-text-primary font-medium">
                  {preview.rows_affected.toLocaleString()}
                </span>
              </span>
            </div>
            <p className="text-xs text-brand/70 flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              Every change is fully reversible
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-danger-50 border border-danger/20 text-sm text-danger">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      <div className="px-5 py-4 border-t border-border flex items-center gap-2">
        {!preview && (
          <Button variant="secondary" size="sm" loading={previewPending} onClick={onPreview}>
            <Eye className="w-3.5 h-3.5" />
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
    <div className="bg-surface-primary border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-surface-tertiary flex items-center justify-between">
        <div>
          <p className="text-xs text-text-tertiary uppercase tracking-wide font-medium mb-0.5">
            Manual review required
          </p>
          <div className="flex items-center gap-2">
            <SeverityBadge severity={issue.severity} />
            {issue.column_name && (
              <span className="font-mono text-sm text-text-primary">{issue.column_name}</span>
            )}
          </div>
        </div>
        <HelpCircle className="w-5 h-5 text-warning" />
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* What's wrong */}
        <div>
          <p className="text-sm font-medium text-text-primary mb-1">What's wrong</p>
          <p className="text-sm text-text-secondary">{issue.description}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-text-tertiary">
            <span>{issue.affected_pct.toFixed(1)}% of rows affected</span>
            <span>{issue.affected_count.toLocaleString()} rows</span>
          </div>
        </div>

        {guidance ? (
          <>
            {/* Why it matters */}
            <div className="p-3 rounded-lg bg-warning-50 border border-warning/20">
              <p className="text-xs font-medium text-warning uppercase tracking-wide mb-1.5">
                Why it matters for ML
              </p>
              <p className="text-sm text-text-secondary leading-relaxed">{guidance.why}</p>
            </div>

            {/* Fix options */}
            <div>
              <p className="text-sm font-medium text-text-primary mb-2">
                Choose how to fix it
              </p>
              <div className="space-y-3">
                {guidance.options.map((opt) => (
                  <div
                    key={opt.method}
                    className={cn(
                      'p-4 rounded-lg border',
                      opt.recommended
                        ? 'border-brand/40 bg-brand-50'
                        : 'border-border bg-surface-secondary',
                    )}
                  >
                    {opt.recommended && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-xs font-semibold text-brand uppercase tracking-wide">
                          Recommended
                        </span>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-text-primary">{opt.label}</p>
                        <p className="text-sm text-text-secondary mt-1 leading-relaxed">
                          {opt.description}
                        </p>
                        {opt.caution && (
                          <p className="text-xs text-warning mt-2 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                            {opt.caution}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="flex-shrink-0 mt-0.5"
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
          <div className="p-3 rounded-lg bg-surface-secondary border border-border text-sm text-text-secondary">
            This issue requires manual intervention outside of Datrix — review your data collection
            process or modelling approach to address it.
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-danger-50 border border-danger/20 text-sm text-danger">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
