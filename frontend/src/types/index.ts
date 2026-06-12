export type DatasetStatus = 'pending' | 'ingesting' | 'scanning' | 'ready' | 'error'
export type IssueSeverity = 'critical' | 'warning' | 'info'
export type QualityDimension = 'completeness' | 'consistency' | 'accuracy' | 'distribution' | 'label_quality'
export type ScanStatus = 'queued' | 'running' | 'complete' | 'failed'

export interface ColumnSchema {
  name: string
  dtype: string
  nullable: boolean
}

export interface Dataset {
  id: string
  name: string
  row_count: number | null
  column_count: number | null
  size_bytes: number | null
  status: DatasetStatus
  schema: ColumnSchema[] | null
  created_at: string
  updated_at: string
  latest_scan_id: string | null
  latest_score: number | null
}

export interface QualityScore {
  overall: number
  completeness: number
  consistency: number
  accuracy: number
  distribution: number
  label_quality: number
}

export interface QualityIssue {
  id: string
  column_name: string | null
  issue_type: string
  dimension: QualityDimension
  severity: IssueSeverity
  description: string
  affected_count: number
  affected_pct: number
  impact_score: number
  fix_available: boolean
  fix_type: 'auto' | 'semi_auto' | 'manual' | null
  status: 'open' | 'resolved'
}

