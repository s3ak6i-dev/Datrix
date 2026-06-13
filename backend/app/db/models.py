"""SQLAlchemy ORM models — fields mirror the dataclasses in store.py exactly."""
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, Float, Integer, String, Text, JSON
from sqlalchemy import types as sa_types
from sqlalchemy.dialects.postgresql import JSONB

from app.db.base import Base


class _JSON(sa_types.TypeDecorator):
    """Uses JSONB on PostgreSQL, JSON on everything else (SQLite for tests)."""
    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(JSON())


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Datasets ──────────────────────────────────────────────────────────────────

class DatasetORM(Base):
    __tablename__ = "datasets"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=True, index=True)
    name = Column(String, default="")
    row_count = Column(Integer, nullable=True)
    column_count = Column(Integer, nullable=True)
    size_bytes = Column(Integer, nullable=True)
    status = Column(String, default="pending")
    schema = Column(_JSON, nullable=True)          # Optional[list]
    file_path = Column(String, default="")
    created_at = Column(String, default=_now)
    updated_at = Column(String, default=_now)
    latest_scan_id = Column(String, nullable=True)
    latest_score = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)


class QualityScanORM(Base):
    __tablename__ = "quality_scans"
    id = Column(String, primary_key=True)
    dataset_id = Column(String, nullable=False, index=True)
    status = Column(String, default="queued")
    score = Column(_JSON, nullable=True)           # Optional[dict]
    issues = Column(_JSON, default=list)
    scan_duration_ms = Column(Integer, nullable=True)
    started_at = Column(String, nullable=True)
    completed_at = Column(String, nullable=True)
    created_at = Column(String, default=_now)


class ColumnProfileSetORM(Base):
    """One row per dataset — stores all column profiles as a JSONB array."""
    __tablename__ = "column_profiles"
    dataset_id = Column(String, primary_key=True)
    profiles = Column(_JSON, default=list)


class CleaningRecordORM(Base):
    __tablename__ = "cleaning_records"
    id = Column(String, primary_key=True)
    dataset_id = Column(String, nullable=False, index=True)
    issue_id = Column(String, default="")
    method = Column(String, default="")
    rows_affected = Column(Integer, default=0)
    applied_at = Column(String, default=_now)
    rolled_back = Column(Boolean, default=False)


# ── Pipelines ─────────────────────────────────────────────────────────────────

class PipelineORM(Base):
    __tablename__ = "pipelines"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=True, index=True)
    name = Column(String, default="")
    description = Column(String, default="")
    dataset_id = Column(String, nullable=True)
    steps = Column(_JSON, default=list)
    status = Column(String, default="draft")
    node_positions = Column(_JSON, nullable=True)  # Optional[dict]
    created_at = Column(String, default=_now)
    updated_at = Column(String, default=_now)


class PipelineRunORM(Base):
    __tablename__ = "pipeline_runs"
    id = Column(String, primary_key=True)
    pipeline_id = Column(String, nullable=False, index=True)
    dataset_id = Column(String, nullable=False)
    status = Column(String, default="pending")
    is_dry_run = Column(Boolean, default=True)
    step_results = Column(_JSON, default=list)
    output_path = Column(String, nullable=True)
    output_format = Column(String, default="csv")
    rows_in = Column(Integer, nullable=True)
    rows_out = Column(Integer, nullable=True)
    cols_in = Column(Integer, nullable=True)
    cols_out = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    output_preview = Column(_JSON, nullable=True)
    created_at = Column(String, default=_now)
    completed_at = Column(String, nullable=True)


# ── Synthetic ─────────────────────────────────────────────────────────────────

class SyntheticJobORM(Base):
    __tablename__ = "synthetic_jobs"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=True, index=True)
    source_dataset_id = Column(String, nullable=False, index=True)
    output_dataset_id = Column(String, nullable=True)
    output_name = Column(String, default="")
    method = Column(String, default="statistical")
    row_count = Column(Integer, default=1000)
    column_overrides = Column(_JSON, nullable=True)
    status = Column(String, default="pending")
    error_message = Column(Text, nullable=True)
    created_at = Column(String, default=_now)
    completed_at = Column(String, nullable=True)


class TrainedModelORM(Base):
    __tablename__ = "trained_models"
    id = Column(String, primary_key=True)
    dataset_id = Column(String, nullable=False, index=True)
    method = Column(String, default="")
    model_path = Column(Text, default="")
    status = Column(String, default="training")
    error_message = Column(Text, nullable=True)
    created_at = Column(String, default=_now)


# ── Active Learning ───────────────────────────────────────────────────────────

