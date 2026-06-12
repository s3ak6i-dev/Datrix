# Datrix — Technical Specification

**Version 1.0 · Engineering Confidential · 2025**

| Document Type | Technical Specification |
|---|---|
| Status | Draft — Engineering |
| Audience | Engineering, Architecture, DevOps |
| Classification | Internal Confidential |

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [API Design](#2-api-design)
3. [Database Design](#3-database-design)
4. [Quality Engine — Technical Design](#4-quality-engine--technical-design)
5. [Pipeline Engine — Technical Design](#5-pipeline-engine--technical-design)
6. [Synthetic Data Engine — Technical Design](#6-synthetic-data-engine--technical-design)
7. [Infrastructure & DevOps](#7-infrastructure--devops)
8. [Security Architecture](#8-security-architecture)
9. [Python SDK Design](#9-python-sdk-design)
10. [Federated Processing Architecture](#10-federated-processing-architecture)
11. [Appendices](#11-appendices)

---

## 1. System Architecture Overview

### 1.1 Architecture Principles

Datrix is designed as a cloud-native, horizontally scalable, multi-tenant platform. Every architectural decision is made against six guiding principles:

- **Stateless processing:** all compute services are stateless and horizontally scalable
- **Hard tenant isolation:** cross-customer data access is architecturally impossible, not just policy
- **Async by default:** all long-running operations are asynchronous with real-time progress
- **Idempotency:** every operation can be safely retried without side effects
- **Observability first:** every service emits structured logs, metrics, and traces from day one
- **API-first:** every platform capability exposed via stable, versioned API before any UI is built

---

### 1.2 High-Level System Architecture

> Datrix uses a microservices architecture on Kubernetes, with an event-driven backbone (Kafka), object storage for all data (S3-compatible), a metadata store (PostgreSQL + Redis), and a GPU compute pool for ML-intensive operations. All services communicate via gRPC internally and REST/GraphQL externally.

| Layer | Technology & Responsibility |
|---|---|
| Client Layer | Web app (React), Python SDK, REST API, WebSocket for real-time updates |
| API Gateway | Kong — rate limiting, auth, routing, request logging, SSL termination |
| Application Services | Microservices (Node.js/Python) — business logic, orchestration, state management |
| Processing Engine | Apache Spark (large data), Polars (medium data), asyncio workers (small data) |
| ML Services | PyTorch/TensorFlow workers on GPU nodes — uncertainty, synthetic generation, quality ML models |
| Event Bus | Apache Kafka — async communication between all services; event sourcing |
| Data Storage | S3 (raw/processed data), PostgreSQL (metadata), Redis (cache/sessions), Elasticsearch (search) |
| Infrastructure | Kubernetes on AWS EKS; Terraform IaC; Datadog observability; GitHub Actions CI/CD |

---

### 1.3 Service Decomposition

| Service | Tech | Responsibility |
|---|---|---|
| ingestion-service | Python/FastAPI | Handles all data ingestion — file upload, connector management, schema inference |
| quality-service | Python | Core quality engine — scanning, scoring, impact prediction |
| cleaning-service | Python/Polars | Automated cleaning operations — imputation, dedup, standardisation |
| pipeline-service | Python/FastAPI | Pipeline CRUD, NLP parsing, template management, execution orchestration |
| execution-service | Python/Spark | Distributed pipeline execution on Spark workers |
| synthetic-service | Python/PyTorch | Synthetic data generation — CTGAN, TVAE, text LLM, TimeGAN |
| active-learning-service | Python | Uncertainty computation, example selection, annotation orchestration |
| compliance-service | Python | Regulatory monitoring, evidence collection, audit trail, ROPA generation |
| benchmark-service | Python | Anonymised aggregation, benchmark computation, percentile ranking |
| notification-service | Node.js | Email, Slack, webhook delivery with retry and dead-letter queue |
| api-gateway | Kong | Request routing, auth, rate limiting, SSL |
| web-app | React/TypeScript | Frontend SPA — all dashboard, pipeline builder, annotation UI |

---

### 1.4 Data Flow Architecture

#### Ingestion Flow

1. Client uploads file or triggers connector sync
2. ingestion-service validates format, detects schema, writes raw data to S3
3. ingestion-service publishes `DatasetIngested` event to Kafka
4. quality-service consumes event, enqueues scan job
5. Scan job executes on Spark workers; results written to PostgreSQL
6. quality-service publishes `ScanComplete` event
7. notification-service delivers completion notification to user
8. Web app polls scan status via API; dashboard updates in real time

#### Pipeline Execution Flow

1. User submits pipeline definition (visual or NLP) via API
2. pipeline-service validates DAG, resolves dependencies, creates execution plan
3. Execution plan published to Kafka as `ExecutionRequested` event
4. execution-service picks up job, provisions Spark context
5. Each pipeline step executed in dependency order; checkpoints saved to S3
6. Step completion events published; web app shows real-time progress
7. Final output written to S3 in requested format; delivery to external system triggered
8. `PipelineCompleted` event published; user notified

---

## 2. API Design

### 2.1 API Architecture

| Surface | Scope | Protocol | Use Case | Endpoint |
|---|---|---|---|---|
| REST API | External | HTTPS/JSON | Standard CRUD, async job submission, webhook management | api.datrix.ai/v1 |
| GraphQL | External | HTTPS/JSON | Flexible queries for dashboard | api.datrix.ai/graphql |
| WebSocket | External | WSS | Real-time job progress, quality score updates | ws.datrix.ai/v1 |
| gRPC | Internal | HTTP/2 + Protobuf | High-performance internal service communication | Internal mesh only |
| SDK | Library | Python | Pythonic wrapper over REST API with async support | PyPI: datrix |

---

### 2.2 Authentication & Authorisation

#### Authentication Methods

- **JWT Bearer tokens:** issued on OAuth login; 1-hour expiry; refresh token rotation
- **API keys:** long-lived; scoped to specific permissions; rotatable; per-environment
- **OAuth 2.0:** Google, GitHub, Microsoft — web app login
- **SAML 2.0:** enterprise SSO — Okta, Azure AD, Google Workspace, Ping Identity
- **mTLS:** service-to-service internal communication

#### Authorisation Model — RBAC + ABAC

| Role | Permissions |
|---|---|
| Super Admin | All permissions including billing, user management, org configuration |
| Admin | All permissions except billing; can manage users and roles |
| Data Engineer | Manage datasets, pipelines, connectors; no compliance module access |
| Data Scientist | Quality scans, synthetic generation, active learning; read-only pipelines |
| Annotator | Annotation queue access only; no data access beyond assigned tasks |
| Viewer | Read-only access to dashboards, reports, quality scores |
| API User | Programmatic access matching configured permissions; no UI |

---

### 2.3 Core API Endpoints

#### Datasets

```
POST   /v1/datasets                    Upload or register a dataset
GET    /v1/datasets                    List all datasets with pagination
GET    /v1/datasets/{id}               Get dataset metadata and quality score
DELETE /v1/datasets/{id}               Delete dataset and all derived data
POST   /v1/datasets/{id}/scan          Trigger quality scan (async)
GET    /v1/datasets/{id}/scan/{scanId} Get scan status and results
GET    /v1/datasets/{id}/columns       Get per-column quality profiles
GET    /v1/datasets/{id}/versions      List all versions of this dataset
```

#### Quality

```
GET    /v1/quality/{datasetId}/score       Get current quality score with breakdown
GET    /v1/quality/{datasetId}/issues      List all issues sorted by impact
POST   /v1/quality/{datasetId}/fix         Apply automated fixes (specify issue IDs)
POST   /v1/quality/{datasetId}/fix/preview Preview fixes before applying
DELETE /v1/quality/{datasetId}/fix/{fixId} Rollback a specific fix
GET    /v1/quality/{datasetId}/history     Quality score history over time
```

#### Pipelines

```
POST   /v1/pipelines                    Create pipeline (NLP or visual definition)
GET    /v1/pipelines/{id}               Get pipeline definition
PUT    /v1/pipelines/{id}               Update pipeline definition
POST   /v1/pipelines/{id}/run           Execute pipeline (async)
POST   /v1/pipelines/{id}/dry-run       Dry run on 1K row sample (async)
GET    /v1/pipelines/{id}/runs          List execution history
GET    /v1/runs/{runId}/status          Get run status and progress
GET    /v1/runs/{runId}/output          Get run output metadata and download URL
```

#### Synthetic Data

```
POST   /v1/synthetic/analyze            Analyze gaps in dataset (async)
GET    /v1/synthetic/analyze/{jobId}    Get gap analysis results
POST   /v1/synthetic/generate           Start generation job (async)
GET    /v1/synthetic/jobs/{jobId}       Get generation job status
GET    /v1/synthetic/jobs/{jobId}/results Get generated dataset
POST   /v1/synthetic/validate           Validate a synthetic dataset
POST   /v1/synthetic/blend              Blend real and synthetic datasets
```

#### Active Learning

```
POST   /v1/active-learning/register     Register a model for uncertainty tracking
POST   /v1/active-learning/score        Submit predictions to get uncertainty scores
POST   /v1/active-learning/select       Select examples from unlabeled pool
GET    /v1/active-learning/queue        Get annotation queue for current user
POST   /v1/active-learning/label        Submit labels for selected examples
POST   /v1/active-learning/retrain      Trigger model retraining with new labels
```

#### Compliance

```
GET    /v1/compliance/dashboard              Get compliance posture summary
GET    /v1/compliance/regulations            List applicable regulations for this org
GET    /v1/compliance/{regulation}/controls  Get control status for a regulation
POST   /v1/compliance/reports/{regulation}   Generate compliance report
GET    /v1/compliance/audit-trail            Query audit trail with filters
POST   /v1/compliance/incidents              Report a compliance incident
```

---

### 2.4 API Standards

- **Pagination:** cursor-based for all list endpoints; page size default 20, max 100
- **Filtering:** all list endpoints support field-based filtering via query params
- **Sorting:** all list endpoints support sort field and direction
- **Error format:** RFC 7807 Problem Details — type, title, status, detail, instance
- **Rate limiting:** 429 with `Retry-After` header; limits per API key
- **Idempotency:** POST endpoints accept `Idempotency-Key` header
- **Async jobs:** all long-running operations return 202 with job ID and status URL

#### Standard Error Response

```json
{
  "type": "https://api.datrix.ai/errors/quality-scan-failed",
  "title": "Quality scan failed",
  "status": 422,
  "detail": "Dataset contains no rows. Upload a non-empty dataset.",
  "instance": "/v1/datasets/ds_abc123/scan/scan_xyz789"
}
```

---

## 3. Database Design

### 3.1 Storage Architecture

| Data Type | Technology | Category | Notes |
|---|---|---|---|
| Raw & processed data | S3 / GCS / Azure Blob | Object storage | Append-only; versioned; lifecycle policies for archival |
| Metadata & relational data | PostgreSQL 16 | Relational | Datasets, pipelines, quality scores, users, orgs |
| Cache & sessions | Redis 7 | In-memory key-value | Dashboard query cache; session tokens; job status |
| Search & discovery | Elasticsearch 8 | Document search | Dataset search; audit log queries; benchmark search |
| Event streaming | Apache Kafka | Log-structured | All platform events; async communication; audit trail source |
| Vector embeddings | pgvector (Postgres ext.) | Vector similarity | Semantic dedup; dataset similarity search |
| Time-series metrics | InfluxDB | Time-series | Quality score history; model performance trends |

---

### 3.2 Core Schema — PostgreSQL

#### organisations table

```sql
CREATE TABLE organisations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  plan            TEXT NOT NULL DEFAULT 'starter',
  region          TEXT NOT NULL DEFAULT 'us-east-1',
  settings        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### datasets table

```sql
CREATE TABLE datasets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  source_type     TEXT NOT NULL,         -- file | database | api | stream
  storage_path    TEXT NOT NULL,          -- S3 path to Parquet
  row_count       BIGINT,
  column_count    INT,
  size_bytes      BIGINT,
  schema          JSONB,                 -- inferred column types and metadata
  domain          TEXT,                  -- healthcare | finance | nlp | etc
  task_type       TEXT,                  -- classification | regression | etc
  status          TEXT NOT NULL DEFAULT 'pending',
  version         INT NOT NULL DEFAULT 1,
  parent_id       UUID REFERENCES datasets(id),
  tags            TEXT[] NOT NULL DEFAULT '{}',
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### quality_scans table

```sql
CREATE TABLE quality_scans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id          UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'queued',
  overall_score       NUMERIC(5,2),
  completeness_score  NUMERIC(5,2),
  consistency_score   NUMERIC(5,2),
  accuracy_score      NUMERIC(5,2),
  distribution_score  NUMERIC(5,2),
  label_quality_score NUMERIC(5,2),
  dimension_weights   JSONB NOT NULL DEFAULT '{}',
  issue_count         JSONB,             -- {critical: N, warning: N, info: N}
  impact_prediction   JSONB,             -- estimated model accuracy impact
  scan_duration_ms    INT,
  spark_job_id        TEXT,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### quality_issues table

```sql
CREATE TABLE quality_issues (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id           UUID NOT NULL REFERENCES quality_scans(id) ON DELETE CASCADE,
  dataset_id        UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  column_name       TEXT,                -- null for dataset-level issues
  issue_type        TEXT NOT NULL,       -- null_values | duplicates | outliers | etc
  dimension         TEXT NOT NULL,       -- completeness | consistency | accuracy | etc
  severity          TEXT NOT NULL,       -- critical | warning | info
  description       TEXT NOT NULL,
  affected_count    BIGINT,
  affected_pct      NUMERIC(6,3),
  impact_score      NUMERIC(5,2),        -- estimated accuracy impact of fixing
  impact_confidence NUMERIC(4,3),
  fix_available     BOOLEAN NOT NULL DEFAULT FALSE,
  fix_type          TEXT,                -- auto | semi_auto | manual
  fix_config        JSONB,               -- parameters for automated fix
  status            TEXT NOT NULL DEFAULT 'open',
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### pipelines table

```sql
CREATE TABLE pipelines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  definition      JSONB NOT NULL,        -- DAG: nodes, edges, config per node
  input_dataset   UUID REFERENCES datasets(id),
  task_type       TEXT,
  output_format   TEXT,
  version         INT NOT NULL DEFAULT 1,
  template_id     UUID,
  is_template     BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 3.3 Key Indexes

```sql
-- Quality scans: fast lookup by dataset, ordered by recency
CREATE INDEX idx_quality_scans_dataset ON quality_scans(dataset_id, created_at DESC);

-- Issues: fast filtering by severity and status
CREATE INDEX idx_issues_scan_severity ON quality_issues(scan_id, severity, status);
CREATE INDEX idx_issues_impact ON quality_issues(dataset_id, impact_score DESC);

-- Datasets: org-scoped queries with status filter
CREATE INDEX idx_datasets_org ON datasets(org_id, status, created_at DESC);

-- Pipeline runs: status monitoring
CREATE INDEX idx_runs_status ON pipeline_runs(org_id, status, created_at DESC);
```

---

## 4. Quality Engine — Technical Design

### 4.1 Architecture

The quality engine runs as a Spark job for datasets >100MB and as a Polars job for smaller datasets. The core algorithm is embarrassingly parallel — each quality dimension computed independently across columns, then aggregated.

> **Performance Target:** 1M row, 50-column dataset: full quality scan in < 5 minutes on standard worker pool (8 CPU cores, 32GB RAM per worker, 4 workers).

---

### 4.2 Completeness Analysis

#### Null Census

```python
def compute_null_census(df: pl.DataFrame) -> dict:
    results = {}
    for col in df.columns:
        null_count = df[col].null_count()
        total = len(df)
        results[col] = {
            'null_count': null_count,
            'null_pct': round(null_count / total * 100, 3),
            'missingness_type': classify_missingness(df, col)
        }
    return results
```

#### Missingness Pattern Classifier

```python
def classify_missingness(df, col) -> str:
    # MCAR test: compare null rate across random splits
    # MAR test: check if nulls correlate with other column values
    # MNAR test: model the column, check if residuals predict nullness
    null_mask = df[col].is_null()
    if is_independent_of_all_columns(df, null_mask): return 'MCAR'
    if correlates_with_other_columns(df, null_mask): return 'MAR'
    return 'MNAR'
```

---

### 4.3 Duplicate Detection

#### Exact Duplicate Detection

```python
def find_exact_duplicates(df: pl.DataFrame, key_cols=None) -> pl.DataFrame:
    cols = key_cols or df.columns
    return df.with_columns(
        pl.concat_str(cols, separator='|||').hash().alias('_row_hash')
    ).filter(pl.col('_row_hash').is_duplicated())
```

#### Fuzzy Duplicate Detection (Text)

```python
from datasketch import MinHash, MinHashLSH

def find_fuzzy_duplicates(texts: list[str], threshold=0.85) -> list[tuple]:
    lsh = MinHashLSH(threshold=threshold, num_perm=128)
    minhashes = {}
    for i, text in enumerate(texts):
        m = MinHash(num_perm=128)
        for shingle in get_shingles(text, k=3):
            m.update(shingle.encode('utf8'))
        lsh.insert(str(i), m)
        minhashes[str(i)] = m
    return [(i, lsh.query(minhashes[str(i)])) for i in range(len(texts))]
```

---

### 4.4 Outlier Detection

#### Multi-Method Ensemble

```python
def detect_outliers(df: pl.DataFrame, col: str) -> pl.Series:
    scores = []
    # 1. Z-score (for normal distributions)
    if is_approximately_normal(df[col]):
        scores.append(zscore_outliers(df[col]))
    # 2. IQR (for skewed distributions)
    else:
        scores.append(iqr_outliers(df[col]))
    # 3. Isolation Forest (multivariate context)
    scores.append(isolation_forest_scores(df, col))
    # Ensemble: flag if 2+ methods agree
    return ensemble_vote(scores, threshold=2)
```

---

### 4.5 Label Quality — Confident Learning

```python
from cleanlab.filter import find_label_issues

def detect_label_noise(X: np.ndarray, y: np.ndarray, cv_folds=5) -> np.ndarray:
    clf = LogisticRegression()
    pred_probs = cross_val_predict(clf, X, y, cv=cv_folds, method='predict_proba')
    label_issues = find_label_issues(
        labels=y,
        pred_probs=pred_probs,
        return_indices_ranked_by='self_confidence'
    )
    return label_issues
```

---

### 4.6 Quality Score Calculation

```python
def compute_quality_score(dimension_scores: dict, weights: dict) -> dict:
    total_weight = sum(weights.values())
    weighted_sum = sum(
        dimension_scores[dim] * weights[dim]
        for dim in dimension_scores
    )
    overall = round(weighted_sum / total_weight, 1)
    # Apply critical column multiplier
    critical_penalty = compute_critical_column_penalty(dimension_scores)
    final_score = max(0, min(100, overall - critical_penalty))
    return {'overall': final_score, 'dimensions': dimension_scores}
```

---

## 5. Pipeline Engine — Technical Design

### 5.1 NLP Task Parser

#### Intent Classification

```python
class TaskClassifier:
    def __init__(self):
        self.model = AutoModelForSequenceClassification.from_pretrained(
            'datrix/task-classifier-v1'
        )
        self.tokenizer = AutoTokenizer.from_pretrained('datrix/task-classifier-v1')
        self.labels = TASK_TYPE_LABELS  # 50+ task types

    def classify(self, description: str) -> dict:
        inputs = self.tokenizer(description, return_tensors='pt', truncation=True)
        logits = self.model(**inputs).logits
        probs = torch.softmax(logits, dim=-1)
        top_k = torch.topk(probs, 3)
        return {
            'task_type': self.labels[top_k.indices[0]],
            'confidence': float(top_k.values[0]),
            'alternatives': [self.labels[i] for i in top_k.indices[1:]]
        }
```

---

### 5.2 Pipeline DAG Representation

```json
{
  "pipeline_id": "pipe_abc123",
  "nodes": [
    {"id": "n1", "type": "source", "config": {"dataset_id": "ds_xyz"}},
    {"id": "n2", "type": "filter", "config": {"conditions": [{"col": "amount", "op": ">", "val": 0}]}},
    {"id": "n3", "type": "encode", "config": {"strategy": "one_hot", "columns": ["category"]}},
    {"id": "n4", "type": "split",  "config": {"ratios": [0.7, 0.15, 0.15]}},
    {"id": "n5", "type": "output", "config": {"format": "huggingface"}}
  ],
  "edges": [
    {"from": "n1", "to": "n2"},
    {"from": "n2", "to": "n3"},
    {"from": "n3", "to": "n4"},
    {"from": "n4", "to": "n5"}
  ]
}
```

---

### 5.3 Spark Execution Engine

```python
class PipelineExecutor:
    def execute(self, pipeline: Pipeline, dataset_id: str) -> ExecutionResult:
        # Build execution order from DAG (topological sort)
        exec_order = topological_sort(pipeline.nodes, pipeline.edges)
        # Load dataset as Spark DataFrame
        df = self.spark.read.parquet(get_s3_path(dataset_id))
        checkpoints = {}
        for node in exec_order:
            handler = NODE_HANDLERS[node.type]
            df = handler.execute(df, node.config)
            # Checkpoint after each step for resume capability
            checkpoint_path = write_checkpoint(df, node.id)
            checkpoints[node.id] = checkpoint_path
            self.emit_progress(node.id, df.count())
        return ExecutionResult(output_df=df, checkpoints=checkpoints)
```

---

## 6. Synthetic Data Engine — Technical Design

### 6.1 Tabular Generation — CTGAN

```python
from ctgan import CTGAN

class TabularGenerator:
    def train(self, df: pd.DataFrame, categorical_cols: list) -> None:
        self.model = CTGAN(
            epochs=300,
            batch_size=500,
            generator_lr=2e-4,
            discriminator_lr=2e-4,
            generator_dim=(256, 256),
            discriminator_dim=(256, 256),
            pac=10
        )
        self.model.fit(df, categorical_cols)

    def generate(self, n: int, conditions: dict = None) -> pd.DataFrame:
        if conditions:
            return self.model.sample(n, condition_column=conditions['col'],
                                    condition_value=conditions['val'])
        return self.model.sample(n)
```

---

### 6.2 Privacy Validation

```python
def compute_privacy_score(real_df: pd.DataFrame, synth_df: pd.DataFrame) -> float:
    scores = []
    # 1. Membership inference test
    mia_score = membership_inference_attack(real_df, synth_df)
    scores.append(1 - mia_score)
    # 2. Nearest neighbour distance
    nn_dist = nearest_neighbour_distance_ratio(real_df, synth_df)
    scores.append(min(1.0, nn_dist / NN_DIST_THRESHOLD))
    # 3. Attribute inference
    attr_score = attribute_inference_risk(real_df, synth_df)
    scores.append(1 - attr_score)
    # Weighted average; privacy score 0-100
    return round(np.average(scores, weights=[0.4, 0.4, 0.2]) * 100, 1)
```

---

## 7. Infrastructure & DevOps

### 7.1 Kubernetes Cluster Topology

| Node Pool | Instance Type | Count | Workloads |
|---|---|---|---|
| System nodes | c6i.2xlarge (8 CPU, 16GB) | 2 (HA) | API gateway, Redis, monitoring |
| App nodes | c6i.4xlarge (16 CPU, 32GB) | 3–10 (autoscale) | Application services, quality workers |
| Spark nodes | r6i.8xlarge (32 CPU, 256GB) | 2–20 (autoscale) | Pipeline execution, large quality scans |
| GPU nodes | g5.4xlarge (16 CPU, 64GB, A10G GPU) | 0–8 (autoscale) | Synthetic generation, ML models |
| Storage nodes | Persistent EBS gp3 | N/A | PostgreSQL, Elasticsearch, Kafka |

---

### 7.2 CI/CD Pipeline

1. Developer pushes to feature branch
2. GitHub Actions: lint, type check, unit tests (target: < 3 minutes)
3. PR opened: integration tests run on ephemeral environment (target: < 15 minutes)
4. PR merged to main: staging deployment via Argo CD (GitOps)
5. Staging: smoke tests, E2E tests, performance regression check
6. Manual approval gate for production deployment
7. Production: blue-green deployment via Argo CD; canary traffic routing
8. Automated rollback: if error rate > 1% within 10 minutes, auto-rollback

---

### 7.3 Observability Stack

| Concern | Tool | What It Monitors |
|---|---|---|
| Metrics | Prometheus + Grafana | Service latency, error rates, queue depths, resource utilisation |
| Logs | Datadog | Structured JSON logs from all services; correlation IDs throughout |
| Traces | OpenTelemetry + Jaeger | Distributed tracing — every request traced end-to-end |
| Alerts | PagerDuty | SLO breach, error rate spike, queue backup, data pipeline failure |
| Uptime | Checkly | Synthetic monitoring of all public API endpoints and web app |
| Profiling | Pyroscope | Continuous profiling of Python services — CPU and memory |

---

### 7.4 SLOs

| SLO | Target | Measurement |
|---|---|---|
| API availability | 99.9% over rolling 30 days | < 43.2 minutes downtime/month |
| API p95 latency | < 200ms for all dashboard reads | Measured by Checkly synthetics |
| Quality scan throughput | 1M rows in < 5 minutes | P95 of all scan jobs |
| Data durability | 99.999999999% (11 nines) | S3 SLA + cross-region replication |
| Incident response | Critical: < 15 min to page; < 1hr to mitigate | PagerDuty routing |

---

### 7.5 Disaster Recovery

- **RTO: < 1 hour** — all stateless services restart from container image within minutes; database failover automated
- **RPO: < 15 minutes** — PostgreSQL continuous WAL archival to S3; point-in-time recovery
- **Cross-region backup:** all data replicated to secondary region asynchronously
- **DR runbook:** tested quarterly; RTO and RPO verified in simulation
- **Data isolation guarantee:** even in DR scenario, cross-tenant access architecturally impossible

---

## 8. Security Architecture

### 8.1 Defence in Depth Model

| Layer | Controls |
|---|---|
| Perimeter | AWS WAF, DDoS protection (Shield Advanced), IP allowlisting for enterprise |
| Network | VPC isolation, private subnets for all services, NAT gateway, no public IPs on workers |
| Application | JWT/SAML auth, RBAC+ABAC authorisation, input validation, OWASP top 10 mitigations |
| Data | AES-256 at rest, TLS 1.3 in transit, customer-managed keys (BYOK) for enterprise |
| Secrets | AWS Secrets Manager; no secrets in code or environment variables; rotation automated |
| Tenant isolation | Separate S3 bucket prefixes, PostgreSQL row-level security, Redis key namespacing |

---

### 8.2 Key Management

- **Platform keys:** AWS KMS — AES-256-GCM; automatic annual rotation
- **Customer BYOK:** customer provides KMS key ARN; platform uses for their data only
- **Key access:** only quality-service and ingestion-service have decrypt permissions
- **Key audit:** all key usage logged to CloudTrail; alerts on unusual access patterns

---

### 8.3 Vulnerability Management

- Annual third-party penetration test by CREST-certified firm
- Critical findings: remediated within 14 days
- High findings: remediated within 30 days
- Continuous SAST: Semgrep on every PR; blocks merge on critical findings
- Container scanning: Trivy scans all images in CI pipeline; blocks on CRITICAL CVEs
- Dependency scanning: Dependabot + Snyk; automated PRs for security updates

---

## 9. Python SDK Design

### 9.1 Core SDK Interface

```python
# Installation
# pip install datrix

from datrix import Datrix, Dataset, Pipeline, SyntheticEngine

# Initialise client
client = Datrix(api_key='dtx_...')

# Upload and scan dataset
ds = client.datasets.upload('training_data.csv')
scan = ds.scan()   # Returns immediately
scan.wait()        # Block until scan complete
print(scan.score)  # QualityScore(overall=74, completeness=89, ...)

# Inspect issues
for issue in scan.issues.order_by('impact').limit(5):
    print(f'{issue.column}: {issue.description} (impact: {issue.impact_pct:.1f}%)')

# Apply auto-fixes
preview = scan.fix_all(dry_run=True)
print(f'Fixes will change {preview.rows_affected} rows')
scan.fix_all(confirm=True)

# Build and run pipeline
pipeline = client.pipelines.from_description(
    'Binary classification on customer churn, tabular data, output for XGBoost'
)
run = pipeline.run(ds)
run.wait()
output = run.output  # DatasetOutput with download_url and metadata

# Generate synthetic data
synth = SyntheticEngine(client)
synthetic_ds = synth.generate(
    dataset=ds,
    n_rows=50_000,
    conditions={'churn': 1},   # Generate only minority class
    min_privacy_score=80
)
print(f'Privacy score: {synthetic_ds.privacy_score}')
```

---

### 9.2 Async Support

```python
import asyncio
from datrix.async_client import AsyncDatrix

async def main():
    client = AsyncDatrix(api_key='dtx_...')
    ds = await client.datasets.upload('training_data.csv')
    scan = await ds.scan()
    await scan.wait()
    print(scan.score)

asyncio.run(main())
```

---

## 10. Federated Processing Architecture

### 10.1 Agent Deployment

```bash
# Deploy federated agent via Docker
docker pull datrix/federated-agent:latest

docker run -d \
  --name datrix-agent \
  -e DATRIX_API_KEY=dtx_... \
  -e DATRIX_ORG_ID=org_... \
  -e DATA_DIR=/data \
  -v /your/data:/data:ro \
  --cpus=8 --memory=32g \
  datrix/federated-agent:latest
```

---

### 10.2 Differential Privacy Implementation

```python
from opacus import PrivacyEngine

def train_with_dp(model, train_loader, target_epsilon=1.0, target_delta=1e-5):
    optimizer = torch.optim.SGD(model.parameters(), lr=0.05)
    privacy_engine = PrivacyEngine()
    model, optimizer, train_loader = privacy_engine.make_private_with_epsilon(
        module=model,
        optimizer=optimizer,
        data_loader=train_loader,
        epochs=10,
        target_epsilon=target_epsilon,
        target_delta=target_delta,
        max_grad_norm=1.0
    )
    # Training loop unchanged — privacy handled automatically
    return model, privacy_engine.get_epsilon(target_delta)
```

---

## 11. Appendices

### 11.1 Technology Stack Summary

| Layer | Technologies |
|---|---|
| Frontend | React 18, TypeScript 5, TanStack Query, Zustand, Recharts, React Flow |
| Backend (app services) | Python 3.12, FastAPI, SQLAlchemy 2.0, Celery, Pydantic v2 |
| Backend (data processing) | Apache Spark 3.5, Polars 0.20, Pandas 2.0, NumPy, SciPy |
| ML / AI | PyTorch 2.1, HuggingFace Transformers, CTGAN, cleanlab, opacus, scikit-learn |
| Databases | PostgreSQL 16, Redis 7, Elasticsearch 8, Apache Kafka 3.6, InfluxDB 2 |
| Infrastructure | AWS EKS (Kubernetes 1.29), Terraform, Argo CD, GitHub Actions |
| Observability | Datadog, OpenTelemetry, Jaeger, Prometheus, Grafana, PagerDuty |
| Security | AWS KMS, AWS WAF, AWS Shield Advanced, Semgrep, Trivy, Snyk |

---

### 11.2 External Dependencies & Licences

| Library | Licence | Usage |
|---|---|---|
| CTGAN | MIT | Synthetic tabular data generation — core dependency |
| cleanlab | AGPL-3.0 | Confident learning for label noise — proprietary wrapper required for commercial use |
| opacus | Apache 2.0 | Differential privacy for PyTorch — free for commercial use |
| datasketch | MIT | MinHash LSH for fuzzy deduplication |
| Apache Spark | Apache 2.0 | Distributed data processing |
| React Flow | MIT | Pipeline canvas |

### 11.3 Document History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2025 | Initial release — full platform technical specification covering Phases 1–4 |