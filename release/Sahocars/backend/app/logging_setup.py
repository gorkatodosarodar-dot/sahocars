from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler

from app.paths import get_logs_dir


def setup_logging(app_env: str, app_version: str, app_branch: str, app_commit: str) -> logging.Logger:
    logger = logging.getLogger("sahocars")
    if logger.handlers:
        return logger
    logger.setLevel(logging.INFO)

    log_file = get_logs_dir() / "sahocars.log"
    handler = RotatingFileHandler(log_file, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8")
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    logger.info("Inicio Sahocars env=%s version=%s branch=%s commit=%s", app_env, app_version, app_branch, app_commit)
    return logger
