"""
Configure structured JSON logging for non-development environments.
In development, standard text logging is used for readability.
"""
import logging
import sys

from app.core.config import settings


def configure_logging() -> None:
    if settings.ENVIRONMENT == "development":
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
            stream=sys.stdout,
        )
        return

    from pythonjsonlogger.json import JsonFormatter

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    )

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)

    # Silence noisy third-party loggers
    for noisy in ("uvicorn.access", "httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
