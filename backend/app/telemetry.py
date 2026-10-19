import logging
import os
from contextlib import contextmanager
from typing import Any, Dict, Optional
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from app.config import settings

logger = logging.getLogger(__name__)

def init_sentry() -> bool:
    """Initializes Sentry SDK with distributed performance tracing and error tracking."""
    dsn = settings.SENTRY_DSN
    if not dsn:
        logger.warning("SENTRY_DSN is not configured. Sentry telemetry is inactive.")
        return False

    try:
        sentry_sdk.init(
            dsn=dsn,
            traces_sample_rate=1.0,
            send_default_pii=False,
            environment=os.getenv("ENVIRONMENT", "development"),
            release="chaoticsplitter@1.0.0",
        )
        sentry_sdk.set_tag("app.name", "ChaoticSplitter")
        sentry_sdk.set_tag("event.hackathon", "hacktoberfest")
        logger.info("✓ Sentry Agent Tracing & Observability initialized successfully.")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize Sentry: {e}")
        return False

@contextmanager
def trace_span(op: str, description: str, data: Optional[Dict[str, Any]] = None):
    """Context manager to record a discrete AI agent or computational span in Sentry."""
    if not settings.SENTRY_DSN:
        yield None
        return

    try:
        with sentry_sdk.start_span(op=op, description=description) as span:
            if data:
                for key, val in data.items():
                    span.set_data(key, val)
            yield span
    except Exception as err:
        logger.debug(f"Span tracing encountered non-fatal error: {err}")
        yield None

def capture_agent_event(event_name: str, payload: Optional[Dict[str, Any]] = None):
    """Records an agent breadcrumb and optional metric to Sentry."""
    if not settings.SENTRY_DSN:
        return
    try:
        sentry_sdk.add_breadcrumb(
            category="agent.action",
            message=event_name,
            level="info",
            data=payload or {},
        )
    except Exception:
        pass
