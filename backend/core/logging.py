"""Centralised logging setup for the Grant Intelligence Platform backend."""

from __future__ import annotations

import logging
import sys


_CONFIGURED = False

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"


def setup_logging(*, debug: bool = False) -> None:
    """Configure the root logger once.

    Call this early in ``create_app()`` so every module that later calls
    ``get_logger()`` inherits the format and level.
    """
    global _CONFIGURED  # noqa: PLW0603
    if _CONFIGURED:
        return

    level = logging.DEBUG if debug else logging.INFO
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(LOG_FORMAT))

    root = logging.getLogger()
    root.setLevel(level)
    # Avoid duplicate handlers when uvicorn reloads
    if not root.handlers:
        root.addHandler(handler)

    # Quiet noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """Return a child logger under the ``backend`` namespace."""
    return logging.getLogger(f"backend.{name}")
