"""
Marketplace API.
GET  /marketplace/assets              — list/search/filter
GET  /marketplace/assets/featured     — featured picks
GET  /marketplace/assets/{id}         — detail (increments view_count)
POST /marketplace/assets              — publish from workspace
PATCH /marketplace/assets/{id}        — update metadata
DELETE /marketplace/assets/{id}       — unpublish
POST /marketplace/assets/{id}/install — install into workspace
POST /marketplace/assets/{id}/reviews — submit review
GET  /marketplace/assets/{id}/reviews — list reviews
GET  /marketplace/installs            — install history
GET  /marketplace/my-listings         — user-published assets
GET  /marketplace/stats               — counts
"""
from __future__ import annotations

import shutil
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.models.store import (
    store, MarketplaceAsset, MarketplaceReview, MarketplaceInstall,
    Dataset, Pipeline,
)
from app.core.config import DATA_DIR
from app.services.storage import get_storage
from app.services.marketplace_seeder import (
    generate_seeded_dataset, get_seeded_pipeline_steps,
)

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

VALID_TYPES      = {"dataset", "pipeline", "model", "benchmark_config"}
VALID_CATEGORIES = {"ecommerce","finance","healthcare","marketing","logistics","hr","nlp","timeseries","general"}
VALID_LICENSES   = {"mit","cc_by","cc_by_nc","apache2","proprietary"}
VALID_SORTS      = {"newest","popular","rating","trending"}


# ── Pydantic schemas ──────────────────────────────────────────────────

class PublishRequest(BaseModel):
    source_id: str = Field(..., max_length=100)
    asset_type: str
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., max_length=2000)
    long_description: str = Field("", max_length=10000)
    category: str = "general"
    tags: list[str] = Field([], max_length=20)
    author_name: str = Field("You", max_length=200)
    license: str = "mit"
    version: str = Field("1.0.0", max_length=50)


class UpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    long_description: Optional[str] = Field(None, max_length=10000)
    category: Optional[str] = None
    tags: Optional[list[str]] = Field(None, max_length=20)
    license: Optional[str] = None
    version: Optional[str] = Field(None, max_length=50)


class ReviewRequest(BaseModel):
    author_name: str = Field(..., min_length=1, max_length=200)
    rating: int = Field(..., ge=1, le=5)
    comment: str = Field("", max_length=2000)


class AssetOut(BaseModel):
    id: str
    title: str
    description: str
    long_description: str
    asset_type: str
    category: str
    tags: list
    author_name: str
    license: str
    version: str
    status: str
    is_seeded: bool
    download_count: int
    view_count: int
    rating_avg: float
    rating_count: int
    source_id: str
    preview: dict
    file_size: int
    created_at: str
    updated_at: str
    published_at: str

    @classmethod
    def from_asset(cls, a: MarketplaceAsset) -> "AssetOut":
        return cls(**{f: getattr(a, f) for f in cls.model_fields})


class ReviewOut(BaseModel):
    id: str
    asset_id: str
    author_name: str
    rating: int
    comment: str
    created_at: str


class InstallOut(BaseModel):
    resulting_id: str
    asset_type: str
    message: str


class InstallHistoryOut(BaseModel):
    id: str
    asset_id: str
    asset_title: str
    asset_type: str
    resulting_id: str
    installed_at: str


class StatsOut(BaseModel):
    total_assets: int
    total_datasets: int
    total_pipelines: int
    total_models: int
    total_downloads: int
    total_installs: int


# ── Helpers ───────────────────────────────────────────────────────────

def _recalc_rating(asset_id: str) -> None:
    reviews = store.list_marketplace_reviews(asset_id)
    a = store.get_marketplace_asset(asset_id)
    if not a:
        return
    if reviews:
        a.rating_avg = round(sum(r.rating for r in reviews) / len(reviews), 2)
        a.rating_count = len(reviews)
    else:
        a.rating_avg = 0.0
        a.rating_count = 0
    store.update_marketplace_asset(a)


def _gen_dataset_preview(dataset_id: str) -> dict:
    import polars as pl
    ds = store.get_dataset(dataset_id)
    storage = get_storage()
    if not ds or not storage.exists(ds.file_path):
        return {}
    _local = storage.local_path(ds.file_path)
    df = pl.read_csv(_local, n_rows=3)
    full = pl.read_csv(_local, n_rows=1)
    schema = [{'name': c, 'dtype': str(full[c].dtype), 'nullable': True} for c in full.columns]
    sample = [df.row(i, named=True) for i in range(min(3, len(df)))]
    clean = [{k: (None if str(v) == 'None' else v) for k, v in row.items()} for row in sample]
    return {'schema': schema, 'sample_rows': clean,
            'row_count': ds.row_count or 0, 'column_count': ds.column_count or 0}


