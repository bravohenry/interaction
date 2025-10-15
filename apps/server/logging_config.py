from __future__ import annotations

import logging
import os
import sys

logger = logging.getLogger("openpoke.server")


class StdoutFilter(logging.Filter):
    """Filter to send INFO, DEBUG, WARNING to stdout."""

    def filter(self, record: logging.LogRecord) -> bool:
        return record.levelno < logging.ERROR


class StderrFilter(logging.Filter):
    """Filter to send ERROR, CRITICAL to stderr."""

    def filter(self, record: logging.LogRecord) -> bool:
        return record.levelno >= logging.ERROR


def configure_logging() -> None:
    """Configure logging with environment-aware stream routing."""
    root_logger = logging.getLogger()

    if root_logger.handlers:
        return

    # Detect deployment environment
    is_railway = "RAILWAY_ENVIRONMENT" in os.environ
    is_vercel = "VERCEL" in os.environ

    # Set root logger level
    root_logger.setLevel(logging.INFO)

    # Create formatter
    formatter = logging.Formatter(
        fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    if is_railway:
        # Railway: All logs to stdout to avoid error classification
        stdout_handler = logging.StreamHandler(sys.stdout)
        stdout_handler.setLevel(logging.DEBUG)
        stdout_handler.setFormatter(formatter)
        root_logger.addHandler(stdout_handler)
    elif is_vercel:
        # Vercel: Split logs by level
        stdout_handler = logging.StreamHandler(sys.stdout)
        stdout_handler.setLevel(logging.DEBUG)
        stdout_handler.setFormatter(formatter)
        stdout_handler.addFilter(StdoutFilter())
        root_logger.addHandler(stdout_handler)

        stderr_handler = logging.StreamHandler(sys.stderr)
        stderr_handler.setLevel(logging.ERROR)
        stderr_handler.setFormatter(formatter)
        stderr_handler.addFilter(StderrFilter())
        root_logger.addHandler(stderr_handler)
    else:
        # Local development: All logs to stdout
        stdout_handler = logging.StreamHandler(sys.stdout)
        stdout_handler.setLevel(logging.DEBUG)
        stdout_handler.setFormatter(formatter)
        root_logger.addHandler(stdout_handler)

    # Reduce noise from third-party libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
