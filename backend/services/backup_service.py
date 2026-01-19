from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse
from uuid import uuid4

from fastapi import HTTPException

DEFAULT_BACKUP_DIR = "backups"
BACKUP_PREFIX = "backup_"
BACKUP_EXTENSION = ".sqlite"
FILES_ARCHIVE_SUFFIX = ".files.zip"
MANIFEST_SUFFIX = ".manifest.json"


def create_backup(database_url: str, include_files: bool = True) -> dict[str, Any]:
    backup_dir = _resolve_backup_dir()
    backend_root = _backend_root()
    db_path = _resolve_sqlite_path(database_url, backend_root)
    storage_root = _resolve_storage_root(backend_root)

    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Base de datos no encontrada para backup")

    backup_id = _generate_backup_id()
    backup_path = backup_dir / f"{BACKUP_PREFIX}{backup_id}{BACKUP_EXTENSION}"
    files_archive_path = backup_dir / f"{BACKUP_PREFIX}{backup_id}{FILES_ARCHIVE_SUFFIX}"

    warnings: list[str] = []

    _sqlite_backup(db_path, backup_path)
    integrity_result = _sqlite_integrity_check(backup_path)
    if integrity_result != "ok":
        warnings.append(f"Integrity check: {integrity_result}")

    size_bytes = backup_path.stat().st_size
    sha256 = _sha256_for_file(backup_path)
    created_at = datetime.utcnow().isoformat()

    files_included = False
    files_size_bytes = None
    files_sha256 = None
    if include_files:
        files_included = True
        if storage_root.exists():
            _zip_directory(storage_root, files_archive_path)
            files_size_bytes = files_archive_path.stat().st_size
            files_sha256 = _sha256_for_file(files_archive_path)
        else:
            warnings.append("Storage root no existe; backup de archivos vacio")
            _zip_directory(storage_root, files_archive_path, allow_missing=True)
            files_size_bytes = files_archive_path.stat().st_size
            files_sha256 = _sha256_for_file(files_archive_path)

    manifest = {
        "id": backup_id,
        "filename": backup_path.name,
        "created_at": created_at,
        "size_bytes": size_bytes,
        "sha256": sha256,
        "db_engine": "sqlite",
        "app_version": os.getenv("APP_VERSION", "unknown"),
        "schema_version": os.getenv("SCHEMA_VERSION", "unknown"),
        "integrity_check": integrity_result,
        "files_included": files_included,
        "files_filename": files_archive_path.name if files_included else None,
        "files_size_bytes": files_size_bytes,
        "files_sha256": files_sha256,
        "warnings": warnings,
    }
    manifest_path = backup_dir / f"{backup_path.stem}{MANIFEST_SUFFIX}"
    _write_json(manifest_path, manifest)

    return {
        "id": backup_id,
        "filename": backup_path.name,
        "created_at": created_at,
        "size_bytes": size_bytes,
        "sha256": sha256,
        "manifest": manifest,
        "files_included": files_included,
        "files_filename": files_archive_path.name if files_included else None,
        "files_size_bytes": files_size_bytes,
        "files_sha256": files_sha256,
        "warnings": warnings,
    }


def list_backups() -> list[dict[str, Any]]:
    backup_dir = _resolve_backup_dir()
    items: list[dict[str, Any]] = []

    for backup_path in backup_dir.glob(f"{BACKUP_PREFIX}*{BACKUP_EXTENSION}"):
        backup_id = backup_path.stem.replace(BACKUP_PREFIX, "", 1)
        manifest_path = backup_dir / f"{backup_path.stem}{MANIFEST_SUFFIX}"
        item = _build_list_item(backup_id, backup_path, manifest_path)
        items.append(item)

    items.sort(key=lambda item: item.get("created_at", ""), reverse=True)
    return items