def _gen_pipeline_preview(pipeline_id: str) -> dict:
    p = store.get_pipeline(pipeline_id)
    if not p:
        return {}
    return {'steps': p.steps, 'step_count': len(p.steps), 'pipeline_name': p.name}


def _gen_model_preview(session_id: str) -> dict:
    s = store.get_al_session(session_id)
    if not s:
        return {}
    last_round = s.rounds[-1] if s.rounds else {}
    return {
        'model_type': s.model_type,
        'task_type': s.task_type,
        'label_classes': s.label_classes,
        'metrics': last_round.get('metrics', {}),
        'rounds_completed': len(s.rounds),
        'labeled_count': s.labeled_count,
    }


def _gen_benchmark_preview(job_id: str) -> dict:
    j = store.get_benchmark_job(job_id)
    if not j:
        return {}
    return {
        'candidate_count': len(j.candidates),
        'eval_protocol': j.eval_protocol,
        'task_type': j.task_type,
        'candidates': [{'label': c.get('label',''), 'model_type': c.get('model_type',''),
                        'preset': c.get('preset','')} for c in j.candidates],
    }


# ── Routes ────────────────────────────────────────────────────────────

@router.get("/assets/featured", response_model=list[AssetOut])
def get_featured():
    all_assets = [a for a in store.list_marketplace_assets() if a.status == 'published']
    # Pick top by downloads across different types
    by_type: dict[str, list] = {}
    for a in all_assets:
        by_type.setdefault(a.asset_type, []).append(a)
    featured = []
    for assets in by_type.values():
        top = sorted(assets, key=lambda x: x.download_count, reverse=True)[:3]
        featured.extend(top)
    return [AssetOut.from_asset(a) for a in sorted(featured, key=lambda x: x.download_count, reverse=True)[:8]]


@router.get("/assets", response_model=list[AssetOut])
def list_assets(
    q: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    sort: str = Query("popular"),
    page: int = Query(1, ge=1),
    limit: int = Query(24, ge=1, le=100),
):
    assets = [a for a in store.list_marketplace_assets() if a.status == 'published']

    if type and type in VALID_TYPES:
        assets = [a for a in assets if a.asset_type == type]
    if category and category in VALID_CATEGORIES:
        assets = [a for a in assets if a.category == category]
    if q:
        ql = q.lower()
        assets = [a for a in assets
                  if ql in a.title.lower() or ql in a.description.lower()
                  or any(ql in t.lower() for t in a.tags)]

    if sort == 'newest':
        assets.sort(key=lambda a: a.published_at, reverse=True)
    elif sort == 'rating':
        assets.sort(key=lambda a: (a.rating_avg, a.rating_count), reverse=True)
    elif sort == 'trending':
        assets.sort(key=lambda a: a.view_count, reverse=True)
    else:  # popular
        assets.sort(key=lambda a: a.download_count, reverse=True)

    start = (page - 1) * limit
    return [AssetOut.from_asset(a) for a in assets[start:start + limit]]


@router.get("/my-listings", response_model=list[AssetOut])
def my_listings():
    assets = [a for a in store.list_marketplace_assets() if not a.is_seeded]
    return [AssetOut.from_asset(a) for a in assets]


@router.get("/installs", response_model=list[InstallHistoryOut])
def list_installs():
    return [
        InstallHistoryOut(
            id=i.id, asset_id=i.asset_id, asset_title=i.asset_title,
            asset_type=i.asset_type, resulting_id=i.resulting_id,
            installed_at=i.installed_at,
        )
        for i in store.list_marketplace_installs()
    ]


@router.get("/stats", response_model=StatsOut)
def get_stats():
    all_assets = store.list_marketplace_assets()
    return StatsOut(
        total_assets=len(all_assets),
        total_datasets=sum(1 for a in all_assets if a.asset_type == 'dataset'),
        total_pipelines=sum(1 for a in all_assets if a.asset_type == 'pipeline'),
        total_models=sum(1 for a in all_assets if a.asset_type == 'model'),
        total_downloads=sum(a.download_count for a in all_assets),
        total_installs=len(store.list_marketplace_installs()),
    )


@router.get("/assets/{asset_id}", response_model=AssetOut)
def get_asset(asset_id: str):
    a = store.get_marketplace_asset(asset_id)
    if not a:
        raise HTTPException(404, "Asset not found")
    a.view_count += 1
    store.update_marketplace_asset(a)
    return AssetOut.from_asset(a)