export interface QualityScan {
  id: string
  dataset_id: string
  status: ScanStatus
  score: QualityScore | null
  issues: QualityIssue[]
  scan_duration_ms: number | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface ColumnProfile {
  name: string
  dtype: string
  null_count: number
  null_pct: number
  unique_count: number | null
  quality_score: number
  issues: QualityIssue[]
  distribution: { label: string; count: number; pct: number }[]
  stats: Record<string, string | number>
}

export interface CleaningFix {
  issue_id: string
  method: string
  rows_affected: number
  preview: Record<string, unknown>
}

// ── Pipelines ─────────────────────────────────────────────────────────

export type StepType =
  | 'filter'
  | 'select_columns'
  | 'drop_columns'
  | 'rename_column'
  | 'fill_nulls'
  | 'deduplicate'
  | 'lowercase'
  | 'normalize'
  | 'encode_categorical'
  | 'sort'

export interface PipelineStep {
  id: string
  type: StepType
  config: Record<string, unknown>
}

export interface Pipeline {
  id: string
  name: string
  description: string
  dataset_id: string | null
  steps: PipelineStep[]
  status: 'draft' | 'ready'
  created_at: string
  updated_at: string
  node_positions: Record<string, { x: number; y: number }> | null
}

export interface StepResult {
  step_id: string
  rows_in: number
  rows_out: number
  cols_in: number
  cols_out: number
  preview: Record<string, unknown>[]
}

// ── Synthetic ─────────────────────────────────────────────────────────

export type SyntheticMethod = 'statistical' | 'ctgan' | 'tvae'

export interface ColOverride {
  null_rate?: number        // 0–1
  distribution?: string    // auto | normal | log_normal | uniform | beta
  min?: number
  max?: number
  class_weights?: Record<string, number>
}

export interface TrainedModel {
  id: string
  dataset_id: string
  method: SyntheticMethod
  status: 'training' | 'ready' | 'failed'
  error_message: string | null
  created_at: string
}

export interface SyntheticJob {
  id: string
  source_dataset_id: string
  output_dataset_id: string | null
  output_name: string
  method: SyntheticMethod
  row_count: number
  column_overrides: Record<string, ColOverride> | null
  status: 'pending' | 'running' | 'complete' | 'failed'
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export interface PipelineRun {
  id: string
  pipeline_id: string
  dataset_id: string
  status: 'pending' | 'running' | 'complete' | 'failed'
  is_dry_run: boolean
  step_results: StepResult[]
  output_path: string | null
  output_format: string
  rows_in: number | null
  rows_out: number | null
  cols_in: number | null
  cols_out: number | null
  error_message: string | null
  created_at: string
  completed_at: string | null
  output_preview: Record<string, unknown>[] | null
}

// ── Active Learning ───────────────────────────────────────────────────

export type ALTaskType = 'classification' | 'regression'
export type ALModelType = 'logistic_regression' | 'random_forest' | 'xgboost' | 'svm' | 'mlp'
export type ALSamplingStrategy = 'random' | 'least_confidence' | 'margin' | 'entropy' | 'coreset' | 'committee'
export type ALStatus = 'annotating' | 'training' | 'complete'

export interface ALRound {
  round: number
  labeled_count: number
  metrics: Record<string, number>
  confusion_matrix: number[][] | null
  feature_importances: { feature: string; importance: number }[]
  explanation: string
  label_classes: string[]
}

export interface ALSession {
  id: string
  name: string
  dataset_id: string
  target_column: string
  task_type: ALTaskType
  model_type: ALModelType
  sampling_strategy: ALSamplingStrategy
  batch_size: number
  label_classes: string[]
  exclude_columns: string[]
  target_accuracy: number | null
  max_rounds: number
  model_name: string
  status: ALStatus
  current_round: number
  labeled_count: number
  next_batch: number[]
  rounds: ALRound[]
  model_path: string | null
  created_at: string
  updated_at: string
}

export interface ALBatchRow {
  row_index: number
  data: Record<string, unknown>
  confidence: number | null
}

export interface ALPredictOut {
  dataset_id: string
  dataset_name: string
  row_count: number
}

// ── Benchmark ─────────────────────────────────────────────────────────

export type BenchmarkModelType = 'logistic_regression' | 'random_forest' | 'xgboost' | 'svm' | 'mlp'
export type BenchmarkPreset = 'default' | 'tuned' | 'grid_search'
export type BenchmarkEvalProtocol = 'kfold_5' | 'kfold_10' | 'holdout_80' | 'holdout_90'
export type BenchmarkStatus = 'pending' | 'running' | 'complete' | 'failed'

export interface BenchmarkCandidateConfig {
  id: string
  label: string
  model_type: BenchmarkModelType
  preset: BenchmarkPreset
  dataset_id: string | null
  al_session_id: string | null
  exclude_columns: string[]
}

export interface BenchmarkCandidateResult {
  candidate_id: string
  status: BenchmarkStatus
  metrics: Record<string, number>
  confusion_matrix: number[][] | null
  feature_importances: { feature: string; importance: number }[]
  learning_curve: { train_size: number; train_score: number; val_score: number }[]
  training_time_ms: number
  error_message: string | null
  label_classes: string[]
}

export interface BenchmarkJob {
  id: string
  name: string
  dataset_id: string
  target_column: string
  task_type: 'classification' | 'regression'
  eval_protocol: BenchmarkEvalProtocol
  candidates: BenchmarkCandidateConfig[]
  status: BenchmarkStatus
  results: BenchmarkCandidateResult[]
  winner_candidate_id: string | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export interface ALBatch {
  session_id: string
  round: number
  batch: ALBatchRow[]
  total_labeled: number
  status: ALStatus
}

// ── Compliance ────────────────────────────────────────────────────────

export type PiiSeverity = 'critical' | 'high' | 'medium' | 'low' | 'clean' | 'unscanned'
export type PolicyType =
  | 'no_pii_in_training' | 'pii_scan_required' | 'min_quality_score'
  | 'max_retention_days' | 'min_row_count_for_training' | 'no_unscanned_in_pipeline'
  | 'model_accuracy_floor' | 'benchmark_winner_required'
export type PolicySeverity = 'info' | 'warning' | 'critical'
export type AnonMethod = 'keep' | 'suppress' | 'redact' | 'mask' | 'hash' | 'generalize' | 'pseudonymize'
export type ComplianceFramework = 'gdpr' | 'ccpa' | 'hipaa' | 'general' | 'custom'

export interface PiiFinding {
  column: string
  pii_category: string
  severity: PiiSeverity
  confidence: number
  detection_method: string
  sample_values: string[]
  suggested_methods: AnonMethod[]
}

export interface ComplianceScan {
  id: string
  dataset_id: string
  status: 'pending' | 'running' | 'complete' | 'failed'
  scanned_at: string | null
  duration_ms: number | null
  findings: PiiFinding[]
  overall_risk: PiiSeverity
  pii_column_count: number
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  rows_sampled: number
  error_message: string | null
  created_at: string
}

export interface ScanSummary {
  dataset_id: string
  dataset_name: string
  scan: {
    id: string
    status: string
    overall_risk: PiiSeverity
    pii_column_count: number
    critical_count: number
    scanned_at: string | null
    duration_ms: number | null
  } | null
}

export interface CompliancePolicy {
  id: string
  name: string
  policy_type: PolicyType
  parameters: Record<string, unknown>
  severity: PolicySeverity
  enabled: boolean
  created_at: string
  updated_at: string
  violation_count: number
}

export interface PolicyViolation {
  id: string
  policy_id: string
  policy_name: string
  policy_type: PolicyType
  entity_type: string
  entity_id: string
  entity_name: string
  message: string
  severity: PolicySeverity
  resolved: boolean
  detected_at: string
  resolved_at: string | null
}

export interface AuditEvent {
  id: string
  event_type: string
  category: string
  entity_type: string
  entity_id: string
  entity_name: string
  metadata: Record<string, unknown>
  duration_ms: number | null
  created_at: string
}

export interface AuditLogResponse {
  total: number
  offset: number
  limit: number
  events: AuditEvent[]
}

export interface ColumnConfig {
  column: string
  method: AnonMethod
  params: Record<string, unknown>
}

export interface AnonymizationJob {
  id: string
  source_dataset_id: string
  output_dataset_id: string | null
  output_name: string
  column_configs: ColumnConfig[]
  status: 'pending' | 'running' | 'complete' | 'failed'
  rows_processed: number
  row_count: number
  columns_transformed: number
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export interface ComplianceReport {
  id: string
  framework: ComplianceFramework
  sections: string[]
  status: 'pending' | 'complete' | 'failed'
  entity_count: number
  findings_count: number
  violation_count: number
  risk_score: number
  file_path: string | null
  error_message: string | null
  created_at: string
}

export interface LineageNode {
  id: string
  type: string
  label: string
  color: string
  meta: Record<string, unknown>
}

export interface LineageEdge {
  id: string
  source: string
  target: string
  label: string
}

export interface LineageGraph {
  nodes: LineageNode[]
  edges: LineageEdge[]
  impact?: { id: string; type: string; label: string }[]
}

export interface RiskBreakdownComponent {
  score: number
  max: number
  pct: number
}

export interface ComplianceDashboard {
  risk: {
    score: number
    grade: string
    breakdown: Record<string, RiskBreakdownComponent>
  }
  stats: {
    violations: number
    unscanned_datasets: number
    pii_columns: number
    audit_events_7d: number
    critical_pii_datasets: number
    high_pii_datasets: number
  }
  recent_violations: PolicyViolation[]
  dataset_coverage: {
    id: string
    name: string
    pii_risk: PiiSeverity
    pii_column_count: number
    critical_count: number
  }[]
}

// ── Settings ──────────────────────────────────────────────────────────

export interface AppSettings {
  // General
  app_name: string
  date_format: string
  table_page_size: number
  // Storage
  max_upload_mb: number
  allowed_extensions: string[]
  // Active Learning defaults
  al_default_batch_size: number
  al_default_model_type: string
  al_default_sampling_strategy: string
  al_default_max_rounds: number
  al_default_target_accuracy: number | null
  // Benchmark defaults
  benchmark_default_eval_protocol: string
  benchmark_default_preset: string
  benchmark_default_task_type: string
  // Synthetic defaults
  synthetic_default_method: string
  synthetic_default_row_count: number
  // Pipeline defaults
  pipeline_default_output_format: string
  // Export defaults
  export_default_format: string
}

export interface StorageStats {
  uploads_bytes: number
  models_bytes: number
  db_bytes: number
  total_data_bytes: number
  disk_total_bytes: number
  disk_free_bytes: number
  disk_used_bytes: number
  dataset_count: number
  pipeline_count: number
  al_session_count: number
  benchmark_job_count: number
  synthetic_job_count: number
  marketplace_asset_count: number
  marketplace_install_count: number
  upload_file_count: number
}

export interface SettingsResponse {
  settings: AppSettings
  stats: StorageStats
}

// ── Marketplace ───────────────────────────────────────────────────────

export type MarketplaceAssetType = 'dataset' | 'pipeline' | 'model' | 'benchmark_config'
export type MarketplaceCategory = 'ecommerce' | 'finance' | 'healthcare' | 'marketing' | 'logistics' | 'hr' | 'nlp' | 'timeseries' | 'general'
export type MarketplaceLicense = 'mit' | 'cc_by' | 'cc_by_nc' | 'apache2' | 'proprietary'
export type MarketplaceSort = 'newest' | 'popular' | 'rating' | 'trending'

export interface MarketplaceAsset {
  id: string
  title: string
  description: string
  long_description: string
  asset_type: MarketplaceAssetType
  category: MarketplaceCategory
  tags: string[]
  author_name: string
  license: MarketplaceLicense
  version: string
  status: 'draft' | 'published' | 'archived'
  is_seeded: boolean
  download_count: number
  view_count: number
  rating_avg: number
  rating_count: number
  source_id: string
  preview: Record<string, unknown>
  file_size: number
  created_at: string
  updated_at: string
  published_at: string
}

export interface MarketplaceReview {
  id: string
  asset_id: string
  author_name: string
  rating: number
  comment: string
  created_at: string
}

export interface MarketplaceInstall {
  id: string
  asset_id: string
  asset_title: string
  asset_type: MarketplaceAssetType
  resulting_id: string
  installed_at: string
}

export interface MarketplaceInstallResult {
  resulting_id: string
  asset_type: MarketplaceAssetType
  message: string
}

export interface MarketplaceStats {
  total_assets: number
  total_datasets: number
  total_pipelines: number
  total_models: number
  total_downloads: number
  total_installs: number
}
