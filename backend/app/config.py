from __future__ import annotations

import os
import subprocess
from pathlib import Path
from typing import Optional

from app.paths import get_db_path


def _repo_root(start: Optional[Path] = None) -> Optional[Path]:
    current = start or Path(__file__).resolve()
    if current.is_file():
        current = current.parent
    for parent in [current, *current.parents]:
        if (parent / ".git").exists():
            return parent
    return None


def _run_git(args: list[str]) -> Optional[str]:
    repo = _repo_root()
    if not repo:
        return None
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=repo,
            check=True,
            capture_output=True,
            text=True,
        )
    except Exception:
        return None
    value = result.stdout.strip()
    return value or None


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
    env = os.getenv("SAHOCARS_BRANCH")
    if env:
        return env
    git_value = _run_git(["rev-parse", "--abbrev-ref", "HEAD"])
    if git_value:
        return git_value
    legacy = os.getenv("SAHOCARS_APP_BRANCH")
    if legacy:
        return legacy
    return "local"


def get_app_commit() -> str:
    env = os.getenv("SAHOCARS_COMMIT")
    if env:
        return env
    git_value = _run_git(["rev-parse", "--short", "HEAD"])
    if git_value:
        return git_value
    legacy = os.getenv("SAHOCARS_APP_COMMIT")
    if legacy:
        return legacy
    return "unknown"
