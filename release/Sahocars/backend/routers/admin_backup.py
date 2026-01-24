from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlmodel import SQLModel

from app.config import get_database_url
from services.backup_service import create_backup, list_backups, restore_backup, wipe_system

router = APIRouter(prefix="/admin", tags=["admin"])


class BackupCreateRequest(SQLModel):
    include_files: bool = True


class BackupRestoreRequest(SQLModel):
    dry_run: bool = True
    wipe_before_restore: bool = False
    confirm_wipe: bool = False


class WipeRequest(SQLModel):
    confirm_wipe: bool = False


@router.post("/backups")
def create_backup_endpoint(payload: BackupCreateRequest):
    return create_backup(get_database_url(), include_files=payload.include_files)


@router.get("/backups")
def list_backups_endpoint():
    return list_backups()


@router.post("/backups/{backup_id}/restore")
def restore_backup_endpoint(backup_id: str, payload: BackupRestoreRequest):
    return restore_backup(
        get_database_url(),
        backup_id,
        dry_run=payload.dry_run,
        wipe_before_restore=payload.wipe_before_restore,
        confirm_wipe=payload.confirm_wipe,
    )


@router.post("/wipe")
def wipe_system_endpoint(payload: WipeRequest):
    if not payload.confirm_wipe:
        raise HTTPException(status_code=422, detail="confirm_wipe es requerido para vaciar el sistema")
    return wipe_system(get_database_url())
