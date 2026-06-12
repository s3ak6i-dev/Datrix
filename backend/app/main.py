import logging
import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.limiter import limiter

_req_log = logging.getLogger("datrix.request")

from app.core.config import settings
from app.core.auth import get_current_user
from app.core.logging_setup import configure_logging
from app.db.engine import create_tables

configure_logging()

_startup_log = logging.getLogger("datrix.startup")

from app.api.auth import router as auth_router
from app.api.datasets import router as datasets_router
from app.api.pipelines import router as pipelines_router
from app.api.synthetic import router as synthetic_router
from app.api.active_learning import router as al_router
from app.api.benchmark import router as benchmark_router
from app.api.marketplace import router as marketplace_router
from app.api.settings import router as settings_router
from app.api.compliance import router as compliance_router
from app.services.compliance_checker import ensure_default_policies
from app.services.marketplace_seeder import initialize_seeds


def _reset_stale_jobs() -> None:
    """Mark jobs stuck in 'running' for > 30 min as failed at startup."""
    from datetime import datetime, timezone, timedelta
    from app.models.store import store

    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()

    for job in store.list_synthetic_jobs():
        if job.status == "running" and job.created_at < cutoff:
            job.status = "failed"
            job.error_message = "Interrupted by server restart"
            store.update_synthetic_job(job)

    for job in store.list_benchmark_jobs():
        if job.status == "running" and job.created_at < cutoff:
            job.status = "failed"
            job.error_message = "Interrupted by server restart"
            store.update_benchmark_job(job)

    for session in store.list_al_sessions():
        if session.status == "training" and session.created_at < cutoff:
            session.status = "annotating"
            store.update_al_session(session)

    for run in store.list_all_pipeline_runs():
        if run.status == "running" and run.created_at < cutoff:
            run.status = "failed"
            run.error_message = "Interrupted by server restart"
            store.update_pipeline_run(run)


def _run_migrations() -> None:
    try:
        from alembic.config import Config
        from alembic import command
        cfg = Config("alembic.ini")
        command.upgrade(cfg, "head")
        _startup_log.info("Alembic migrations applied")
    except Exception:
        _startup_log.exception("Alembic migration failed — falling back to create_all")
        create_tables()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _run_migrations()
    initialize_seeds()
    ensure_default_policies()
    _reset_stale_jobs()

    if settings.SENTRY_DSN:
        import sentry_sdk
        sentry_sdk.init(dsn=settings.SENTRY_DSN, environment=settings.ENVIRONMENT)

    yield


app = FastAPI(
    title="Datrix API",
    description="AI Data Infrastructure Platform",
    version="0.2.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public routes
app.include_router(auth_router)

# Protected routes — require a valid JWT on every request
_auth = [Depends(get_current_user)]
app.include_router(datasets_router,   dependencies=_auth)
app.include_router(pipelines_router,  dependencies=_auth)
app.include_router(synthetic_router,  dependencies=_auth)
app.include_router(al_router,         dependencies=_auth)
app.include_router(benchmark_router,  dependencies=_auth)
app.include_router(marketplace_router,dependencies=_auth)
app.include_router(settings_router,   dependencies=_auth)
app.include_router(compliance_router, dependencies=_auth)


@app.middleware("http")
async def _log_requests(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    ms = int((time.perf_counter() - t0) * 1000)
    _req_log.info(
        "%s %s %s %dms",
        request.method,
        request.url.path,
        response.status_code,
        ms,
    )
    return response


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.2.0", "environment": settings.ENVIRONMENT}