def restore_backup(
    database_url: str,
    backup_id: str,
    dry_run: bool = True,
    wipe_before_restore: bool = False,
    confirm_wipe: bool = False,
) -> dict[str, Any]:
    backup_dir = _resolve_backup_dir()
    backend_root = _backend_root()
    db_path = _resolve_sqlite_path(database_url, backend_root)
    storage_root = _resolve_storage_root(backend_root)

    backup_path = backup_dir / f"{BACKUP_PREFIX}{backup_id}{BACKUP_EXTENSION}"
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail="Backup no encontrado")

    manifest_path = backup_dir / f"{backup_path.stem}{MANIFEST_SUFFIX}"
    manifest = _read_manifest(manifest_path)

    warnings = _validate_backup(backup_path, manifest)
    files_archive_path = backup_dir / f"{BACKUP_PREFIX}{backup_id}{FILES_ARCHIVE_SUFFIX}"
    warnings.extend(_validate_files(files_archive_path, manifest))
    if dry_run:
        return {
            "ok": True,
            "dry_run": True,
            "restored": False,
            "requires_restart": False,
            "message": "Backup valido para restauracion",
            "safety_backup_id": None,
            "warnings": warnings,
        }

    safety_backup = create_backup(database_url, include_files=True)

    if wipe_before_restore:
        if not confirm_wipe:
            raise HTTPException(status_code=422, detail="confirm_wipe es requerido para vaciar antes del restore")
        _sqlite_wipe(db_path)
        _wipe_storage(storage_root)
        warnings.append("Se ha vaciado el sistema antes de la restauracion")

    try:
        _sqlite_restore(backup_path, db_path)
    except sqlite3.Error as exc:
        raise HTTPException(status_code=409, detail=f"No se pudo restaurar el backup: {exc}") from exc

    if manifest.get("files_included"):
        _restore_files_archive(files_archive_path, storage_root)

    return {
        "ok": True,
        "dry_run": False,
        "restored": True,
        "requires_restart": True,
        "message": "Restauracion completada. Se recomienda reiniciar el backend.",
        "safety_backup_id": safety_backup.get("id"),
        "warnings": warnings,
    }


def wipe_system(database_url: str) -> dict[str, Any]:
    backend_root = _backend_root()
    db_path = _resolve_sqlite_path(database_url, backend_root)
    storage_root = _resolve_storage_root(backend_root)

    _sqlite_wipe(db_path)
    _wipe_storage(storage_root)

    return {
        "ok": True,
        "message": "Sistema vaciado correctamente",
    }


def _resolve_backup_dir() -> Path:
    raw_dir = os.getenv("BACKUP_DIR", DEFAULT_BACKUP_DIR)
    backup_dir = Path(raw_dir)
    if not backup_dir.is_absolute():
        backup_dir = _backend_root() / backup_dir
    backup_dir.mkdir(parents=True, exist_ok=True)
    return backup_dir


def _backend_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _resolve_storage_root(base_dir: Path) -> Path:
    raw_root = os.getenv("STORAGE_ROOT", "storage")
    storage_root = Path(raw_root)
    if not storage_root.is_absolute():
        storage_root = (base_dir / storage_root).resolve()
    return storage_root


def _resolve_sqlite_path(database_url: str, base_dir: Path) -> Path:
    if not database_url.startswith("sqlite"):
        raise HTTPException(status_code=501, detail="Motor de base de datos no soportado para backups")

    if database_url in ("sqlite://", "sqlite:///:memory:"):
        raise HTTPException(status_code=422, detail="SQLite en memoria no soportado para backups")

    parsed = urlparse(database_url)
    raw_path = unquote(parsed.path or "")

    if database_url.startswith("sqlite:////"):
        db_path = Path(raw_path)
    else:
        if raw_path.startswith("/") and len(raw_path) >= 3 and raw_path[2] == ":":
            raw_path = raw_path[1:]
        elif raw_path.startswith("/"):
            raw_path = raw_path[1:]
        db_path = Path(raw_path)

    if not db_path.is_absolute():
        db_path = (base_dir / db_path).resolve()

    return db_path


def _generate_backup_id() -> str:
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    suffix = uuid4().hex[:6]
    return f"{timestamp}_{suffix}"


def _sqlite_backup(db_path: Path, backup_path: Path) -> None:
    with sqlite3.connect(db_path) as source:
        source.execute("PRAGMA busy_timeout = 5000")
        with sqlite3.connect(backup_path) as target:
            source.backup(target)


def _sqlite_restore(backup_path: Path, db_path: Path) -> None:
    with sqlite3.connect(backup_path) as source:
        with sqlite3.connect(db_path) as target:
            target.execute("PRAGMA busy_timeout = 5000")
            source.backup(target)


def _sqlite_integrity_check(backup_path: Path) -> str:
    with sqlite3.connect(backup_path) as conn:
        cursor = conn.execute("PRAGMA integrity_check;")
        result = cursor.fetchone()
    if not result:
        return "unknown"
    return str(result[0])