class ALSessionORM(Base):
    __tablename__ = "al_sessions"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=True, index=True)
    name = Column(String, default="")
    dataset_id = Column(String, nullable=False, index=True)
    target_column = Column(String, default="")
    task_type = Column(String, default="classification")
    model_type = Column(String, default="random_forest")
    sampling_strategy = Column(String, default="entropy")
    batch_size = Column(Integer, default=20)
    label_classes = Column(_JSON, default=list)
    exclude_columns = Column(_JSON, default=list)
    target_accuracy = Column(Float, nullable=True)
    max_rounds = Column(Integer, default=10)
    model_name = Column(String, default="")
    status = Column(String, default="annotating")
    current_round = Column(Integer, default=1)
    labels = Column(_JSON, default=dict)
    next_batch = Column(_JSON, default=list)
    model_path = Column(Text, nullable=True)
    rounds = Column(_JSON, default=list)
    created_at = Column(String, default=_now)
    updated_at = Column(String, default=_now)


# ── Benchmark ─────────────────────────────────────────────────────────────────

class BenchmarkJobORM(Base):
    __tablename__ = "benchmark_jobs"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=True, index=True)
    name = Column(String, default="")
    dataset_id = Column(String, nullable=False, index=True)
    target_column = Column(String, default="")
    task_type = Column(String, default="classification")
    eval_protocol = Column(String, default="kfold_5")
    candidates = Column(_JSON, default=list)
    status = Column(String, default="pending")
    results = Column(_JSON, default=list)
    winner_candidate_id = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(String, default=_now)
    completed_at = Column(String, nullable=True)


# ── Marketplace ───────────────────────────────────────────────────────────────

class MarketplaceAssetORM(Base):
    __tablename__ = "marketplace_assets"
    id = Column(String, primary_key=True)
    title = Column(String, default="")
    description = Column(Text, default="")
    long_description = Column(Text, default="")
    asset_type = Column(String, default="dataset")
    category = Column(String, default="general")
    tags = Column(_JSON, default=list)
    author_name = Column(String, default="Community")
    license = Column(String, default="mit")
    version = Column(String, default="1.0.0")
    status = Column(String, default="published")
    is_seeded = Column(Boolean, default=False)
    seed_key = Column(String, default="")
    download_count = Column(Integer, default=0)
    view_count = Column(Integer, default=0)
    rating_avg = Column(Float, default=0.0)
    rating_count = Column(Integer, default=0)
    source_id = Column(String, default="")
    preview = Column(_JSON, default=dict)
    file_size = Column(Integer, default=0)
    created_at = Column(String, default=_now)
    updated_at = Column(String, default=_now)
    published_at = Column(String, default=_now)


class MarketplaceReviewORM(Base):
    __tablename__ = "marketplace_reviews"
    id = Column(String, primary_key=True)
    asset_id = Column(String, nullable=False, index=True)
    author_name = Column(String, default="")
    rating = Column(Integer, default=5)
    comment = Column(Text, default="")
    created_at = Column(String, default=_now)


class MarketplaceInstallORM(Base):
    __tablename__ = "marketplace_installs"
    id = Column(String, primary_key=True)
    asset_id = Column(String, nullable=False, index=True)
    asset_title = Column(String, default="")
    asset_type = Column(String, default="")
    resulting_id = Column(String, default="")
    installed_at = Column(String, default=_now)


# ── Compliance ────────────────────────────────────────────────────────────────

