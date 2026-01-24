from __future__ import annotations

import os

from app.paths import get_db_path


def get_env() -> str:
    return os.getenv("SAHOCARS_ENV", "dev")


def get_host() -> str:
    return os.getenv("SAHOCARS_HOST", "127.0.0.1")


def get_port() -> int:
    return int(os.getenv("SAHOCARS_PORT", "8000"))


def get_frontend_url() -> str:
    return os.getenv("SAHOCARS_FRONTEND_URL", "http://localhost:5173")


def get_database_url() -> str:
    override = os.getenv("DATABASE_URL")
    if override:
        return override
    return f"sqlite:///{get_db_path().as_posix()}"


def get_app_version() -> str:
    return os.getenv("SAHOCARS_APP_VERSION", "dev")


def get_app_branch() -> str:
    return os.getenv("SAHOCARS_APP_BRANCH", "local")


def get_app_commit() -> str:
    return os.getenv("SAHOCARS_APP_COMMIT", "unknown")
