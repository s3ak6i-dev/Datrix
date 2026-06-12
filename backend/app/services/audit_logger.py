"""Append-only audit logger. Call log() from any API handler or service."""
from __future__ import annotations
import time
from typing import Optional
from app.models.store import store, AuditEvent

_CATEGORY_MAP = {
    "dataset":     "data",
    "pipeline":    "pipeline",
    "pipeline_run":"pipeline",
    "al":          "ml",
    "benchmark":   "ml",
    "synthetic":   "ml",
    "compliance":  "compliance",
    "marketplace": "marketplace",
    "settings":    "settings",
}


def log(
    event_type: str,
    entity_type: str = "",
    entity_id: str = "",
    entity_name: str = "",
    metadata: Optional[dict] = None,
    duration_ms: Optional[int] = None,
) -> AuditEvent:
    prefix = event_type.split(".")[0]
    category = _CATEGORY_MAP.get(prefix, "data")
    event = AuditEvent(
        event_type=event_type,
        category=category,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        metadata=metadata or {},
        duration_ms=duration_ms,
    )
    store.add_audit_event(event)
    return event


class Timer:
    """Context manager that measures elapsed ms."""
    def __init__(self):
        self.ms = 0

    def __enter__(self):
        self._t = time.perf_counter()
        return self

    def __exit__(self, *_):
        self.ms = int((time.perf_counter() - self._t) * 1000)