def _sha256_for_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _read_manifest(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _validate_backup(backup_path: Path, manifest: dict[str, Any]) -> list[str]:
    warnings: list[str] = []
    if not manifest:
        warnings.append("Manifest no encontrado o invalido")
        return warnings

    expected_hash = manifest.get("sha256")
    if expected_hash:
        actual_hash = _sha256_for_file(backup_path)
        if actual_hash != expected_hash:
            raise HTTPException(status_code=409, detail="El hash del backup no coincide")
    else:
        warnings.append("Manifest sin hash")

    integrity = _sqlite_integrity_check(backup_path)
    if integrity != "ok":
        warnings.append(f"Integrity check: {integrity}")
    return warnings


def _validate_files(files_archive_path: Path, manifest: dict[str, Any]) -> list[str]:
    warnings: list[str] = []
    if not manifest:
        return warnings
    if not manifest.get("files_included"):
        return warnings
    if not files_archive_path.exists():
        raise HTTPException(status_code=404, detail="Backup de archivos no encontrado")
    expected_hash = manifest.get("files_sha256")
    if expected_hash:
        actual_hash = _sha256_for_file(files_archive_path)
        if actual_hash != expected_hash:
            raise HTTPException(status_code=409, detail="El hash del backup de archivos no coincide")
    else:
        warnings.append("Manifest sin hash de archivos")
    return warnings


def _zip_directory(source_dir: Path, archive_path: Path, allow_missing: bool = False) -> None:
    if not source_dir.exists():
        if allow_missing:
            with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED):
                return
        raise HTTPException(status_code=404, detail="Storage root no encontrado para backup")

    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for item in source_dir.rglob("*"):
            if item.is_file():
                archive.write(item, item.relative_to(source_dir))


def _restore_files_archive(archive_path: Path, storage_root: Path) -> None:
    temp_extract = archive_path.parent / f"{archive_path.stem}_extract"
    if temp_extract.exists():
        _remove_dir(temp_extract)
    temp_extract.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(archive_path, "r") as archive:
        _safe_extract(archive, temp_extract)

    temp_old = storage_root.parent / f"{storage_root.name}_old_{uuid4().hex[:6]}"
    try:
        if storage_root.exists():
            storage_root.replace(temp_old)
        temp_extract.replace(storage_root)
    finally:
        _remove_dir(temp_old)


def _safe_extract(archive: zipfile.ZipFile, target_dir: Path) -> None:
    for member in archive.namelist():
        member_path = (target_dir / member).resolve()
        if not str(member_path).startswith(str(target_dir.resolve())):
            raise HTTPException(status_code=422, detail="Backup de archivos contiene rutas invalidas")
    archive.extractall(target_dir)


def _remove_dir(path: Path) -> None:
    if not path.exists():
        return
    for item in path.rglob("*"):
        if item.is_file():
            item.unlink(missing_ok=True)
    for item in sorted(path.rglob("*"), reverse=True):
        if item.is_dir():
            item.rmdir()
    if path.is_dir():
        path.rmdir()


def _build_list_item(backup_id: str, backup_path: Path, manifest_path: Path) -> dict[str, Any]:
    manifest = _read_manifest(manifest_path)
    created_at = manifest.get("created_at") if manifest else datetime.utcfromtimestamp(backup_path.stat().st_mtime).isoformat()
    sha256 = manifest.get("sha256") if manifest else None
    size_bytes = manifest.get("size_bytes") if manifest else backup_path.stat().st_size
    files_included = manifest.get("files_included") if manifest else False
    files_filename = manifest.get("files_filename") if manifest else None
    files_size_bytes = manifest.get("files_size_bytes") if manifest else None
    files_sha256 = manifest.get("files_sha256") if manifest else None
    incomplete = not bool(manifest)
    return {
        "id": backup_id,
        "filename": backup_path.name,
        "created_at": created_at,
        "size_bytes": size_bytes,
        "sha256": sha256,
        "manifest": manifest or None,
        "files_included": files_included,
        "files_filename": files_filename,
        "files_size_bytes": files_size_bytes,
        "files_sha256": files_sha256,
        "incomplete": incomplete,
    }


def _sqlite_wipe(db_path: Path) -> None:
    if not db_path.exists():
        return
    with sqlite3.connect(db_path) as conn:
        conn.execute("PRAGMA foreign_keys = OFF;")
        tables = [row[0] for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
        ).fetchall()]
        for table in tables:
            conn.execute(f"DELETE FROM {table};")
        try:
            conn.execute("DELETE FROM sqlite_sequence;")
        except sqlite3.Error:
            pass
        conn.commit()


def _wipe_storage(storage_root: Path) -> None:
    if storage_root.exists():
        _remove_dir(storage_root)
    storage_root.mkdir(parents=True, exist_ok=True)


# Checklist manual:
# 1) Crear vehiculo con fotos/documentos y gastos asociados.
# 2) POST /admin/backups (include_files=true).
# 3) Borrar vehiculo y archivos en storage.
# 4) POST /admin/backups/{id}/restore con dry_run=true.
# 5) POST /admin/backups/{id}/restore con dry_run=false.
# 6) Verificar vehiculo, gastos y apertura de fotos/documentos.