@router.post("/assets", response_model=AssetOut, status_code=201)
def publish_asset(body: PublishRequest):
    if body.asset_type not in VALID_TYPES:
        raise HTTPException(400, f"asset_type must be one of {VALID_TYPES}")
    if body.category not in VALID_CATEGORIES:
        raise HTTPException(400, f"category must be one of {VALID_CATEGORIES}")
    if body.license not in VALID_LICENSES:
        raise HTTPException(400, f"license must be one of {VALID_LICENSES}")
    if not body.title.strip():
        raise HTTPException(400, "title is required")

    # Generate preview from source
    if body.asset_type == 'dataset':
        if not store.get_dataset(body.source_id):
            raise HTTPException(404, "Source dataset not found")
        preview = _gen_dataset_preview(body.source_id)
        ds = store.get_dataset(body.source_id)
        file_size = ds.size_bytes or 0
    elif body.asset_type == 'pipeline':
        if not store.get_pipeline(body.source_id):
            raise HTTPException(404, "Source pipeline not found")
        preview = _gen_pipeline_preview(body.source_id)
        file_size = 0
    elif body.asset_type == 'model':
        s = store.get_al_session(body.source_id)
        if not s:
            raise HTTPException(404, "Source AL session not found")
        if s.status != 'complete':
            raise HTTPException(400, "AL session must be complete before publishing")
        preview = _gen_model_preview(body.source_id)
        file_size = 0
        if s.model_path and Path(s.model_path).exists():
            file_size = Path(s.model_path).stat().st_size
    elif body.asset_type == 'benchmark_config':
        if not store.get_benchmark_job(body.source_id):
            raise HTTPException(404, "Source benchmark job not found")
        preview = _gen_benchmark_preview(body.source_id)
        file_size = 0

    asset = MarketplaceAsset(
        title=body.title.strip(),
        description=body.description.strip(),
        long_description=body.long_description.strip(),
        asset_type=body.asset_type,
        category=body.category,
        tags=body.tags,
        author_name=body.author_name or "You",
        license=body.license,
        version=body.version or "1.0.0",
        status='published',
        is_seeded=False,
        source_id=body.source_id,
        preview=preview,
        file_size=file_size,
    )
    store.add_marketplace_asset(asset)
    return AssetOut.from_asset(asset)


@router.patch("/assets/{asset_id}", response_model=AssetOut)
def update_asset(asset_id: str, body: UpdateRequest):
    a = store.get_marketplace_asset(asset_id)
    if not a:
        raise HTTPException(404, "Asset not found")
    if a.is_seeded:
        raise HTTPException(400, "Cannot edit seeded assets")
    if body.title is not None: a.title = body.title.strip()
    if body.description is not None: a.description = body.description.strip()
    if body.long_description is not None: a.long_description = body.long_description.strip()
    if body.category is not None: a.category = body.category
    if body.tags is not None: a.tags = body.tags
    if body.license is not None: a.license = body.license
    if body.version is not None: a.version = body.version
    store.update_marketplace_asset(a)
    return AssetOut.from_asset(a)


@router.delete("/assets/{asset_id}", status_code=204)
def delete_asset(asset_id: str):
    a = store.get_marketplace_asset(asset_id)
    if not a:
        raise HTTPException(404, "Asset not found")
    if a.is_seeded:
        raise HTTPException(400, "Cannot delete seeded assets")
    store.delete_marketplace_asset(asset_id)


