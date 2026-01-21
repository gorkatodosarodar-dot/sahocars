from __future__ import annotations

import io
import zipfile
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlmodel import SQLModel

from db import get_session
from services.vehicle_transfer_service import build_export_package, import_package, parse_import_package

router = APIRouter(prefix="/admin/vehicles", tags=["admin-vehicles"])


class VehicleExportRequest(SQLModel):
    vehicle_ids: List[str]
    include_files: bool = True


@router.post("/export")
def export_vehicles(payload: VehicleExportRequest, session=Depends(get_session)):
    if not payload.vehicle_ids:
        raise HTTPException(status_code=422, detail="vehicle_ids es requerido")
    data = build_export_package(session, payload.vehicle_ids, include_files=payload.include_files)
    filename = "vehicles_export.zip"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/import")
def import_vehicles(
    file: UploadFile = File(...),
    mode: str = Form(...),
    session=Depends(get_session),
):
    raw = file.file.read()
    manifest, data, files_index, archive = parse_import_package(raw)
    _validate_zip_paths(files_index)
    result = import_package(session, manifest, data, archive, mode)
    return result


def _validate_zip_paths(files_index: dict[str, zipfile.ZipInfo]) -> None:
    for name in files_index:
        if name.startswith(("/", "\\")) or ":" in name:
            raise HTTPException(status_code=422, detail="Ruta absoluta detectada en el zip")
        if ".." in name.split("/"):
            raise HTTPException(status_code=422, detail="Ruta maliciosa detectada en el zip")
