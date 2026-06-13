"""
Settings API.
GET    /settings           — get current settings + live storage stats
PATCH  /settings           — update one or more settings fields
POST   /settings/reset     — reset all settings to defaults
DELETE /settings/uploads   — delete all files in uploads dir, mark datasets error
DELETE /settings/database  — nuke entire db.json (full reset)
"""
from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.models.store import store, DEFAULT_SETTINGS
from app.core.config import DATA_DIR, UPLOADS_DIR

router = APIRouter(prefix="/settings", tags=["settings"])

# ── Helpers ───────────────────────────────────────────────────────────

def _dir_size(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(f.stat().st_size for f in path.rglob('*') if f.is_file())


def _live_stats() -> dict:
    uploads_bytes  = _dir_size(UPLOADS_DIR)
    models_dir     = DATA_DIR / "al_models"
    models_bytes   = _dir_size(models_dir)
    db_bytes       = (DATA_DIR / "db.json").stat().st_size if (DATA_DIR / "db.json").exists() else 0
    try:
        du = shutil.disk_usage(DATA_DIR)
        disk_total = du.total
        disk_free  = du.free
        disk_used  = du.used
    except Exception:
        disk_total = disk_free = disk_used = 0

    datasets     = store.list_datasets()
    pipelines    = store.list_pipelines()
    al_sessions  = store.list_al_sessions()
    bench_jobs   = store.list_benchmark_jobs()
    synth_jobs   = store.list_synthetic_jobs()
    mp_assets    = store.list_marketplace_assets()
    installs     = store.list_marketplace_installs()

    return {
        # Storage
        "uploads_bytes":    uploads_bytes,
        "models_bytes":     models_bytes,
        "db_bytes":         db_bytes,
        "total_data_bytes": uploads_bytes + models_bytes + db_bytes,
        "disk_total_bytes": disk_total,
        "disk_free_bytes":  disk_free,
        "disk_used_bytes":  disk_used,
        # Counts
        "dataset_count":         len(datasets),
        "pipeline_count":        len(pipelines),
        "al_session_count":      len(al_sessions),
        "benchmark_job_count":   len(bench_jobs),
        "synthetic_job_count":   len(synth_jobs),
        "marketplace_asset_count": len(mp_assets),
        "marketplace_install_count": len(installs),
        "upload_file_count":     sum(1 for f in UPLOADS_DIR.iterdir() if f.is_file()) if UPLOADS_DIR.exists() else 0,
    }


# ── Schemas ───────────────────────────────────────────────────────────

class SettingsPatch(BaseModel):
    # General
    app_name: Optional[str] = Field(None, min_length=1, max_length=100)
    date_format: Optional[str] = Field(None, max_length=50)
    table_page_size: Optional[int] = None
    # Storage
    max_upload_mb: Optional[int] = None
    allowed_extensions: Optional[list[str]] = None
    # AL defaults
    al_default_batch_size: Optional[int] = None
    al_default_model_type: Optional[str] = None
    al_default_sampling_strategy: Optional[str] = None
    al_default_max_rounds: Optional[int] = None
    al_default_target_accuracy: Optional[float] = None
    # Benchmark defaults
    benchmark_default_eval_protocol: Optional[str] = None
    benchmark_default_preset: Optional[str] = None
    benchmark_default_task_type: Optional[str] = None
    # Synthetic defaults
    synthetic_default_method: Optional[str] = None
    synthetic_default_row_count: Optional[int] = None
    # Pipeline defaults
    pipeline_default_output_format: Optional[str] = None
    # Export defaults
    export_default_format: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────

@router.get("")
def get_settings():
    return {"settings": store.get_settings(), "stats": _live_stats()}


@router.patch("")
def patch_settings(body: SettingsPatch):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}

    # Validations
    if "app_name" in patch and not patch["app_name"].strip():
        raise HTTPException(400, "app_name cannot be empty")
    if "table_page_size" in patch and not (10 <= patch["table_page_size"] <= 500):
        raise HTTPException(400, "table_page_size must be between 10 and 500")
    if "max_upload_mb" in patch and not (1 <= patch["max_upload_mb"] <= 102400):
        raise HTTPException(400, "max_upload_mb must be between 1 MB and 100 GB")
    if "al_default_batch_size" in patch and not (1 <= patch["al_default_batch_size"] <= 500):
        raise HTTPException(400, "al_default_batch_size must be 1–500")
    if "al_default_max_rounds" in patch and not (1 <= patch["al_default_max_rounds"] <= 100):
        raise HTTPException(400, "al_default_max_rounds must be 1–100")
    if "al_default_target_accuracy" in patch and patch["al_default_target_accuracy"] is not None:
        if not (0.0 < patch["al_default_target_accuracy"] <= 1.0):
            raise HTTPException(400, "al_default_target_accuracy must be in (0, 1]")
    if "synthetic_default_row_count" in patch and not (10 <= patch["synthetic_default_row_count"] <= 1_000_000):
        raise HTTPException(400, "synthetic_default_row_count must be 10–1,000,000")
    if "al_default_model_type" in patch:
        valid = {"logistic_regression","random_forest","xgboost","svm","mlp"}
        if patch["al_default_model_type"] not in valid:
            raise HTTPException(400, f"al_default_model_type must be one of {valid}")
    if "al_default_sampling_strategy" in patch:
        valid = {"least_confidence","margin","entropy","coreset","committee"}
        if patch["al_default_sampling_strategy"] not in valid:
            raise HTTPException(400, f"al_default_sampling_strategy must be one of {valid}")
    if "benchmark_default_eval_protocol" in patch:
        valid = {"kfold_5","kfold_10","holdout_80","holdout_90"}
        if patch["benchmark_default_eval_protocol"] not in valid:
            raise HTTPException(400, f"benchmark_default_eval_protocol must be one of {valid}")
    if "benchmark_default_preset" in patch:
        valid = {"default","tuned","grid_search"}
        if patch["benchmark_default_preset"] not in valid:
            raise HTTPException(400, f"benchmark_default_preset must be one of {valid}")
    if "benchmark_default_task_type" in patch:
        valid = {"classification","regression"}
        if patch["benchmark_default_task_type"] not in valid:
            raise HTTPException(400, f"benchmark_default_task_type must be one of {valid}")
    if "synthetic_default_method" in patch:
        valid = {"statistical","ctgan","tvae"}
        if patch["synthetic_default_method"] not in valid:
            raise HTTPException(400, f"synthetic_default_method must be one of {valid}")
    if "pipeline_default_output_format" in patch:
        valid = {"csv","parquet","json"}
        if patch["pipeline_default_output_format"] not in valid:
            raise HTTPException(400, f"pipeline_default_output_format must be one of {valid}")
    if "export_default_format" in patch:
        valid = {"csv","parquet","json"}
        if patch["export_default_format"] not in valid:
            raise HTTPException(400, f"export_default_format must be one of {valid}")

    updated = store.update_settings(patch)
    return {"settings": updated, "stats": _live_stats()}


@router.post("/reset")
def reset_settings():
    return {"settings": store.reset_settings(), "stats": _live_stats()}


@router.delete("/uploads", status_code=200)
def clear_uploads():
    """Delete all files in the uploads directory; mark datasets with missing files as error."""
    deleted_files = 0
    freed_bytes   = 0

    if UPLOADS_DIR.exists():
        for f in list(UPLOADS_DIR.iterdir()):
            if f.is_file():
                freed_bytes += f.stat().st_size
                f.unlink()
                deleted_files += 1

    # Mark affected datasets
    affected = 0
    for ds in store.list_datasets():
        if ds.file_path and not Path(ds.file_path).exists():
            ds.status = "error"
            ds.error_message = "File deleted during storage clear"
            store.update_dataset(ds)
            affected += 1

    return {
        "deleted_files": deleted_files,
        "freed_bytes": freed_bytes,
        "datasets_affected": affected,
    }


@router.delete("/database", status_code=200)
def clear_database():
    """Hard reset: delete db.json. Server must be restarted to re-seed."""
    db_path = DATA_DIR / "db.json"
    existed = db_path.exists()
    if existed:
        db_path.unlink()
    return {"cleared": existed, "message": "Database cleared. Restart the server to reinitialize."}
