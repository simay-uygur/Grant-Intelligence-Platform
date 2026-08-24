"""Centralised logging setup for the Grant Intelligence Platform backend."""

from __future__ import annotations

import logging
import sys
from pathlib import Path

_CONFIGURED = False

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
LOG_FILE_PATH = Path("storage/backend.log")


def setup_logging(*, debug: bool = False, log_file: Path | str | None = None) -> None:
    """Configure the root logger once.

    Call this early in ``create_app()`` so every module that later calls
    ``get_logger()`` inherits the format and level.
    """
    global _CONFIGURED  # noqa: PLW0603
    if _CONFIGURED:
        return

    level = logging.DEBUG if debug else logging.INFO
    formatter = logging.Formatter(LOG_FORMAT)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)

    # Ensure log directory exists and attach file handler
    target_file = Path(log_file) if log_file else LOG_FILE_PATH
    target_file.parent.mkdir(parents=True, exist_ok=True)
    file_handler = logging.FileHandler(target_file, encoding="utf-8")
    file_handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(level)
    # Avoid duplicate handlers when uvicorn reloads
    if not root.handlers:
        root.addHandler(stream_handler)
        root.addHandler(file_handler)

    # Quiet noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """Return a child logger under the ``backend`` namespace."""
    return logging.getLogger(f"backend.{name}")