@router.post("/assets/{asset_id}/install", response_model=InstallOut)
def install_asset(asset_id: str):
    a = store.get_marketplace_asset(asset_id)
    if not a:
        raise HTTPException(404, "Asset not found")

    resulting_id = ""
    message = ""

    # ── Dataset install ────────────────────────────────────────────────
    if a.asset_type == 'dataset':
        import polars as pl

        storage = get_storage()

        if a.is_seeded:
            df = generate_seeded_dataset(a.seed_key)
        else:
            src_ds = store.get_dataset(a.source_id)
            if not src_ds or not storage.exists(src_ds.file_path):
                raise HTTPException(400, "Source dataset no longer available")
            df = pl.read_csv(str(storage.local_path(src_ds.file_path)))

        safe = "".join(c if c.isalnum() or c in '-_' else '_' for c in a.title)
        filename = f"{safe}_{uuid.uuid4().hex[:6]}.csv"
        csv_bytes = df.write_csv().encode()
        stored_key, display_name = storage.unique_save(filename, csv_bytes)

        new_ds = Dataset(
            name=display_name,
            row_count=len(df),
            column_count=len(df.columns),
            size_bytes=len(csv_bytes),
            status='ready',
            file_path=stored_key,
            schema=[{'name': c, 'dtype': str(t), 'nullable': True}
                    for c, t in zip(df.columns, df.dtypes)],
        )
        store.add_dataset(new_ds)
        resulting_id = new_ds.id
        message = f"Installed as dataset '{new_ds.name}' ({len(df):,} rows)"

    # ── Pipeline install ───────────────────────────────────────────────
    elif a.asset_type == 'pipeline':
        if a.is_seeded:
            raw_steps = get_seeded_pipeline_steps(a.seed_key)
        else:
            src_p = store.get_pipeline(a.source_id)
            if not src_p:
                raise HTTPException(400, "Source pipeline no longer available")
            raw_steps = src_p.steps

        new_steps = [{'id': str(uuid.uuid4()), 'type': s['type'], 'config': dict(s.get('config', {}))}
                     for s in raw_steps]
        new_p = Pipeline(
            name=f"{a.title} (from Marketplace)",
            description=a.description,
            steps=new_steps,
            status='ready',
        )
        store.add_pipeline(new_p)
        resulting_id = new_p.id
        message = f"Installed as pipeline '{new_p.name}' ({len(new_steps)} steps)"

    # ── Model install ──────────────────────────────────────────────────
    elif a.asset_type == 'model':
        from app.models.store import ALSession
        src = store.get_al_session(a.source_id)
        if not src:
            raise HTTPException(400, "Source AL session no longer available")

        new_model_path = None
        if src.model_path and Path(src.model_path).exists():
            model_dir = DATA_DIR / "al_models"
            model_dir.mkdir(exist_ok=True)
            dst = model_dir / f"{uuid.uuid4().hex}.pkl"
            shutil.copy2(src.model_path, dst)
            new_model_path = str(dst)

        stub = ALSession(
            name=f"{a.title} (from Marketplace)",
            dataset_id=src.dataset_id,
            target_column=src.target_column,
            task_type=src.task_type,
            model_type=src.model_type,
            sampling_strategy=src.sampling_strategy,
            batch_size=src.batch_size,
            label_classes=src.label_classes,
            model_name=a.title,
            status='complete',
            current_round=src.current_round,
            rounds=src.rounds,
            model_path=new_model_path,
        )
        store.add_al_session(stub)
        resulting_id = stub.id
        message = f"Model installed as AL session '{stub.name}'"

    # ── Benchmark config install ───────────────────────────────────────
    elif a.asset_type == 'benchmark_config':
        from app.models.store import BenchmarkJob
        src = store.get_benchmark_job(a.source_id)
        if not src:
            raise HTTPException(400, "Source benchmark no longer available")

        new_candidates = [
            {**c, 'id': str(uuid.uuid4())}
            for c in src.candidates
        ]
        new_job = BenchmarkJob(
            name=f"{a.title} (from Marketplace)",
            dataset_id=src.dataset_id,
            target_column=src.target_column,
            task_type=src.task_type,
            eval_protocol=src.eval_protocol,
            candidates=new_candidates,
            status='pending',
        )
        store.add_benchmark_job(new_job)
        resulting_id = new_job.id
        message = f"Benchmark config installed — ready to run with {len(new_candidates)} candidates"

    else:
        raise HTTPException(400, f"Unknown asset type: {a.asset_type}")

    # Increment download count
    a.download_count += 1
    store.update_marketplace_asset(a)

    # Log install
    install = MarketplaceInstall(
        asset_id=a.id, asset_title=a.title,
        asset_type=a.asset_type, resulting_id=resulting_id,
    )
    store.add_marketplace_install(install)

    return InstallOut(resulting_id=resulting_id, asset_type=a.asset_type, message=message)


@router.post("/assets/{asset_id}/reviews", response_model=ReviewOut, status_code=201)
def submit_review(asset_id: str, body: ReviewRequest):
    if not store.get_marketplace_asset(asset_id):
        raise HTTPException(404, "Asset not found")

    review = MarketplaceReview(
        asset_id=asset_id,
        author_name=body.author_name.strip(),
        rating=body.rating,
        comment=body.comment.strip(),
    )
    store.add_marketplace_review(review)
    _recalc_rating(asset_id)
    return ReviewOut(id=review.id, asset_id=review.asset_id, author_name=review.author_name,
                     rating=review.rating, comment=review.comment, created_at=review.created_at)


@router.get("/assets/{asset_id}/reviews", response_model=list[ReviewOut])
def list_reviews(asset_id: str):
    if not store.get_marketplace_asset(asset_id):
        raise HTTPException(404, "Asset not found")
    reviews = store.list_marketplace_reviews(asset_id)
    return [ReviewOut(id=r.id, asset_id=r.asset_id, author_name=r.author_name,
                      rating=r.rating, comment=r.comment, created_at=r.created_at)
            for r in reviews]
