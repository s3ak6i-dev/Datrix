"""
Persistent store — backed by Neon Postgres via SQLAlchemy.
Keeps the same dataclass types and method signatures as the original
flat-file store so the API layer requires no changes.
"""
import uuid
import dataclasses
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from app.db.session import db_session
import app.db.models as M


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _id() -> str:
    return str(uuid.uuid4())


# ── Dataclasses (unchanged public API) ────────────────────────────────────────

@dataclass
class Dataset:
    id: str = field(default_factory=_id)
    user_id: str = ""
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
    user_id: str = ""
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
    user_id: str = ""
    name: str = ""
    dataset_id: str = ""
    target_column: str = ""
    task_type: str = "classification"
    model_type: str = "random_forest"
    sampling_strategy: str = "entropy"
    batch_size: int = 20
    label_classes: list = field(default_factory=list)
    exclude_columns: list = field(default_factory=list)
    target_accuracy: Optional[float] = None
    max_rounds: int = 10
    model_name: str = ""
    status: str = "annotating"
    current_round: int = 1
    labels: dict = field(default_factory=dict)
    next_batch: list = field(default_factory=list)
    model_path: Optional[str] = None
    rounds: list = field(default_factory=list)
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)


@dataclass
class TrainedModel:
    id: str = field(default_factory=_id)
    dataset_id: str = ""
    method: str = ""
    model_path: str = ""
    status: str = "training"
    error_message: Optional[str] = None
    created_at: str = field(default_factory=_now)


@dataclass
class SyntheticJob:
    id: str = field(default_factory=_id)
    user_id: str = ""
    source_dataset_id: str = ""
    output_dataset_id: Optional[str] = None
    output_name: str = ""
    method: str = "statistical"
    row_count: int = 1000
    column_overrides: Optional[dict] = None
    status: str = "pending"
    error_message: Optional[str] = None
    created_at: str = field(default_factory=_now)
    completed_at: Optional[str] = None


@dataclass
class MarketplaceAsset:
    id: str = field(default_factory=_id)
    title: str = ""
    description: str = ""
    long_description: str = ""
    asset_type: str = "dataset"
    category: str = "general"
    tags: list = field(default_factory=list)
    author_name: str = "Community"
    license: str = "mit"
    version: str = "1.0.0"
    status: str = "published"
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
    user_id: str = ""
    name: str = ""
    dataset_id: str = ""
    target_column: str = ""
    task_type: str = "classification"
    eval_protocol: str = "kfold_5"
    candidates: list = field(default_factory=list)
    status: str = "pending"
    results: list = field(default_factory=list)
    winner_candidate_id: Optional[str] = None
    error_message: Optional[str] = None
    created_at: str = field(default_factory=_now)
    completed_at: Optional[str] = None


@dataclass
class ComplianceScan:
    id: str = field(default_factory=_id)
    dataset_id: str = ""
    status: str = "pending"
    scanned_at: Optional[str] = None
    duration_ms: Optional[int] = None
    findings: list = field(default_factory=list)
    overall_risk: str = "unscanned"
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
    policy_type: str = ""
    parameters: dict = field(default_factory=dict)
    severity: str = "warning"
    enabled: bool = True
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)


@dataclass
class PolicyViolation:
    id: str = field(default_factory=_id)
    policy_id: str = ""
    policy_name: str = ""
    policy_type: str = ""
    entity_type: str = ""
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
    event_type: str = ""
    category: str = ""
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
    column_configs: list = field(default_factory=list)
    status: str = "pending"
    rows_processed: int = 0
    row_count: int = 0
    columns_transformed: int = 0
    error_message: Optional[str] = None
    created_at: str = field(default_factory=_now)
    completed_at: Optional[str] = None


@dataclass
class ComplianceReport:
    id: str = field(default_factory=_id)
    framework: str = ""
    sections: list = field(default_factory=list)
    status: str = "pending"
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
    "app_name": "Datrix",
    "date_format": "YYYY-MM-DD",
    "table_page_size": 50,
    "max_upload_mb": 10240,
    "allowed_extensions": [".csv", ".json", ".jsonl", ".parquet", ".xlsx", ".xls"],
    "al_default_batch_size": 20,
    "al_default_model_type": "random_forest",
    "al_default_sampling_strategy": "entropy",
    "al_default_max_rounds": 10,
    "al_default_target_accuracy": None,
    "benchmark_default_eval_protocol": "kfold_5",
    "benchmark_default_preset": "default",
    "benchmark_default_task_type": "classification",
    "synthetic_default_method": "statistical",
    "synthetic_default_row_count": 1000,
    "pipeline_default_output_format": "csv",
    "export_default_format": "csv",
}


