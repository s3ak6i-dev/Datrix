"""Billing API — placeholder until payment integration is added."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.db import models as M
from app.models.store import store

router = APIRouter(prefix="/billing", tags=["billing"])


class PlanOut(BaseModel):
    plan: str
    datasets_used: int
    datasets_limit: int
    pipelines_used: int
    pipelines_limit: int
    storage_used_mb: int
    storage_limit_mb: int
    features: list[str]


@router.get("/plan", response_model=PlanOut)
def get_plan(user: M.UserORM = Depends(get_current_user)):
    datasets = store.list_datasets(user_id=user.id)
    pipelines = store.list_pipelines(user_id=user.id)

    storage_bytes = sum(
        (d.size_bytes or 0) for d in datasets
    )

    return PlanOut(
        plan="free",
        datasets_used=len(datasets),
        datasets_limit=10,
        pipelines_used=len(pipelines),
        pipelines_limit=5,
        storage_used_mb=storage_bytes // (1024 * 1024),
        storage_limit_mb=500,
        features=[
            "Dataset upload & quality scanning",
            "Up to 10 datasets",
            "Up to 5 pipelines",
            "Synthetic data generation",
            "Active learning sessions",
            "ML benchmarking",
            "Compliance scanning",
            "Marketplace access",
        ],
    )
