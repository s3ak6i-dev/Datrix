"""
Persistent store for Phase 1.
All state serialised to data/db.json on every write.
Replace with PostgreSQL in Phase 2.
"""
import uuid
import json
import threading
from datetime import datetime, timezone
from dataclasses import dataclass, field, asdict
from typing import Optional
from pathlib import Path

from app.core.config import DATA_DIR

DB_PATH = DATA_DIR / "db.json"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

def _id() -> str:
    return str(uuid.uuid4())


@dataclass
class Dataset:
    id: str = field(default_factory=_id)
    name: str = ""
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    size_bytes: Optional[int] = None
    status: str = "pending"
    schema: Optional[list] = None
    file_path: str = ""
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)
    latest_scan_id: Optional[str] = None
    latest_score: Optional[float] = None
    error_message: Optional[str] = None


@dataclass
class QualityScan:
    id: str = field(default_factory=_id)
    dataset_id: str = ""
    status: str = "queued"
    score: Optional[dict] = None
    issues: list = field(default_factory=list)
    scan_duration_ms: Optional[int] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str = field(default_factory=_now)


@dataclass
class ColumnProfile:
    name: str = ""
    dtype: str = ""
    null_count: int = 0
    null_pct: float = 0.0
    unique_count: Optional[int] = None
    quality_score: float = 100.0
    issues: list = field(default_factory=list)
    distribution: list = field(default_factory=list)
    stats: dict = field(default_factory=dict)


@dataclass
class Pipeline:
    id: str = field(default_factory=_id)
    name: str = ""
    description: str = ""
    dataset_id: Optional[str] = None
    steps: list = field(default_factory=list)
    status: str = "draft"
    node_positions: Optional[dict] = None
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)


@dataclass
class PipelineRun:
    id: str = field(default_factory=_id)
    pipeline_id: str = ""
    dataset_id: str = ""
    status: str = "pending"
    is_dry_run: bool = True
    step_results: list = field(default_factory=list)
    output_path: Optional[str] = None
    output_format: str = "csv"
    rows_in: Optional[int] = None
    rows_out: Optional[int] = None
    cols_in: Optional[int] = None
    cols_out: Optional[int] = None
    error_message: Optional[str] = None
    output_preview: Optional[list] = None
    created_at: str = field(default_factory=_now)
    completed_at: Optional[str] = None


@dataclass
class ALSession:
    id: str = field(default_factory=_id)
    name: str = ""
    dataset_id: str = ""
    target_column: str = ""
    task_type: str = "classification"       # classification | regression
    model_type: str = "random_forest"       # logistic_regression | random_forest | xgboost | svm | mlp
    sampling_strategy: str = "entropy"      # least_confidence | margin | entropy | coreset | committee
    batch_size: int = 20
    label_classes: list = field(default_factory=list)   # classification only
    exclude_columns: list = field(default_factory=list) # columns to drop from features
    target_accuracy: Optional[float] = None
    max_rounds: int = 10
    model_name: str = ""   # user-defined export name
    # Runtime state
    status: str = "annotating"   # annotating | training | complete
    current_round: int = 1
    labels: dict = field(default_factory=dict)          # {str(row_idx): label_value}
    next_batch: list = field(default_factory=list)      # row indices to label
    model_path: Optional[str] = None
    rounds: list = field(default_factory=list)          # list of round result dicts
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)


@dataclass
class TrainedModel:
    id: str = field(default_factory=_id)
    dataset_id: str = ""
    method: str = ""          # statistical | ctgan | tvae
    model_path: str = ""
    status: str = "training"  # training | ready | failed
    error_message: Optional[str] = None
    created_at: str = field(default_factory=_now)


@dataclass
class SyntheticJob:
    id: str = field(default_factory=_id)
    source_dataset_id: str = ""
    output_dataset_id: Optional[str] = None
    output_name: str = ""
    method: str = "statistical"  # statistical | ctgan | tvae
    row_count: int = 1000
    column_overrides: Optional[dict] = None
    status: str = "pending"  # pending | running | complete | failed
    error_message: Optional[str] = None
    created_at: str = field(default_factory=_now)
    completed_at: Optional[str] = None