# ── ORM ↔ dataclass conversion helpers ───────────────────────────────────────

def _dc(cls, obj):
    """Convert an ORM row to a dataclass instance, respecting default_factory."""
    cols = {c.key: getattr(obj, c.key) for c in obj.__table__.columns}
    # AuditEventORM stores metadata as event_metadata attribute
    if hasattr(obj, "event_metadata") and "event_metadata" in cols:
        cols["metadata"] = cols.pop("event_metadata")
    result = {}
    for f in dataclasses.fields(cls):
        val = cols.get(f.name)
        if val is None and f.default_factory is not dataclasses.MISSING:  # type: ignore[misc]
            val = f.default_factory()
        result[f.name] = val
    return cls(**result)


def _set(orm_obj, dc_obj) -> None:
    """Copy dataclass fields onto an ORM object in place."""
    d = dataclasses.asdict(dc_obj)
    for col in orm_obj.__table__.columns:
        attr = col.key  # respects rename (event_metadata → "metadata" column)
        # reverse the metadata rename
        dc_key = "metadata" if attr == "event_metadata" else attr
        if dc_key in d:
            setattr(orm_obj, attr, d[dc_key])


def _new_orm(orm_cls, dc_obj):
    """Create a new ORM instance from a dataclass."""
    orm = orm_cls.__new__(orm_cls)
    orm_cls.__init__(orm)
    _set(orm, dc_obj)
    return orm


# ── Store ─────────────────────────────────────────────────────────────────────

