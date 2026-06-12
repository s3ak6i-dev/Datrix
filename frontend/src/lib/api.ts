import type { Dataset, QualityScan, ColumnProfile, CleaningFix, Pipeline, PipelineRun, SyntheticJob, TrainedModel, ColOverride, SyntheticMethod, ALSession, ALBatch, ALPredictOut, ALTaskType, ALModelType, ALSamplingStrategy, BenchmarkJob, BenchmarkModelType, BenchmarkPreset, BenchmarkEvalProtocol, MarketplaceAsset, MarketplaceReview, MarketplaceInstall, MarketplaceInstallResult, MarketplaceStats, MarketplaceAssetType, MarketplaceCategory, MarketplaceLicense, MarketplaceSort, AppSettings, SettingsResponse, ComplianceDashboard, ComplianceScan, ScanSummary, LineageGraph, CompliancePolicy, PolicyViolation, AnonymizationJob, AuditLogResponse, ComplianceReport, ComplianceFramework, ColumnConfig } from '@/types'

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Request failed')
  }
  return res.json()
}

// Datasets
export const api = {
  datasets: {
    list: () => request<Dataset[]>('/datasets'),
    get: (id: string) => request<Dataset>(`/datasets/${id}`),
    delete: (id: string) => request<void>(`/datasets/${id}`, { method: 'DELETE' }),
    upload: (file: File, onProgress?: (pct: number) => void): Promise<Dataset> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        const form = new FormData()
        form.append('file', file)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText))
          } else {
            const err = JSON.parse(xhr.responseText || '{}')
            reject(new Error(err.detail ?? 'Upload failed'))
          }
        }
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.open('POST', `${BASE}/datasets/upload`)
        xhr.send(form)
      })
    },
  },
  scans: {
    trigger: (datasetId: string) =>
      request<QualityScan>(`/datasets/${datasetId}/scan`, { method: 'POST' }),
    get: (datasetId: string, scanId: string) =>
      request<QualityScan>(`/datasets/${datasetId}/scan/${scanId}`),
    latest: (datasetId: string) =>
      request<QualityScan>(`/datasets/${datasetId}/scan/latest`),
    list: (datasetId: string) =>
      request<QualityScan[]>(`/datasets/${datasetId}/scans`),
  },
  columns: {
    list: (datasetId: string) =>
      request<ColumnProfile[]>(`/datasets/${datasetId}/columns`),
    get: (datasetId: string, colName: string) =>
      request<ColumnProfile>(`/datasets/${datasetId}/columns/${encodeURIComponent(colName)}`),
  },
  cleaning: {
    preview: (datasetId: string, issueIds: string[]) =>
      request<CleaningFix[]>(`/datasets/${datasetId}/fix/preview`, {
        method: 'POST',
        body: JSON.stringify({ issue_ids: issueIds }),
      }),
    apply: (datasetId: string, issueIds: string[], options?: Record<string, string>) =>
      request<{ rows_changed: number }>(`/datasets/${datasetId}/fix`, {
        method: 'POST',
        body: JSON.stringify({ issue_ids: issueIds, options: options ?? {} }),
      }),
    rollback: (datasetId: string, fixId: string) =>
      request<void>(`/datasets/${datasetId}/fix/${fixId}`, { method: 'DELETE' }),
  },
  pipelines: {
    list: () => request<Pipeline[]>('/pipelines'),
    get: (id: string) => request<Pipeline>(`/pipelines/${id}`),
    create: (name: string, description = '', datasetId?: string) =>
      request<Pipeline>('/pipelines', {
        method: 'POST',
        body: JSON.stringify({ name, description, dataset_id: datasetId ?? null }),
      }),
    update: (id: string, patch: { name?: string; description?: string; dataset_id?: string | null; steps?: unknown[]; node_positions?: Record<string, { x: number; y: number }> }) =>
      request<Pipeline>(`/pipelines/${id}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      }),
    delete: (id: string) => request<void>(`/pipelines/${id}`, { method: 'DELETE' }),
    run: (id: string, dryRun: boolean, outputFormat = 'csv') =>
      request<PipelineRun>(`/pipelines/${id}/run`, {
        method: 'POST',
        body: JSON.stringify({ dry_run: dryRun, output_format: outputFormat }),
      }),
    listRuns: (id: string) => request<PipelineRun[]>(`/pipelines/${id}/runs`),
    getRun: (runId: string) => request<PipelineRun>(`/pipelines/runs/${runId}`),
    downloadUrl: (runId: string) => `/api/pipelines/runs/${runId}/download`,
  },
  synthetic: {
    createJob: (body: {
      source_dataset_id: string
      output_name: string
      method: SyntheticMethod
      row_count: number
      column_overrides: Record<string, ColOverride> | null
    }) => request<SyntheticJob>('/synthetic/jobs', { method: 'POST', body: JSON.stringify(body) }),
    listJobs: () => request<SyntheticJob[]>('/synthetic/jobs'),
    getJob: (id: string) => request<SyntheticJob>(`/synthetic/jobs/${id}`),
    listModels: () => request<TrainedModel[]>('/synthetic/models'),
    deleteModel: (id: string) => request<void>(`/synthetic/models/${id}`, { method: 'DELETE' }),
    findModel: (datasetId: string, method: SyntheticMethod) =>
      request<TrainedModel[]>(`/synthetic/models/status?dataset_id=${datasetId}&method=${method}`),
  },
  al: {
    createSession: (body: {
      name?: string
      dataset_id: string
      target_column: string
      task_type: ALTaskType
      model_type: ALModelType
      sampling_strategy: ALSamplingStrategy
      batch_size: number
      label_classes: string[]
      exclude_columns: string[]
      target_accuracy?: number | null
      max_rounds?: number
    }) => request<ALSession>('/al/sessions', { method: 'POST', body: JSON.stringify(body) }),
    listSessions: () => request<ALSession[]>('/al/sessions'),
    getSession: (id: string) => request<ALSession>(`/al/sessions/${id}`),
    getBatch: (id: string) => request<ALBatch>(`/al/sessions/${id}/batch`),
    submitLabels: (id: string, labels: Record<string, unknown>) =>
      request<ALSession>(`/al/sessions/${id}/labels`, {
        method: 'POST',
        body: JSON.stringify({ labels }),
      }),
    stop: (id: string) => request<ALSession>(`/al/sessions/${id}/stop`, { method: 'POST' }),
    renameModel: (id: string, model_name: string) =>
      request<ALSession>(`/al/sessions/${id}/model-name`, {
        method: 'PATCH',
        body: JSON.stringify({ model_name }),
      }),
    exportUrl: (id: string) => `/api/al/sessions/${id}/export`,
    predict: (id: string) => request<ALPredictOut>(`/al/sessions/${id}/predict`, { method: 'POST' }),
    exportLabelsUrl: (id: string) => `/api/al/sessions/${id}/export-labels`,
    delete: (id: string) => request<void>(`/al/sessions/${id}`, { method: 'DELETE' }),
  },
  benchmark: {
    createJob: (body: {
      name?: string
      dataset_id: string
      target_column: string
      task_type: 'classification' | 'regression'
      eval_protocol: BenchmarkEvalProtocol
      candidates: {
        label?: string
        model_type: BenchmarkModelType
        preset: BenchmarkPreset
        dataset_id?: string | null
        al_session_id?: string | null
        exclude_columns?: string[]
      }[]
    }) => request<BenchmarkJob>('/benchmark/jobs', { method: 'POST', body: JSON.stringify(body) }),
    listJobs: () => request<BenchmarkJob[]>('/benchmark/jobs'),
    getJob: (id: string) => request<BenchmarkJob>(`/benchmark/jobs/${id}`),
    deleteJob: (id: string) => request<void>(`/benchmark/jobs/${id}`, { method: 'DELETE' }),
    exportUrl: (id: string) => `/api/benchmark/jobs/${id}/export`,
  },
  compliance: {
    dashboard: () => request<ComplianceDashboard>('/compliance/dashboard'),
    triggerScan: (datasetId: string) => request<{ status: string }>(`/compliance/scans/${datasetId}`, { method: 'POST' }),
    getScan: (datasetId: string) => request<ComplianceScan>(`/compliance/scans/${datasetId}`),
    listScans: () => request<ScanSummary[]>('/compliance/scans'),
    scanAll: () => request<{ message: string; count: number }>('/compliance/scans', { method: 'POST' }),
    getLineage: () => request<LineageGraph>('/compliance/lineage'),
    getDatasetLineage: (id: string) => request<LineageGraph>(`/compliance/lineage/${id}`),
    listPolicies: () => request<CompliancePolicy[]>('/compliance/policies'),
    createPolicy: (body: { name: string; policy_type: string; parameters?: Record<string, unknown>; severity?: string; enabled?: boolean }) =>
      request<CompliancePolicy>('/compliance/policies', { method: 'POST', body: JSON.stringify(body) }),
    updatePolicy: (id: string, body: Partial<CompliancePolicy>) =>
      request<CompliancePolicy>(`/compliance/policies/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deletePolicy: (id: string) => request<void>(`/compliance/policies/${id}`, { method: 'DELETE' }),
    evaluatePolicies: () => request<{ policies_evaluated: number; violations_found: number; violations: PolicyViolation[] }>('/compliance/policies/evaluate', { method: 'POST' }),
    listViolations: (resolved?: boolean) => request<PolicyViolation[]>(`/compliance/violations${resolved !== undefined ? `?resolved=${resolved}` : ''}`),
    resolveViolation: (id: string) => request<PolicyViolation>(`/compliance/violations/${id}/resolve`, { method: 'PATCH' }),
    createAnonJob: (body: { source_dataset_id: string; output_name: string; column_configs: ColumnConfig[] }) =>
      request<{ job_id: string; status: string }>('/compliance/anonymize', { method: 'POST', body: JSON.stringify(body) }),
    listAnonJobs: () => request<AnonymizationJob[]>('/compliance/anonymize'),
    getAnonJob: (id: string) => request<AnonymizationJob>(`/compliance/anonymize/${id}`),
    getAuditLog: (params?: { category?: string; event_type?: string; entity_name?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams()
      if (params?.category) qs.set('category', params.category)
      if (params?.event_type) qs.set('event_type', params.event_type)
      if (params?.entity_name) qs.set('entity_name', params.entity_name)
      if (params?.limit) qs.set('limit', String(params.limit))
      if (params?.offset) qs.set('offset', String(params.offset))
      const suffix = qs.toString() ? `?${qs}` : ''
      return request<AuditLogResponse>(`/compliance/audit${suffix}`)
    },
    auditExportUrl: () => '/api/compliance/audit/export',
    listReports: () => request<ComplianceReport[]>('/compliance/reports'),
    generateReport: (body: { framework: ComplianceFramework; sections: string[] }) =>
      request<ComplianceReport>('/compliance/reports/generate', { method: 'POST', body: JSON.stringify(body) }),
    getReport: (id: string) => request<ComplianceReport>(`/compliance/reports/${id}`),
    downloadReportUrl: (id: string, format: 'html' | 'json') => `/api/compliance/reports/${id}/download?format=${format}`,
    deleteReport: (id: string) => request<void>(`/compliance/reports/${id}`, { method: 'DELETE' }),
  },
  settings: {
    get: () => request<SettingsResponse>('/settings'),
    update: (patch: Partial<AppSettings>) => request<SettingsResponse>('/settings', { method: 'PATCH', body: JSON.stringify(patch) }),
    reset: () => request<SettingsResponse>('/settings/reset', { method: 'POST' }),
    clearUploads: () => request<{ deleted_files: number; freed_bytes: number; datasets_affected: number }>('/settings/uploads', { method: 'DELETE' }),
    clearDatabase: () => request<{ cleared: boolean; message: string }>('/settings/database', { method: 'DELETE' }),
  },
  marketplace: {
    list: (params?: { q?: string; type?: MarketplaceAssetType; category?: MarketplaceCategory; sort?: MarketplaceSort; page?: number; limit?: number }) => {
      const qs = new URLSearchParams()
      if (params?.q) qs.set('q', params.q)
      if (params?.type) qs.set('type', params.type)
      if (params?.category) qs.set('category', params.category)
      if (params?.sort) qs.set('sort', params.sort)
      if (params?.page) qs.set('page', String(params.page))
      if (params?.limit) qs.set('limit', String(params.limit))
      const suffix = qs.toString() ? `?${qs}` : ''
      return request<MarketplaceAsset[]>(`/marketplace/assets${suffix}`)
    },
    featured: () => request<MarketplaceAsset[]>('/marketplace/assets/featured'),
    get: (id: string) => request<MarketplaceAsset>(`/marketplace/assets/${id}`),
    publish: (body: {
      source_id: string
      asset_type: MarketplaceAssetType
      title: string
      description: string
      long_description?: string
      category?: MarketplaceCategory
      tags?: string[]
      author_name?: string
      license?: MarketplaceLicense
      version?: string
    }) => request<MarketplaceAsset>('/marketplace/assets', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Pick<MarketplaceAsset, 'title' | 'description' | 'long_description' | 'category' | 'tags' | 'license' | 'version'>>) =>
      request<MarketplaceAsset>(`/marketplace/assets/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request<void>(`/marketplace/assets/${id}`, { method: 'DELETE' }),
    install: (id: string) => request<MarketplaceInstallResult>(`/marketplace/assets/${id}/install`, { method: 'POST' }),
    submitReview: (id: string, body: { author_name: string; rating: number; comment?: string }) =>
      request<MarketplaceReview>(`/marketplace/assets/${id}/reviews`, { method: 'POST', body: JSON.stringify(body) }),
    listReviews: (id: string) => request<MarketplaceReview[]>(`/marketplace/assets/${id}/reviews`),
    myListings: () => request<MarketplaceAsset[]>('/marketplace/my-listings'),
    installs: () => request<MarketplaceInstall[]>('/marketplace/installs'),
    stats: () => request<MarketplaceStats>('/marketplace/stats'),
  },
}