@dataclass
class MarketplaceAsset:
    id: str = field(default_factory=_id)
    title: str = ""
    description: str = ""
    long_description: str = ""
    asset_type: str = "dataset"     # dataset | pipeline | model | benchmark_config
    category: str = "general"       # ecommerce | finance | healthcare | marketing | logistics | hr | nlp | timeseries | general
    tags: list = field(default_factory=list)
    author_name: str = "Community"
    license: str = "mit"            # mit | cc_by | cc_by_nc | apache2 | proprietary
    version: str = "1.0.0"
    status: str = "published"       # draft | published | archived
    is_seeded: bool = False
    seed_key: str = ""
    download_count: int = 0
    view_count: int = 0
    rating_avg: float = 0.0
    rating_count: int = 0
    source_id: str = ""
    preview: dict = field(default_factory=dict)
    file_size: int = 0
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)
    published_at: str = field(default_factory=_now)


@dataclass
class MarketplaceReview:
    id: str = field(default_factory=_id)
    asset_id: str = ""
    author_name: str = ""
    rating: int = 5
    comment: str = ""
    created_at: str = field(default_factory=_now)


@dataclass
class MarketplaceInstall:
    id: str = field(default_factory=_id)
    asset_id: str = ""
    asset_title: str = ""
    asset_type: str = ""
    resulting_id: str = ""
    installed_at: str = field(default_factory=_now)


@dataclass
class BenchmarkJob:
    id: str = field(default_factory=_id)
    name: str = ""
    dataset_id: str = ""
    target_column: str = ""
    task_type: str = "classification"   # classification | regression
    eval_protocol: str = "kfold_5"     # kfold_5 | kfold_10 | holdout_80 | holdout_90
    candidates: list = field(default_factory=list)   # list of candidate config dicts
    status: str = "pending"             # pending | running | complete | failed
    results: list = field(default_factory=list)      # list of candidate result dicts
    winner_candidate_id: Optional[str] = None
    error_message: Optional[str] = None
    created_at: str = field(default_factory=_now)
    completed_at: Optional[str] = None


@dataclass
class ComplianceScan:
    id: str = field(default_factory=_id)
    dataset_id: str = ""
    status: str = "pending"          # pending | running | complete | failed
    scanned_at: Optional[str] = None
    duration_ms: Optional[int] = None
    findings: list = field(default_factory=list)   # list of column finding dicts
    overall_risk: str = "unscanned"  # unscanned | clean | low | medium | high | critical
    pii_column_count: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    rows_sampled: int = 0
    error_message: Optional[str] = None
    created_at: str = field(default_factory=_now)


@dataclass
class CompliancePolicy:
    id: str = field(default_factory=_id)
    name: str = ""
    policy_type: str = ""            # no_pii_in_training | pii_scan_required | min_quality_score | max_retention_days | min_row_count_for_training | no_unscanned_in_pipeline | model_accuracy_floor | benchmark_winner_required
    parameters: dict = field(default_factory=dict)
    severity: str = "warning"        # info | warning | critical
    enabled: bool = True
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)


@dataclass
class PolicyViolation:
    id: str = field(default_factory=_id)
    policy_id: str = ""
    policy_name: str = ""
    policy_type: str = ""
    entity_type: str = ""            # dataset | pipeline | al_session | benchmark_job
    entity_id: str = ""
    entity_name: str = ""
    message: str = ""
    severity: str = "warning"
    resolved: bool = False
    detected_at: str = field(default_factory=_now)
    resolved_at: Optional[str] = None


@dataclass
class AuditEvent:
    id: str = field(default_factory=_id)
    event_type: str = ""             # e.g. dataset.upload, al.train, compliance.pii_scan
    category: str = ""               # data | pipeline | ml | compliance | marketplace | settings
    entity_type: str = ""
    entity_id: str = ""
    entity_name: str = ""
    metadata: dict = field(default_factory=dict)
    duration_ms: Optional[int] = None
    created_at: str = field(default_factory=_now)