class Store:
    """SQLAlchemy-backed store. Same public API as the original flat-file store."""

    # ── Datasets ──────────────────────────────────────────────────────

    def add_dataset(self, ds: Dataset) -> Dataset:
        with db_session() as db:
            db.add(_new_orm(M.DatasetORM, ds))
        return ds

    def update_dataset(self, ds: Dataset) -> Dataset:
        ds.updated_at = _now()
        with db_session() as db:
            obj = db.query(M.DatasetORM).filter_by(id=ds.id).first()
            if obj:
                _set(obj, ds)
        return ds

    def get_dataset(self, id: str) -> Optional[Dataset]:
        with db_session() as db:
            obj = db.query(M.DatasetORM).filter_by(id=id).first()
            return _dc(Dataset, obj) if obj else None

    def list_datasets(self, user_id: Optional[str] = None) -> list[Dataset]:
        with db_session() as db:
            q = db.query(M.DatasetORM)
            if user_id:
                q = q.filter(M.DatasetORM.user_id == user_id)
            rows = q.order_by(M.DatasetORM.created_at.desc()).all()
            return [_dc(Dataset, r) for r in rows]

    def delete_dataset(self, id: str) -> None:
        with db_session() as db:
            db.query(M.DatasetORM).filter_by(id=id).delete()
            db.query(M.ColumnProfileSetORM).filter_by(dataset_id=id).delete()
            db.query(M.QualityScanORM).filter_by(dataset_id=id).delete()

    # ── Scans ─────────────────────────────────────────────────────────

    def add_scan(self, scan: QualityScan) -> QualityScan:
        with db_session() as db:
            db.add(_new_orm(M.QualityScanORM, scan))
        return scan

    def update_scan(self, scan: QualityScan) -> QualityScan:
        with db_session() as db:
            obj = db.query(M.QualityScanORM).filter_by(id=scan.id).first()
            if obj:
                _set(obj, scan)
        return scan

    def get_scan(self, id: str) -> Optional[QualityScan]:
        with db_session() as db:
            obj = db.query(M.QualityScanORM).filter_by(id=id).first()
            return _dc(QualityScan, obj) if obj else None

    def get_latest_scan(self, dataset_id: str) -> Optional[QualityScan]:
        with db_session() as db:
            obj = (db.query(M.QualityScanORM)
                   .filter_by(dataset_id=dataset_id)
                   .order_by(M.QualityScanORM.created_at.desc())
                   .first())
            return _dc(QualityScan, obj) if obj else None

    def list_scans(self, dataset_id: str) -> list[QualityScan]:
        with db_session() as db:
            rows = (db.query(M.QualityScanORM)
                    .filter_by(dataset_id=dataset_id)
                    .order_by(M.QualityScanORM.created_at)
                    .all())
            return [_dc(QualityScan, r) for r in rows]

    # ── Column profiles ───────────────────────────────────────────────

    def set_column_profiles(self, dataset_id: str, profiles: list[ColumnProfile]) -> None:
        data = [dataclasses.asdict(p) for p in profiles]
        with db_session() as db:
            obj = db.query(M.ColumnProfileSetORM).filter_by(dataset_id=dataset_id).first()
            if obj:
                obj.profiles = data
            else:
                db.add(M.ColumnProfileSetORM(dataset_id=dataset_id, profiles=data))

    def get_column_profiles(self, dataset_id: str) -> list[ColumnProfile]:
        with db_session() as db:
            obj = db.query(M.ColumnProfileSetORM).filter_by(dataset_id=dataset_id).first()
            if not obj:
                return []
            return [ColumnProfile(**p) for p in (obj.profiles or [])]

    # ── Cleaning records ──────────────────────────────────────────────

    def add_cleaning_record(self, rec: CleaningRecord) -> CleaningRecord:
        with db_session() as db:
            db.add(_new_orm(M.CleaningRecordORM, rec))
        return rec

    def get_cleaning_records(self, dataset_id: str) -> list[CleaningRecord]:
        with db_session() as db:
            rows = db.query(M.CleaningRecordORM).filter_by(dataset_id=dataset_id).all()
            return [_dc(CleaningRecord, r) for r in rows]

    # ── Pipelines ─────────────────────────────────────────────────────

    def add_pipeline(self, p: Pipeline) -> Pipeline:
        with db_session() as db:
            db.add(_new_orm(M.PipelineORM, p))
        return p

    def update_pipeline(self, p: Pipeline) -> Pipeline:
        p.updated_at = _now()
        with db_session() as db:
            obj = db.query(M.PipelineORM).filter_by(id=p.id).first()
            if obj:
                _set(obj, p)
        return p

    def get_pipeline(self, id: str) -> Optional[Pipeline]:
        with db_session() as db:
            obj = db.query(M.PipelineORM).filter_by(id=id).first()
            return _dc(Pipeline, obj) if obj else None

    def list_pipelines(self, user_id: Optional[str] = None) -> list[Pipeline]:
        with db_session() as db:
            q = db.query(M.PipelineORM)
            if user_id:
                q = q.filter(M.PipelineORM.user_id == user_id)
            rows = q.order_by(M.PipelineORM.created_at.desc()).all()
            return [_dc(Pipeline, r) for r in rows]

    def delete_pipeline(self, id: str) -> None:
        with db_session() as db:
            db.query(M.PipelineORM).filter_by(id=id).delete()
            db.query(M.PipelineRunORM).filter_by(pipeline_id=id).delete()

    # ── Pipeline runs ─────────────────────────────────────────────────

    def add_pipeline_run(self, r: PipelineRun) -> PipelineRun:
        with db_session() as db:
            db.add(_new_orm(M.PipelineRunORM, r))
        return r

    def update_pipeline_run(self, r: PipelineRun) -> PipelineRun:
        with db_session() as db:
            obj = db.query(M.PipelineRunORM).filter_by(id=r.id).first()
            if obj:
                _set(obj, r)
        return r

    def get_pipeline_run(self, id: str) -> Optional[PipelineRun]:
        with db_session() as db:
            obj = db.query(M.PipelineRunORM).filter_by(id=id).first()
            return _dc(PipelineRun, obj) if obj else None

    def list_pipeline_runs(self, pipeline_id: str) -> list[PipelineRun]:
        with db_session() as db:
            rows = (db.query(M.PipelineRunORM)
                    .filter_by(pipeline_id=pipeline_id)
                    .order_by(M.PipelineRunORM.created_at.desc())
                    .all())
            return [_dc(PipelineRun, r) for r in rows]

    def list_all_pipeline_runs(self) -> list[PipelineRun]:
        with db_session() as db:
            rows = db.query(M.PipelineRunORM).order_by(M.PipelineRunORM.created_at.desc()).all()
            return [_dc(PipelineRun, r) for r in rows]

    # ── Active learning sessions ──────────────────────────────────────

    def add_al_session(self, s: ALSession) -> ALSession:
        with db_session() as db:
            db.add(_new_orm(M.ALSessionORM, s))
        return s

    def update_al_session(self, s: ALSession) -> ALSession:
        s.updated_at = _now()
        with db_session() as db:
            obj = db.query(M.ALSessionORM).filter_by(id=s.id).first()
            if obj:
                _set(obj, s)
        return s

    def get_al_session(self, id: str) -> Optional[ALSession]:
        with db_session() as db:
            obj = db.query(M.ALSessionORM).filter_by(id=id).first()
            return _dc(ALSession, obj) if obj else None

    def list_al_sessions(self, user_id: Optional[str] = None) -> list[ALSession]:
        with db_session() as db:
            q = db.query(M.ALSessionORM)
            if user_id:
                q = q.filter(M.ALSessionORM.user_id == user_id)
            rows = q.order_by(M.ALSessionORM.created_at.desc()).all()
            return [_dc(ALSession, r) for r in rows]

    def delete_al_session(self, id: str) -> None:
        with db_session() as db:
            db.query(M.ALSessionORM).filter_by(id=id).delete()

    # ── Trained models ────────────────────────────────────────────────

    def add_trained_model(self, m: TrainedModel) -> TrainedModel:
        with db_session() as db:
            db.add(_new_orm(M.TrainedModelORM, m))
        return m

    def update_trained_model(self, m: TrainedModel) -> TrainedModel:
        with db_session() as db:
            obj = db.query(M.TrainedModelORM).filter_by(id=m.id).first()
            if obj:
                _set(obj, m)
        return m

    def get_trained_model(self, id: str) -> Optional[TrainedModel]:
        with db_session() as db:
            obj = db.query(M.TrainedModelORM).filter_by(id=id).first()
            return _dc(TrainedModel, obj) if obj else None

    def find_trained_model(self, dataset_id: str, method: str) -> Optional[TrainedModel]:
        with db_session() as db:
            obj = (db.query(M.TrainedModelORM)
                   .filter_by(dataset_id=dataset_id, method=method, status="ready")
                   .order_by(M.TrainedModelORM.created_at.desc())
                   .first())
            return _dc(TrainedModel, obj) if obj else None

    def list_trained_models(self) -> list[TrainedModel]:
        with db_session() as db:
            rows = db.query(M.TrainedModelORM).order_by(M.TrainedModelORM.created_at.desc()).all()
            return [_dc(TrainedModel, r) for r in rows]

    def delete_trained_model(self, id: str) -> None:
        with db_session() as db:
            db.query(M.TrainedModelORM).filter_by(id=id).delete()

    # ── Synthetic jobs ────────────────────────────────────────────────

    def add_synthetic_job(self, j: SyntheticJob) -> SyntheticJob:
        with db_session() as db:
            db.add(_new_orm(M.SyntheticJobORM, j))
        return j

    def update_synthetic_job(self, j: SyntheticJob) -> SyntheticJob:
        with db_session() as db:
            obj = db.query(M.SyntheticJobORM).filter_by(id=j.id).first()
            if obj:
                _set(obj, j)
        return j

    def get_synthetic_job(self, id: str) -> Optional[SyntheticJob]:
        with db_session() as db:
            obj = db.query(M.SyntheticJobORM).filter_by(id=id).first()
            return _dc(SyntheticJob, obj) if obj else None

    def list_synthetic_jobs(self, user_id: Optional[str] = None) -> list[SyntheticJob]:
        with db_session() as db:
            q = db.query(M.SyntheticJobORM)
            if user_id:
                q = q.filter(M.SyntheticJobORM.user_id == user_id)
            rows = q.order_by(M.SyntheticJobORM.created_at.desc()).all()
            return [_dc(SyntheticJob, r) for r in rows]

    # ── Marketplace ───────────────────────────────────────────────────

    def add_marketplace_asset(self, a: MarketplaceAsset) -> MarketplaceAsset:
        with db_session() as db:
            db.add(_new_orm(M.MarketplaceAssetORM, a))
        return a

    def update_marketplace_asset(self, a: MarketplaceAsset) -> MarketplaceAsset:
        a.updated_at = _now()
        with db_session() as db:
            obj = db.query(M.MarketplaceAssetORM).filter_by(id=a.id).first()
            if obj:
                _set(obj, a)
        return a

    def get_marketplace_asset(self, id: str) -> Optional[MarketplaceAsset]:
        with db_session() as db:
            obj = db.query(M.MarketplaceAssetORM).filter_by(id=id).first()
            return _dc(MarketplaceAsset, obj) if obj else None

    def list_marketplace_assets(self) -> list[MarketplaceAsset]:
        with db_session() as db:
            rows = db.query(M.MarketplaceAssetORM).order_by(M.MarketplaceAssetORM.created_at.desc()).all()
            return [_dc(MarketplaceAsset, r) for r in rows]

    def delete_marketplace_asset(self, id: str) -> None:
        with db_session() as db:
            db.query(M.MarketplaceAssetORM).filter_by(id=id).delete()

    def add_marketplace_review(self, r: MarketplaceReview) -> MarketplaceReview:
        with db_session() as db:
            db.add(_new_orm(M.MarketplaceReviewORM, r))
        return r

    def list_marketplace_reviews(self, asset_id: str) -> list[MarketplaceReview]:
        with db_session() as db:
            rows = (db.query(M.MarketplaceReviewORM)
                    .filter_by(asset_id=asset_id)
                    .order_by(M.MarketplaceReviewORM.created_at.desc())
                    .all())
            return [_dc(MarketplaceReview, r) for r in rows]

    def add_marketplace_install(self, i: MarketplaceInstall) -> MarketplaceInstall:
        with db_session() as db:
            db.add(_new_orm(M.MarketplaceInstallORM, i))
        return i

    def list_marketplace_installs(self) -> list[MarketplaceInstall]:
        with db_session() as db:
            rows = db.query(M.MarketplaceInstallORM).order_by(M.MarketplaceInstallORM.installed_at.desc()).all()
            return [_dc(MarketplaceInstall, r) for r in rows]

    # ── Benchmark jobs ────────────────────────────────────────────────

    def add_benchmark_job(self, j: BenchmarkJob) -> BenchmarkJob:
        with db_session() as db:
            db.add(_new_orm(M.BenchmarkJobORM, j))
        return j

    def update_benchmark_job(self, j: BenchmarkJob) -> BenchmarkJob:
        with db_session() as db:
            obj = db.query(M.BenchmarkJobORM).filter_by(id=j.id).first()
            if obj:
                _set(obj, j)
        return j

    def patch_benchmark_result(self, job_id: str, candidate_id: str, **kwargs) -> None:
        with db_session() as db:
            obj = db.query(M.BenchmarkJobORM).filter_by(id=job_id).first()
            if not obj:
                return
            results = list(obj.results or [])
            for i, r in enumerate(results):
                if r.get("candidate_id") == candidate_id:
                    results[i] = {**r, **kwargs}
                    break
            obj.results = results

    def get_benchmark_job(self, id: str) -> Optional[BenchmarkJob]:
        with db_session() as db:
            obj = db.query(M.BenchmarkJobORM).filter_by(id=id).first()
            return _dc(BenchmarkJob, obj) if obj else None

    def list_benchmark_jobs(self, user_id: Optional[str] = None) -> list[BenchmarkJob]:
        with db_session() as db:
            q = db.query(M.BenchmarkJobORM)
            if user_id:
                q = q.filter(M.BenchmarkJobORM.user_id == user_id)
            rows = q.order_by(M.BenchmarkJobORM.created_at.desc()).all()
            return [_dc(BenchmarkJob, r) for r in rows]

    def delete_benchmark_job(self, id: str) -> None:
        with db_session() as db:
            db.query(M.BenchmarkJobORM).filter_by(id=id).delete()

    # ── Compliance scans ──────────────────────────────────────────────

    def add_compliance_scan(self, s: ComplianceScan) -> ComplianceScan:
        with db_session() as db:
            db.add(_new_orm(M.ComplianceScanORM, s))
        return s

    def update_compliance_scan(self, s: ComplianceScan) -> ComplianceScan:
        with db_session() as db:
            obj = db.query(M.ComplianceScanORM).filter_by(id=s.id).first()
            if obj:
                _set(obj, s)
        return s

    def get_compliance_scan(self, id: str) -> Optional[ComplianceScan]:
        with db_session() as db:
            obj = db.query(M.ComplianceScanORM).filter_by(id=id).first()
            return _dc(ComplianceScan, obj) if obj else None

    def get_latest_compliance_scan(self, dataset_id: str) -> Optional[ComplianceScan]:
        with db_session() as db:
            obj = (db.query(M.ComplianceScanORM)
                   .filter(M.ComplianceScanORM.dataset_id == dataset_id,
                           M.ComplianceScanORM.status == "complete")
                   .order_by(M.ComplianceScanORM.scanned_at.desc())
                   .first())
            return _dc(ComplianceScan, obj) if obj else None

    def list_compliance_scans(self) -> list[ComplianceScan]:
        with db_session() as db:
            rows = db.query(M.ComplianceScanORM).order_by(M.ComplianceScanORM.created_at.desc()).all()
            return [_dc(ComplianceScan, r) for r in rows]

    # ── Compliance policies ───────────────────────────────────────────

    def add_compliance_policy(self, p: CompliancePolicy) -> CompliancePolicy:
        with db_session() as db:
            db.add(_new_orm(M.CompliancePolicyORM, p))
        return p

    def update_compliance_policy(self, p: CompliancePolicy) -> CompliancePolicy:
        p.updated_at = _now()
        with db_session() as db:
            obj = db.query(M.CompliancePolicyORM).filter_by(id=p.id).first()
            if obj:
                _set(obj, p)
        return p

    def get_compliance_policy(self, id: str) -> Optional[CompliancePolicy]:
        with db_session() as db:
            obj = db.query(M.CompliancePolicyORM).filter_by(id=id).first()
            return _dc(CompliancePolicy, obj) if obj else None

    def list_compliance_policies(self) -> list[CompliancePolicy]:
        with db_session() as db:
            rows = db.query(M.CompliancePolicyORM).order_by(M.CompliancePolicyORM.created_at).all()
            return [_dc(CompliancePolicy, r) for r in rows]

    def delete_compliance_policy(self, id: str) -> None:
        with db_session() as db:
            db.query(M.CompliancePolicyORM).filter_by(id=id).delete()
            db.query(M.PolicyViolationORM).filter_by(policy_id=id).delete()

    # ── Policy violations ─────────────────────────────────────────────

    def upsert_violations(self, violations: list[PolicyViolation]) -> None:
        with db_session() as db:
            for v in violations:
                obj = db.query(M.PolicyViolationORM).filter_by(id=v.id).first()
                if obj:
                    _set(obj, v)
                else:
                    db.add(_new_orm(M.PolicyViolationORM, v))

    def clear_violations_for_policy(self, policy_id: str) -> None:
        with db_session() as db:
            db.query(M.PolicyViolationORM).filter_by(policy_id=policy_id).delete()

    def resolve_violation(self, id: str) -> Optional[PolicyViolation]:
        with db_session() as db:
            obj = db.query(M.PolicyViolationORM).filter_by(id=id).first()
            if not obj:
                return None
            obj.resolved = True
            obj.resolved_at = _now()
            return _dc(PolicyViolation, obj)

    def list_violations(self, resolved: bool = False) -> list[PolicyViolation]:
        with db_session() as db:
            rows = (db.query(M.PolicyViolationORM)
                    .filter_by(resolved=resolved)
                    .order_by(M.PolicyViolationORM.detected_at.desc())
                    .all())
            return [_dc(PolicyViolation, r) for r in rows]

    # ── Audit events ──────────────────────────────────────────────────

    def add_audit_event(self, e: AuditEvent) -> AuditEvent:
        with db_session() as db:
            db.add(_new_orm(M.AuditEventORM, e))
        return e

    def list_audit_events(self, category: Optional[str] = None, event_type: Optional[str] = None,
                          entity_name: Optional[str] = None, limit: int = 100, offset: int = 0) -> list[AuditEvent]:
        with db_session() as db:
            q = db.query(M.AuditEventORM).order_by(M.AuditEventORM.created_at.desc())
            if category:
                q = q.filter(M.AuditEventORM.category == category)
            if event_type:
                q = q.filter(M.AuditEventORM.event_type == event_type)
            if entity_name:
                q = q.filter(M.AuditEventORM.entity_name.ilike(f"%{entity_name}%"))
            rows = q.offset(offset).limit(limit).all()
            return [_dc(AuditEvent, r) for r in rows]

    def count_audit_events(self, since_iso: Optional[str] = None) -> int:
        with db_session() as db:
            q = db.query(M.AuditEventORM)
            if since_iso:
                q = q.filter(M.AuditEventORM.created_at >= since_iso)
            return q.count()

    # ── Anonymization jobs ────────────────────────────────────────────

    def add_anonymization_job(self, j: AnonymizationJob) -> AnonymizationJob:
        with db_session() as db:
            db.add(_new_orm(M.AnonymizationJobORM, j))
        return j

    def update_anonymization_job(self, j: AnonymizationJob) -> AnonymizationJob:
        with db_session() as db:
            obj = db.query(M.AnonymizationJobORM).filter_by(id=j.id).first()
            if obj:
                _set(obj, j)
        return j

    def get_anonymization_job(self, id: str) -> Optional[AnonymizationJob]:
        with db_session() as db:
            obj = db.query(M.AnonymizationJobORM).filter_by(id=id).first()
            return _dc(AnonymizationJob, obj) if obj else None

    def list_anonymization_jobs(self) -> list[AnonymizationJob]:
        with db_session() as db:
            rows = db.query(M.AnonymizationJobORM).order_by(M.AnonymizationJobORM.created_at.desc()).all()
            return [_dc(AnonymizationJob, r) for r in rows]

    # ── Compliance reports ────────────────────────────────────────────

    def add_compliance_report(self, r: ComplianceReport) -> ComplianceReport:
        with db_session() as db:
            db.add(_new_orm(M.ComplianceReportORM, r))
        return r

    def update_compliance_report(self, r: ComplianceReport) -> ComplianceReport:
        with db_session() as db:
            obj = db.query(M.ComplianceReportORM).filter_by(id=r.id).first()
            if obj:
                _set(obj, r)
        return r

    def get_compliance_report(self, id: str) -> Optional[ComplianceReport]:
        with db_session() as db:
            obj = db.query(M.ComplianceReportORM).filter_by(id=id).first()
            return _dc(ComplianceReport, obj) if obj else None

    def list_compliance_reports(self) -> list[ComplianceReport]:
        with db_session() as db:
            rows = db.query(M.ComplianceReportORM).order_by(M.ComplianceReportORM.created_at.desc()).all()
            return [_dc(ComplianceReport, r) for r in rows]

    def delete_compliance_report(self, id: str) -> None:
        with db_session() as db:
            obj = db.query(M.ComplianceReportORM).filter_by(id=id).first()
            if obj:
                file_path = obj.file_path
                db.delete(obj)
        if file_path:
            from pathlib import Path
            Path(file_path).unlink(missing_ok=True)

    # ── Settings ──────────────────────────────────────────────────────

    def get_settings(self) -> dict:
        with db_session() as db:
            obj = db.query(M.AppSettingsORM).filter_by(id=1).first()
            saved = obj.data if obj else {}
        return {**DEFAULT_SETTINGS, **(saved or {})}

    def update_settings(self, patch: dict) -> dict:
        with db_session() as db:
            obj = db.query(M.AppSettingsORM).filter_by(id=1).first()
            current = dict(obj.data) if obj and obj.data else {}
            for k, v in patch.items():
                if k in DEFAULT_SETTINGS:
                    current[k] = v
            if obj:
                obj.data = current
            else:
                db.add(M.AppSettingsORM(id=1, data=current))
        return self.get_settings()

    def reset_settings(self) -> dict:
        with db_session() as db:
            obj = db.query(M.AppSettingsORM).filter_by(id=1).first()
            if obj:
                obj.data = {}
            else:
                db.add(M.AppSettingsORM(id=1, data={}))
        return self.get_settings()


store = Store()
