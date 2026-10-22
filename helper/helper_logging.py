"""Case-free structured diagnostic logging; logging must never block work."""

from datetime import datetime, timezone
from functools import wraps
import json
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
import threading
import time

_LOCK = threading.Lock()
_LOGGER = None
OPERATIONS = {
    "backup-retention",
    "case-save",
    "summary-save",
    "lock",
    "pdf",
    "outbox",
    "lookup",
    "backup",
    "email-draft",
    "setup",
    "report-view",
    "search",
    "shutdown",
}
ERRORS = {"OSError", "ValueError", "TypeError", "RuntimeError", "CaseLookupError", "FileNotFoundError", "PermissionError", "TimeoutExpired"}


def record(operation, status, duration_ms=None, error=None):
    global _LOGGER
    if operation not in OPERATIONS or status not in {"start", "ok", "failed", "conflict", "acquired", "released"}:
        return
    try:
        with _LOCK:
            if _LOGGER is None:
                base = Path(__file__).resolve().parent
                directory = base.parent / "build/logs" if (base.parent / "version.json").is_file() else base / "logs"
                directory.mkdir(parents=True, exist_ok=True)
                logger = logging.getLogger("madison-helper-structured")
                logger.propagate = False
                logger.setLevel(logging.INFO)
                handler = RotatingFileHandler(directory / "helper.jsonl", maxBytes=2 * 1024 * 1024, backupCount=3, encoding="utf-8")
                handler.setFormatter(logging.Formatter("%(message)s"))
                logger.addHandler(handler)
                _LOGGER = logger
        event = {"at": datetime.now(timezone.utc).isoformat(), "operation": operation, "status": status}
        if isinstance(duration_ms, (int, float)):
            event["durationMs"] = max(0, round(duration_ms, 2))
        if error is not None:
            event["errorClass"] = type(error).__name__ if type(error).__name__ in ERRORS else "OtherError"
        _LOGGER.info(json.dumps(event, separators=(",", ":")))
    except Exception:
        pass


def logged(operation):
    def decorate(function):
        @wraps(function)
        def wrapped(*args, **kwargs):
            started = time.monotonic()
            record(operation, "start")
            try:
                result = function(*args, **kwargs)
            except Exception as error:
                record(operation, "failed", (time.monotonic() - started) * 1000, error)
                raise
            status = "conflict" if isinstance(result, dict) and result.get("ok") is False else "ok"
            record(operation, status, (time.monotonic() - started) * 1000)
            return result

        return wrapped

    return decorate
