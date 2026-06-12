from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

app = FastAPI(
    title="Datrix API",
    description="AI Data Infrastructure Platform",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasets_router)
app.include_router(pipelines_router)
app.include_router(synthetic_router)
app.include_router(al_router)
app.include_router(benchmark_router)
app.include_router(marketplace_router)
app.include_router(settings_router)
app.include_router(compliance_router)

initialize_seeds()
ensure_default_policies()


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}