@dataclass
class AnonymizationJob:
    id: str = field(default_factory=_id)
    source_dataset_id: str = ""
    output_dataset_id: Optional[str] = None
    output_name: str = ""
    column_configs: list = field(default_factory=list)  # [{column, method, params}]
    status: str = "pending"          # pending | running | complete | failed
    rows_processed: int = 0
    row_count: int = 0
    columns_transformed: int = 0
    error_message: Optional[str] = None
    created_at: str = field(default_factory=_now)
    completed_at: Optional[str] = None


@dataclass
class ComplianceReport:
    id: str = field(default_factory=_id)
    framework: str = ""              # gdpr | ccpa | hipaa | general | custom
    sections: list = field(default_factory=list)
    status: str = "pending"          # pending | complete | failed
    entity_count: int = 0
    findings_count: int = 0
    violation_count: int = 0
    risk_score: int = 0
    file_path: Optional[str] = None
    error_message: Optional[str] = None
    created_at: str = field(default_factory=_now)


@dataclass
class CleaningRecord:
    id: str = field(default_factory=_id)
    dataset_id: str = ""
    issue_id: str = ""
    method: str = ""
    rows_affected: int = 0
    applied_at: str = field(default_factory=_now)
    rolled_back: bool = False


DEFAULT_SETTINGS: dict = {
    # General
    "app_name": "Datrix",
    "date_format": "YYYY-MM-DD",
    "table_page_size": 50,
    # Storage
    "max_upload_mb": 10240,
    "allowed_extensions": [".csv", ".json", ".jsonl", ".parquet", ".xlsx", ".xls"],
    # Active Learning defaults
    "al_default_batch_size": 20,
    "al_default_model_type": "random_forest",
    "al_default_sampling_strategy": "entropy",
    "al_default_max_rounds": 10,
    "al_default_target_accuracy": None,
    # Benchmark defaults
    "benchmark_default_eval_protocol": "kfold_5",
    "benchmark_default_preset": "default",
    "benchmark_default_task_type": "classification",
    # Synthetic defaults
    "synthetic_default_method": "statistical",
    "synthetic_default_row_count": 1000,
    # Pipeline defaults
    "pipeline_default_output_format": "csv",
    # Export defaults
    "export_default_format": "csv",
}


def _load_db() -> dict:
    if DB_PATH.exists():
        try:
            return json.loads(DB_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {
        "datasets": {}, "scans": {}, "column_profiles": {},
        "cleaning_records": {}, "pipelines": {}, "pipeline_runs": {},
        "synthetic_jobs": {}, "trained_models": {}, "al_sessions": {},
        "benchmark_jobs": {}, "marketplace_assets": {},
        "marketplace_reviews": {}, "marketplace_installs": {},
        "compliance_scans": {}, "compliance_policies": {},
        "policy_violations": {}, "audit_events": [],
        "anonymization_jobs": {}, "compliance_reports": {},
        "settings": {},
    }


def _save_db(data: dict) -> None:
    tmp = DB_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, default=str), encoding="utf-8")
    tmp.replace(DB_PATH)


