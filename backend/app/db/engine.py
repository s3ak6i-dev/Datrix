from sqlalchemy import create_engine
from app.core.config import settings
from app.db.base import Base
import app.db.models  # noqa: F401 — must import so Base.metadata knows about all tables

# psycopg2 requires 'postgresql+psycopg2://' scheme
_url = settings.DATABASE_URL
if _url.startswith("postgresql://"):
    _url = _url.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(
    _url,
    pool_pre_ping=True,   # detect stale connections
    pool_size=5,
    max_overflow=10,
    connect_args={"connect_timeout": 10},
)


def create_tables() -> None:
    """Create all tables that don't exist yet. Called on startup."""
    Base.metadata.create_all(bind=engine)
