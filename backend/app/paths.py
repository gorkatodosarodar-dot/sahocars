from __future__ import annotations

import os
import shutil
from pathlib import Path


def get_data_dir() -> Path:
    override = os.getenv("SAHOCARS_DATA_DIR")
    if override:
        path = Path(override).expanduser()
    else:
        base = os.getenv("LOCALAPPDATA") or os.getenv("APPDATA")
        if base:
            path = Path(base) / "Sahocars" / "data"
        else:
            path = Path.home() / "AppData" / "Local" / "Sahocars" / "data"
    path.mkdir(parents=True, exist_ok=True)
    return path.resolve()


def get_db_path() -> Path:
    return get_data_dir() / "db.sqlite"


def get_storage_dir() -> Path:
    path = get_data_dir() / "storage"
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_backups_dir() -> Path:
    path = get_data_dir() / "backups"
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_logs_dir() -> Path:
    path = get_data_dir() / "logs"
    path.mkdir(parents=True, exist_ok=True)
    return path


def migrate_legacy_data(logger=None) -> None:
    data_dir = get_data_dir()
    repo_root = Path(__file__).resolve().parents[2]
    legacy_db = repo_root / "backend" / "sahocars.db"
    target_db = get_db_path()
    if legacy_db.exists() and not target_db.exists():
        _safe_copy(legacy_db, target_db, logger, "db")

    legacy_storage = repo_root / "backend" / "storage"
    target_storage = get_storage_dir()
    if legacy_storage.exists() and _is_dir_with_files(legacy_storage) and not _is_dir_with_files(target_storage):
        _safe_copytree(legacy_storage, target_storage, logger, "storage")


def _safe_copy(source: Path, dest: Path, logger, label: str) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, dest)
    if logger:
        logger.info("Migracion %s: %s -> %s", label, source, dest)


def _safe_copytree(source: Path, dest: Path, logger, label: str) -> None:
    shutil.copytree(source, dest, dirs_exist_ok=True)
    if logger:
        logger.info("Migracion %s: %s -> %s", label, source, dest)


def _is_dir_with_files(path: Path) -> bool:
    if not path.exists():
        return False
    for entry in path.rglob("*"):
        if entry.is_file():
            return True
    return False