class Store:
    def __init__(self):
        self._lock = threading.Lock()
        raw = _load_db()

        self.datasets: dict[str, Dataset] = {
            k: Dataset(**v) for k, v in raw.get("datasets", {}).items()
        }
        self.scans: dict[str, QualityScan] = {
            k: QualityScan(**v) for k, v in raw.get("scans", {}).items()
        }
        self.column_profiles: dict[str, list[ColumnProfile]] = {
            k: [ColumnProfile(**p) for p in v]
            for k, v in raw.get("column_profiles", {}).items()
        }
        self.cleaning_records: dict[str, CleaningRecord] = {
            k: CleaningRecord(**v) for k, v in raw.get("cleaning_records", {}).items()
        }
        self.pipelines: dict[str, Pipeline] = {
            k: Pipeline(**v) for k, v in raw.get("pipelines", {}).items()
        }
        self.pipeline_runs: dict[str, PipelineRun] = {
            k: PipelineRun(**v) for k, v in raw.get("pipeline_runs", {}).items()
        }
        self.synthetic_jobs: dict[str, SyntheticJob] = {
            k: SyntheticJob(**v) for k, v in raw.get("synthetic_jobs", {}).items()
        }
        self.trained_models: dict[str, TrainedModel] = {
            k: TrainedModel(**v) for k, v in raw.get("trained_models", {}).items()
        }
        self.al_sessions: dict[str, ALSession] = {
            k: ALSession(**v) for k, v in raw.get("al_sessions", {}).items()
        }
        self.benchmark_jobs: dict[str, BenchmarkJob] = {
            k: BenchmarkJob(**v) for k, v in raw.get("benchmark_jobs", {}).items()
        }
        self.marketplace_assets: dict[str, MarketplaceAsset] = {
            k: MarketplaceAsset(**v) for k, v in raw.get("marketplace_assets", {}).items()
        }
        self.marketplace_reviews: dict[str, MarketplaceReview] = {
            k: MarketplaceReview(**v) for k, v in raw.get("marketplace_reviews", {}).items()
        }
        self.marketplace_installs: dict[str, MarketplaceInstall] = {
            k: MarketplaceInstall(**v) for k, v in raw.get("marketplace_installs", {}).items()
        }
        self.compliance_scans: dict[str, ComplianceScan] = {
            k: ComplianceScan(**v) for k, v in raw.get("compliance_scans", {}).items()
        }
        self.compliance_policies: dict[str, CompliancePolicy] = {
            k: CompliancePolicy(**v) for k, v in raw.get("compliance_policies", {}).items()
        }
        self.policy_violations: dict[str, PolicyViolation] = {
            k: PolicyViolation(**v) for k, v in raw.get("policy_violations", {}).items()
        }
        self.audit_events: list[AuditEvent] = [
            AuditEvent(**e) for e in raw.get("audit_events", [])
        ]
        self.anonymization_jobs: dict[str, AnonymizationJob] = {
            k: AnonymizationJob(**v) for k, v in raw.get("anonymization_jobs", {}).items()
        }
        self.compliance_reports: dict[str, ComplianceReport] = {
            k: ComplianceReport(**v) for k, v in raw.get("compliance_reports", {}).items()
        }
        saved = raw.get("settings", {})
        self.settings: dict = {**DEFAULT_SETTINGS, **saved}

    def _persist(self) -> None:
        data = {
            "datasets": {k: asdict(v) for k, v in self.datasets.items()},
            "scans": {k: asdict(v) for k, v in self.scans.items()},
            "column_profiles": {
                k: [asdict(p) for p in v]
                for k, v in self.column_profiles.items()
            },
            "cleaning_records": {k: asdict(v) for k, v in self.cleaning_records.items()},
            "pipelines": {k: asdict(v) for k, v in self.pipelines.items()},
            "pipeline_runs": {k: asdict(v) for k, v in self.pipeline_runs.items()},
            "synthetic_jobs": {k: asdict(v) for k, v in self.synthetic_jobs.items()},
            "trained_models": {k: asdict(v) for k, v in self.trained_models.items()},
            "al_sessions": {k: asdict(v) for k, v in self.al_sessions.items()},
            "benchmark_jobs": {k: asdict(v) for k, v in self.benchmark_jobs.items()},
            "marketplace_assets": {k: asdict(v) for k, v in self.marketplace_assets.items()},
            "marketplace_reviews": {k: asdict(v) for k, v in self.marketplace_reviews.items()},
            "marketplace_installs": {k: asdict(v) for k, v in self.marketplace_installs.items()},
            "compliance_scans": {k: asdict(v) for k, v in self.compliance_scans.items()},
            "compliance_policies": {k: asdict(v) for k, v in self.compliance_policies.items()},
            "policy_violations": {k: asdict(v) for k, v in self.policy_violations.items()},
            "audit_events": [asdict(e) for e in self.audit_events[-10000:]],
            "anonymization_jobs": {k: asdict(v) for k, v in self.anonymization_jobs.items()},
            "compliance_reports": {k: asdict(v) for k, v in self.compliance_reports.items()},
            "settings": self.settings,
        }
        _save_db(data)

    # ── Datasets ──────────────────────────────────────────────────────

    def add_dataset(self, ds: Dataset) -> Dataset:
        with self._lock:
            self.datasets[ds.id] = ds
            self._persist()
        return ds

    def update_dataset(self, ds: Dataset) -> Dataset:
        with self._lock:
            ds.updated_at = _now()
            self.datasets[ds.id] = ds
            self._persist()
        return ds

    def get_dataset(self, id: str) -> Optional[Dataset]:
        return self.datasets.get(id)

    def list_datasets(self) -> list[Dataset]:
        return sorted(self.datasets.values(), key=lambda d: d.created_at, reverse=True)

    def delete_dataset(self, id: str) -> None:
        with self._lock:
            self.datasets.pop(id, None)
            self.column_profiles.pop(id, None)
            # Remove associated scans
            to_del = [sid for sid, s in self.scans.items() if s.dataset_id == id]
            for sid in to_del:
                self.scans.pop(sid, None)
            self._persist()

    # ── Scans ─────────────────────────────────────────────────────────

    def add_scan(self, scan: QualityScan) -> QualityScan:
        with self._lock:
            self.scans[scan.id] = scan
            self._persist()
        return scan

    def update_scan(self, scan: QualityScan) -> QualityScan:
        with self._lock:
            self.scans[scan.id] = scan
            self._persist()
        return scan

    def get_scan(self, id: str) -> Optional[QualityScan]:
        return self.scans.get(id)

    def get_latest_scan(self, dataset_id: str) -> Optional[QualityScan]:
        scans = [s for s in self.scans.values() if s.dataset_id == dataset_id]
        if not scans:
            return None
        return max(scans, key=lambda s: s.created_at)

    def list_scans(self, dataset_id: str) -> list[QualityScan]:
        scans = [s for s in self.scans.values() if s.dataset_id == dataset_id]
        return sorted(scans, key=lambda s: s.created_at)

    # ── Column profiles ───────────────────────────────────────────────

    def set_column_profiles(self, dataset_id: str, profiles: list[ColumnProfile]) -> None:
        with self._lock:
            self.column_profiles[dataset_id] = profiles
            self._persist()

    def get_column_profiles(self, dataset_id: str) -> list[ColumnProfile]:
        return self.column_profiles.get(dataset_id, [])

    # ── Cleaning ──────────────────────────────────────────────────────

    def add_cleaning_record(self, rec: CleaningRecord) -> CleaningRecord:
        with self._lock:
            self.cleaning_records[rec.id] = rec
            self._persist()
        return rec

    def get_cleaning_records(self, dataset_id: str) -> list[CleaningRecord]:
        return [r for r in self.cleaning_records.values() if r.dataset_id == dataset_id]

    # ── Pipelines ─────────────────────────────────────────────────────

    def add_pipeline(self, p: Pipeline) -> Pipeline:
        with self._lock:
            self.pipelines[p.id] = p
            self._persist()
        return p

    def update_pipeline(self, p: Pipeline) -> Pipeline:
        with self._lock:
            p.updated_at = _now()
            self.pipelines[p.id] = p
            self._persist()
        return p

    def get_pipeline(self, id: str) -> Optional[Pipeline]:
        return self.pipelines.get(id)

    def list_pipelines(self) -> list[Pipeline]:
        return sorted(self.pipelines.values(), key=lambda p: p.created_at, reverse=True)

    def delete_pipeline(self, id: str) -> None:
        with self._lock:
            self.pipelines.pop(id, None)
            to_del = [rid for rid, r in self.pipeline_runs.items() if r.pipeline_id == id]
            for rid in to_del:
                self.pipeline_runs.pop(rid, None)
            self._persist()

    # ── Pipeline runs ─────────────────────────────────────────────────

    def add_pipeline_run(self, r: PipelineRun) -> PipelineRun:
        with self._lock:
            self.pipeline_runs[r.id] = r
            self._persist()
        return r

    def update_pipeline_run(self, r: PipelineRun) -> PipelineRun:
        with self._lock:
            self.pipeline_runs[r.id] = r
            self._persist()
        return r

    def get_pipeline_run(self, id: str) -> Optional[PipelineRun]:
        return self.pipeline_runs.get(id)

    def list_pipeline_runs(self, pipeline_id: str) -> list[PipelineRun]:
        runs = [r for r in self.pipeline_runs.values() if r.pipeline_id == pipeline_id]
        return sorted(runs, key=lambda r: r.created_at, reverse=True)


    # ── Active learning sessions ──────────────────────────────────────

    def add_al_session(self, s: ALSession) -> ALSession:
        with self._lock:
            self.al_sessions[s.id] = s
            self._persist()
        return s

    def update_al_session(self, s: ALSession) -> ALSession:
        with self._lock:
            s.updated_at = _now()
            self.al_sessions[s.id] = s
            self._persist()
        return s

    def get_al_session(self, id: str) -> Optional[ALSession]:
        return self.al_sessions.get(id)

    def list_al_sessions(self) -> list[ALSession]:
        return sorted(self.al_sessions.values(), key=lambda s: s.created_at, reverse=True)

    def delete_al_session(self, id: str) -> None:
        with self._lock:
            self.al_sessions.pop(id, None)
            self._persist()

    # ── Trained models ────────────────────────────────────────────────

    def add_trained_model(self, m: TrainedModel) -> TrainedModel:
        with self._lock:
            self.trained_models[m.id] = m
            self._persist()
        return m

    def update_trained_model(self, m: TrainedModel) -> TrainedModel:
        with self._lock:
            self.trained_models[m.id] = m
            self._persist()
        return m

    def get_trained_model(self, id: str) -> Optional[TrainedModel]:
        return self.trained_models.get(id)

    def find_trained_model(self, dataset_id: str, method: str) -> Optional[TrainedModel]:
        candidates = [
            m for m in self.trained_models.values()
            if m.dataset_id == dataset_id and m.method == method and m.status == "ready"
        ]
        return max(candidates, key=lambda m: m.created_at) if candidates else None

    def list_trained_models(self) -> list[TrainedModel]:
        return sorted(self.trained_models.values(), key=lambda m: m.created_at, reverse=True)

    def delete_trained_model(self, id: str) -> None:
        with self._lock:
            self.trained_models.pop(id, None)
            self._persist()

    # ── Synthetic jobs ────────────────────────────────────────────────

    def add_synthetic_job(self, j: SyntheticJob) -> SyntheticJob:
        with self._lock:
            self.synthetic_jobs[j.id] = j
            self._persist()
        return j

    def update_synthetic_job(self, j: SyntheticJob) -> SyntheticJob:
        with self._lock:
            self.synthetic_jobs[j.id] = j
            self._persist()
        return j

    def get_synthetic_job(self, id: str) -> Optional[SyntheticJob]:
        return self.synthetic_jobs.get(id)

    def list_synthetic_jobs(self) -> list[SyntheticJob]:
        return sorted(self.synthetic_jobs.values(), key=lambda j: j.created_at, reverse=True)


    # ── Marketplace ───────────────────────────────────────────────────

    def add_marketplace_asset(self, a) -> object:
        with self._lock:
            self.marketplace_assets[a.id] = a
            self._persist()
        return a

    def update_marketplace_asset(self, a) -> object:
        with self._lock:
            a.updated_at = _now()
            self.marketplace_assets[a.id] = a
            self._persist()
        return a

    def get_marketplace_asset(self, id: str) -> Optional[object]:
        return self.marketplace_assets.get(id)

    def list_marketplace_assets(self) -> list:
        return sorted(self.marketplace_assets.values(), key=lambda a: a.created_at, reverse=True)

    def delete_marketplace_asset(self, id: str) -> None:
        with self._lock:
            self.marketplace_assets.pop(id, None)
            self._persist()

    def add_marketplace_review(self, r) -> object:
        with self._lock:
            self.marketplace_reviews[r.id] = r
            self._persist()
        return r

    def list_marketplace_reviews(self, asset_id: str) -> list:
        return sorted(
            [r for r in self.marketplace_reviews.values() if r.asset_id == asset_id],
            key=lambda r: r.created_at, reverse=True,
        )

    def add_marketplace_install(self, i) -> object:
        with self._lock:
            self.marketplace_installs[i.id] = i
            self._persist()
        return i

    def list_marketplace_installs(self) -> list:
        return sorted(self.marketplace_installs.values(), key=lambda i: i.installed_at, reverse=True)

    # ── Benchmark jobs ────────────────────────────────────────────────

    def add_benchmark_job(self, j: BenchmarkJob) -> BenchmarkJob:
        with self._lock:
            self.benchmark_jobs[j.id] = j
            self._persist()
        return j

    def update_benchmark_job(self, j: BenchmarkJob) -> BenchmarkJob:
        with self._lock:
            self.benchmark_jobs[j.id] = j
            self._persist()
        return j

    def patch_benchmark_result(self, job_id: str, candidate_id: str, **kwargs) -> None:
        with self._lock:
            job = self.benchmark_jobs.get(job_id)
            if not job:
                return
            for i, r in enumerate(job.results):
                if r.get('candidate_id') == candidate_id:
                    job.results[i] = {**r, **kwargs}
                    break
            self._persist()

    def get_benchmark_job(self, id: str) -> Optional[BenchmarkJob]:
        return self.benchmark_jobs.get(id)

    def list_benchmark_jobs(self) -> list[BenchmarkJob]:
        return sorted(self.benchmark_jobs.values(), key=lambda j: j.created_at, reverse=True)

    def delete_benchmark_job(self, id: str) -> None:
        with self._lock:
            self.benchmark_jobs.pop(id, None)
            self._persist()

    # ── Compliance scans ──────────────────────────────────────────────

    def add_compliance_scan(self, s: ComplianceScan) -> ComplianceScan:
        with self._lock:
            self.compliance_scans[s.id] = s
            self._persist()
        return s

    def update_compliance_scan(self, s: ComplianceScan) -> ComplianceScan:
        with self._lock:
            self.compliance_scans[s.id] = s
            self._persist()
        return s

    def get_compliance_scan(self, id: str) -> Optional[ComplianceScan]:
        return self.compliance_scans.get(id)

    def get_latest_compliance_scan(self, dataset_id: str) -> Optional[ComplianceScan]:
        scans = [s for s in self.compliance_scans.values()
                 if s.dataset_id == dataset_id and s.status == 'complete']
        return max(scans, key=lambda s: s.scanned_at or '') if scans else None

    def list_compliance_scans(self) -> list[ComplianceScan]:
        return sorted(self.compliance_scans.values(), key=lambda s: s.created_at, reverse=True)

    # ── Compliance policies ───────────────────────────────────────────

    def add_compliance_policy(self, p: CompliancePolicy) -> CompliancePolicy:
        with self._lock:
            self.compliance_policies[p.id] = p
            self._persist()
        return p

    def update_compliance_policy(self, p: CompliancePolicy) -> CompliancePolicy:
        with self._lock:
            p.updated_at = _now()
            self.compliance_policies[p.id] = p
            self._persist()
        return p

    def get_compliance_policy(self, id: str) -> Optional[CompliancePolicy]:
        return self.compliance_policies.get(id)

    def list_compliance_policies(self) -> list[CompliancePolicy]:
        return sorted(self.compliance_policies.values(), key=lambda p: p.created_at)

    def delete_compliance_policy(self, id: str) -> None:
        with self._lock:
            self.compliance_policies.pop(id, None)
            to_del = [vid for vid, v in self.policy_violations.items() if v.policy_id == id]
            for vid in to_del:
                self.policy_violations.pop(vid, None)
            self._persist()

    # ── Policy violations ─────────────────────────────────────────────

    def upsert_violations(self, violations: list[PolicyViolation]) -> None:
        with self._lock:
            for v in violations:
                self.policy_violations[v.id] = v
            self._persist()

    def clear_violations_for_policy(self, policy_id: str) -> None:
        with self._lock:
            to_del = [vid for vid, v in self.policy_violations.items() if v.policy_id == policy_id]
            for vid in to_del:
                self.policy_violations.pop(vid, None)
            self._persist()

    def resolve_violation(self, id: str) -> Optional[PolicyViolation]:
        with self._lock:
            v = self.policy_violations.get(id)
            if v:
                v.resolved = True
                v.resolved_at = _now()
                self._persist()
        return v

    def list_violations(self, resolved: bool = False) -> list[PolicyViolation]:
        return sorted(
            [v for v in self.policy_violations.values() if v.resolved == resolved],
            key=lambda v: v.detected_at, reverse=True,
        )

    # ── Audit events ──────────────────────────────────────────────────

    def add_audit_event(self, e: AuditEvent) -> AuditEvent:
        with self._lock:
            self.audit_events.append(e)
            if len(self.audit_events) > 10000:
                self.audit_events = self.audit_events[-10000:]
            self._persist()
        return e

    def list_audit_events(self, category: Optional[str] = None, event_type: Optional[str] = None,
                          entity_name: Optional[str] = None, limit: int = 100, offset: int = 0) -> list[AuditEvent]:
        events = list(reversed(self.audit_events))
        if category:
            events = [e for e in events if e.category == category]
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        if entity_name:
            nl = entity_name.lower()
            events = [e for e in events if nl in e.entity_name.lower()]
        return events[offset:offset + limit]

    def count_audit_events(self, since_iso: Optional[str] = None) -> int:
        if since_iso:
            return sum(1 for e in self.audit_events if e.created_at >= since_iso)
        return len(self.audit_events)

    # ── Anonymization jobs ────────────────────────────────────────────

    def add_anonymization_job(self, j: AnonymizationJob) -> AnonymizationJob:
        with self._lock:
            self.anonymization_jobs[j.id] = j
            self._persist()
        return j

    def update_anonymization_job(self, j: AnonymizationJob) -> AnonymizationJob:
        with self._lock:
            self.anonymization_jobs[j.id] = j
            self._persist()
        return j

    def get_anonymization_job(self, id: str) -> Optional[AnonymizationJob]:
        return self.anonymization_jobs.get(id)

    def list_anonymization_jobs(self) -> list[AnonymizationJob]:
        return sorted(self.anonymization_jobs.values(), key=lambda j: j.created_at, reverse=True)

    # ── Compliance reports ────────────────────────────────────────────

    def add_compliance_report(self, r: ComplianceReport) -> ComplianceReport:
        with self._lock:
            self.compliance_reports[r.id] = r
            self._persist()
        return r

    def update_compliance_report(self, r: ComplianceReport) -> ComplianceReport:
        with self._lock:
            self.compliance_reports[r.id] = r
            self._persist()
        return r

    def get_compliance_report(self, id: str) -> Optional[ComplianceReport]:
        return self.compliance_reports.get(id)

    def list_compliance_reports(self) -> list[ComplianceReport]:
        return sorted(self.compliance_reports.values(), key=lambda r: r.created_at, reverse=True)

    def delete_compliance_report(self, id: str) -> None:
        with self._lock:
            r = self.compliance_reports.pop(id, None)
            self._persist()
        if r and r.file_path:
            from pathlib import Path
            Path(r.file_path).unlink(missing_ok=True)

    # ── Settings ──────────────────────────────────────────────────────

    def get_settings(self) -> dict:
        return {**DEFAULT_SETTINGS, **self.settings}

    def update_settings(self, patch: dict) -> dict:
        with self._lock:
            for k, v in patch.items():
                if k in DEFAULT_SETTINGS:
                    self.settings[k] = v
            self._persist()
        return self.get_settings()

    def reset_settings(self) -> dict:
        with self._lock:
            self.settings = dict(DEFAULT_SETTINGS)
            self._persist()
        return self.get_settings()


store = Store()