class ComplianceScanORM(Base):
    __tablename__ = "compliance_scans"
    id = Column(String, primary_key=True)
    dataset_id = Column(String, nullable=False, index=True)
    status = Column(String, default="pending")
    scanned_at = Column(String, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    findings = Column(_JSON, default=list)
    overall_risk = Column(String, default="unscanned")
    pii_column_count = Column(Integer, default=0)
    critical_count = Column(Integer, default=0)
    high_count = Column(Integer, default=0)
    medium_count = Column(Integer, default=0)
    low_count = Column(Integer, default=0)
    rows_sampled = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(String, default=_now)


class CompliancePolicyORM(Base):
    __tablename__ = "compliance_policies"
    id = Column(String, primary_key=True)
    name = Column(String, default="")
    policy_type = Column(String, default="")
    parameters = Column(_JSON, default=dict)
    severity = Column(String, default="warning")
    enabled = Column(Boolean, default=True)
    created_at = Column(String, default=_now)
    updated_at = Column(String, default=_now)


class PolicyViolationORM(Base):
    __tablename__ = "policy_violations"
    id = Column(String, primary_key=True)
    policy_id = Column(String, nullable=False, index=True)
    policy_name = Column(String, default="")
    policy_type = Column(String, default="")
    entity_type = Column(String, default="")
    entity_id = Column(String, default="")
    entity_name = Column(String, default="")
    message = Column(Text, default="")
    severity = Column(String, default="warning")
    resolved = Column(Boolean, default=False)
    detected_at = Column(String, default=_now)
    resolved_at = Column(String, nullable=True)


class AuditEventORM(Base):
    __tablename__ = "audit_events"
    id = Column(String, primary_key=True)
    event_type = Column(String, default="")
    category = Column(String, default="")
    entity_type = Column(String, default="")
    entity_id = Column(String, default="")
    entity_name = Column(String, default="")
    # "metadata" conflicts with SQLAlchemy internals; stored as "event_metadata" column
    event_metadata = Column("metadata", _JSON, default=dict)
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(String, default=_now, index=True)


class AnonymizationJobORM(Base):
    __tablename__ = "anonymization_jobs"
    id = Column(String, primary_key=True)
    source_dataset_id = Column(String, nullable=False, index=True)
    output_dataset_id = Column(String, nullable=True)
    output_name = Column(String, default="")
    column_configs = Column(_JSON, default=list)
    status = Column(String, default="pending")
    rows_processed = Column(Integer, default=0)
    row_count = Column(Integer, default=0)
    columns_transformed = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(String, default=_now)
    completed_at = Column(String, nullable=True)


class ComplianceReportORM(Base):
    __tablename__ = "compliance_reports"
    id = Column(String, primary_key=True)
    framework = Column(String, default="")
    sections = Column(_JSON, default=list)
    status = Column(String, default="pending")
    entity_count = Column(Integer, default=0)
    findings_count = Column(Integer, default=0)
    violation_count = Column(Integer, default=0)
    risk_score = Column(Integer, default=0)
    file_path = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(String, default=_now)


# ── App Settings ──────────────────────────────────────────────────────────────

class AppSettingsORM(Base):
    __tablename__ = "app_settings"
    id = Column(Integer, primary_key=True, default=1)
    data = Column(_JSON, default=dict)


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserORM(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    email = Column(String, nullable=False, unique=True, index=True)
    hashed_password = Column(String, nullable=True)   # nullable: OAuth users have no password
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    email_verified = Column(Boolean, default=False)
    created_at = Column(String, default=_now)


class RefreshTokenORM(Base):
    __tablename__ = "refresh_tokens"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    token_hash = Column(String, nullable=False, unique=True)
    expires_at = Column(String, nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(String, default=_now)


class UserProfileORM(Base):
    __tablename__ = "user_profiles"
    user_id = Column(String, primary_key=True)
    full_name = Column(String, nullable=True)
    role = Column(String, nullable=True)
    company = Column(String, nullable=True)
    use_cases = Column(_JSON, default=list)
    avatar_url = Column(String, nullable=True)
    onboarding_completed = Column(Boolean, default=False)
    created_at = Column(String, default=_now)
    updated_at = Column(String, default=_now)


class PasswordResetTokenORM(Base):
    __tablename__ = "password_reset_tokens"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    token_hash = Column(String, nullable=False, unique=True)
    expires_at = Column(String, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(String, default=_now)


class EmailVerificationTokenORM(Base):
    __tablename__ = "email_verification_tokens"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    token_hash = Column(String, nullable=False, unique=True)
    expires_at = Column(String, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(String, default=_now)


class OAuthAccountORM(Base):
    """Links a user account to a third-party OAuth provider identity."""
    __tablename__ = "oauth_accounts"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    provider = Column(String, nullable=False)           # "google" | "github"
    provider_user_id = Column(String, nullable=False)   # stable UID from provider
    email = Column(String, nullable=True)
    created_at = Column(String, default=_now)


# ── Organizations ─────────────────────────────────────────────────────────────

class OrganizationORM(Base):
    __tablename__ = "organizations"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False, unique=True, index=True)
    owner_id = Column(String, nullable=False, index=True)
    # SSO configuration (populated when org enables enterprise SSO)
    sso_domain = Column(String, nullable=True)    # e.g. "company.com"
    sso_provider = Column(String, nullable=True)  # "google_workspace" | "okta" | "azure_ad" | "saml"
    sso_config = Column(_JSON, nullable=True)     # provider-specific metadata
    created_at = Column(String, default=_now)


class OrgMemberORM(Base):
    __tablename__ = "org_members"
    id = Column(String, primary_key=True)
    org_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    role = Column(String, nullable=False, default="member")  # "owner" | "admin" | "member"
    created_at = Column(String, default=_now)
