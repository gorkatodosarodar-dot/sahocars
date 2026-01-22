from __future__ import annotations

import hashlib
import io
import json
import os
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from sqlmodel import Session, select

from services.backup_service import _get_app_version, _get_schema_version


def build_export_package(session: Session, vehicle_ids: list[str], include_files: bool = True) -> bytes:
    from main import (
        Document,
        Expense,
        Photo,
        Sale,
        SaleDocument,
        Transfer,
        Vehicle,
        VehicleEvent,
        VehicleExpense,
        VehicleFile,
        VehicleLink,
        VehicleVisit,
    )

    normalized = [normalize_plate(value) for value in vehicle_ids]
    vehicles = session.exec(select(Vehicle).where(Vehicle.license_plate.in_(normalized))).all()
    if not vehicles:
        raise HTTPException(status_code=404, detail="Vehiculos no encontrados para exportar")

    vehicle_ids_set = {v.license_plate for v in vehicles}

    expenses = session.exec(select(VehicleExpense).where(VehicleExpense.vehicle_id.in_(vehicle_ids_set))).all()
    legacy_expenses = session.exec(select(Expense).where(Expense.vehicle_id.in_(vehicle_ids_set))).all()
    visits = session.exec(select(VehicleVisit).where(VehicleVisit.vehicle_id.in_(vehicle_ids_set))).all()
    links = session.exec(select(VehicleLink).where(VehicleLink.vehicle_id.in_(vehicle_ids_set))).all()
    files = session.exec(select(VehicleFile).where(VehicleFile.vehicle_id.in_(vehicle_ids_set))).all()
    sales = session.exec(select(Sale).where(Sale.vehicle_id.in_(vehicle_ids_set))).all()
    sale_docs = session.exec(select(SaleDocument).where(SaleDocument.vehicle_id.in_(vehicle_ids_set))).all()
    documents = session.exec(select(Document).where(Document.vehicle_id.in_(vehicle_ids_set))).all()
    photos = session.exec(select(Photo).where(Photo.vehicle_id.in_(vehicle_ids_set))).all()
    transfers = session.exec(select(Transfer).where(Transfer.vehicle_id.in_(vehicle_ids_set))).all()
    events = session.exec(select(VehicleEvent).where(VehicleEvent.vehicle_id.in_(vehicle_ids_set))).all()

    storage_root = _resolve_storage_root()
    files_payload, file_entries, file_warnings = _collect_files(
        storage_root=storage_root,
        files=files,
        sale_docs=sale_docs,
        documents=documents,
        photos=photos,
    )

    data = {
        "vehicles": _sorted_dump(vehicles, "license_plate"),
        "vehicle_expenses": _sorted_dump(expenses, "id"),
        "legacy_expenses": _sorted_dump(legacy_expenses, "id"),
        "vehicle_visits": _sorted_dump(visits, "id"),
        "vehicle_links": _sorted_dump(links, "id"),
        "vehicle_files": _sorted_dump(files, "id"),
        "sales": _sorted_dump(sales, "id"),
        "sale_documents": _sorted_dump(sale_docs, "id"),
        "documents": _sorted_dump(documents, "id"),
        "photos": _sorted_dump(photos, "id"),
        "transfers": _sorted_dump(transfers, "id"),
        "events": _sorted_dump(events, "id"),
        "file_entries": files_payload,
    }

    data_json = json.dumps(data, ensure_ascii=True, sort_keys=True, default=str).encode("utf-8")
    data_hash = hashlib.sha256(data_json).hexdigest()

    manifest = {
        "package_id": _generate_package_id(),
        "created_at": datetime.utcnow().isoformat(),
        "app_version": _get_app_version(),
        "schema_version": _get_schema_version(_database_url(), _database_path()),
        "vehicles_count": len(vehicles),
        "files_included": include_files,
        "files_count": len(file_entries) if include_files else 0,
        "data_sha256": data_hash,
        "warnings": file_warnings,
    }

    zip_bytes = _build_zip(manifest, data_json, file_entries, include_files)
    manifest["zip_sha256"] = hashlib.sha256(zip_bytes).hexdigest()
    zip_bytes = _build_zip(manifest, data_json, file_entries, include_files)
    return zip_bytes


def parse_import_package(upload: bytes) -> tuple[dict[str, Any], dict[str, Any], dict[str, zipfile.ZipInfo], zipfile.ZipFile]:
    if not upload:
        raise HTTPException(status_code=422, detail="Archivo zip vacio")

    zip_buffer = io.BytesIO(upload)
    try:
        archive = zipfile.ZipFile(zip_buffer)
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=422, detail="Zip invalido") from exc

    manifest = _read_json_from_zip(archive, "manifest.json")
    data = _read_json_from_zip(archive, "data.json")
    files_index = {info.filename: info for info in archive.infolist()}
    return manifest, data, files_index, archive


def import_package(
    session: Session,
    manifest: dict[str, Any],
    data: dict[str, Any],
    archive: zipfile.ZipFile,
    mode: str,
) -> dict[str, Any]:
    from main import (
        Document,
        Expense,
        Photo,
        Sale,
        SaleDocument,
        Transfer,
        Vehicle,
        VehicleEvent,
        VehicleExpense,
        VehicleFile,
        VehicleLink,
        VehicleVisit,
    )

    if mode not in {"skip", "overwrite", "new_copy"}:
        raise HTTPException(status_code=422, detail="Modo de importacion invalido")

    vehicles = data.get("vehicles", [])
    if not vehicles:
        raise HTTPException(status_code=422, detail="Paquete sin vehiculos")

    file_entries = data.get("file_entries", [])
    files_included = bool(manifest.get("files_included"))
    if not files_included:
        errors.append("Paquete sin archivos: se omitiran archivos adjuntos")
    file_map = {entry["export_path"]: entry for entry in file_entries}

    id_map: dict[str, dict[str, str]] = {"vehicles": {}, "vehicle_files": {}, "sales": {}}
    imported = 0
    skipped = 0
    errors: list[str] = []

    storage_root = _resolve_storage_root()

    for vehicle in vehicles:
        source_plate = normalize_plate(vehicle.get("license_plate", ""))
        identity = _vehicle_identity(vehicle)
        existing = _find_existing_vehicle(session, identity)

        if existing and mode == "skip":
            skipped += 1
            continue

        if existing and mode == "overwrite":
            target_plate = existing.license_plate
            _delete_vehicle_related(session, target_plate)
            _remove_vehicle_storage(storage_root, target_plate)
            target_vehicle = existing
            _apply_vehicle_update(target_vehicle, vehicle)
            session.add(target_vehicle)
            session.commit()
            session.refresh(target_vehicle)
        else:
            target_plate = source_plate
            if existing or mode == "new_copy":
                target_plate = _generate_unique_plate(session, source_plate)
            vehicle_payload = vehicle.copy()
            vehicle_payload["license_plate"] = target_plate
            vehicle_payload.pop("id", None)
            target_vehicle = Vehicle(**vehicle_payload)
            session.add(target_vehicle)
            session.commit()
            session.refresh(target_vehicle)

        id_map["vehicles"][source_plate] = target_plate
        imported += 1

        file_id_map: dict[str, int] = {}
        sale_id_map: dict[str, int] = {}

        for record in data.get("vehicle_files", []):
            if normalize_plate(record.get("vehicle_id", "")) != source_plate:
                continue
            if not files_included:
                continue
            record_payload = record.copy()
            source_file_id = str(record_payload.pop("id", ""))
            record_payload["vehicle_id"] = target_plate
            export_path = _find_export_path(file_entries, source_file_id)
            if not export_path:
                errors.append(f"Archivo no encontrado para vehicle_file {source_file_id}")
                continue
            stored_name = _import_file_from_zip(
                archive,
                export_path,
                storage_root / "vehicles" / vehicle_storage_key(target_plate),
                record_payload.get("stored_name") or "file.bin",
            )
            record_payload["stored_name"] = stored_name
            new_record = VehicleFile(**record_payload)
            session.add(new_record)
            session.commit()
            session.refresh(new_record)
            if source_file_id:
                file_id_map[source_file_id] = new_record.id

        for record in data.get("sales", []):
            if normalize_plate(record.get("vehicle_id", "")) != source_plate:
                continue
            record_payload = record.copy()
            source_sale_id = str(record_payload.pop("id", ""))
            record_payload["vehicle_id"] = target_plate
            new_record = Sale(**record_payload)
            session.add(new_record)
            session.commit()
            session.refresh(new_record)
            if source_sale_id:
                sale_id_map[source_sale_id] = new_record.id

        for record in data.get("sale_documents", []):
            if normalize_plate(record.get("vehicle_id", "")) != source_plate:
                continue
            if not files_included:
                continue
            record_payload = record.copy()
            source_doc_id = str(record_payload.pop("id", ""))
            record_payload["vehicle_id"] = target_plate
            source_sale_id = str(record_payload.get("sale_id", "")) if record_payload.get("sale_id") else None
            if source_sale_id and source_sale_id in sale_id_map:
                record_payload["sale_id"] = sale_id_map[source_sale_id]
            export_path = _find_export_path(file_entries, source_doc_id)
            if not export_path:
                errors.append(f"Archivo no encontrado para sale_document {source_doc_id}")
                continue
            stored_name = _import_file_from_zip(
                archive,
                export_path,
                storage_root / "vehicles" / vehicle_storage_key(target_plate) / "sale-documents",
                record_payload.get("stored_name") or "file.bin",
            )
            record_payload["stored_name"] = stored_name
            new_record = SaleDocument(**record_payload)
            session.add(new_record)
            session.commit()
            session.refresh(new_record)

        for record in data.get("documents", []):
            if normalize_plate(record.get("vehicle_id", "")) != source_plate:
                continue
            if not files_included:
                continue
            record_payload = record.copy()
            source_doc_id = str(record_payload.pop("id", ""))
            record_payload["vehicle_id"] = target_plate
            export_path = _find_export_path(file_entries, source_doc_id)
            if not export_path:
                errors.append(f"Archivo no encontrado para document {source_doc_id}")
                continue
            file_name = record_payload.get("file_name") or "documento"
            stored_path = _import_document_from_zip(
                archive,
                export_path,
                storage_root / "vehiculos" / vehicle_storage_key(target_plate) / "documentos",
                file_name,
            )
            record_payload["stored_path"] = str(stored_path)
            new_record = Document(**record_payload)
            session.add(new_record)
            session.commit()
            session.refresh(new_record)

        for record in data.get("photos", []):
            if normalize_plate(record.get("vehicle_id", "")) != source_plate:
                continue
            if not files_included:
                continue
            record_payload = record.copy()
            source_photo_id = str(record_payload.pop("id", ""))
            record_payload["vehicle_id"] = target_plate
            export_path = _find_export_path(file_entries, source_photo_id)
            if not export_path:
                errors.append(f"Archivo no encontrado para photo {source_photo_id}")
                continue
            file_name = record_payload.get("file_name") or "foto"
            stored_path = _import_document_from_zip(
                archive,
                export_path,
                storage_root / "vehiculos" / vehicle_storage_key(target_plate) / "fotos",
                file_name,
            )
            record_payload["stored_path"] = str(stored_path)
            new_record = Photo(**record_payload)
            session.add(new_record)
            session.commit()
            session.refresh(new_record)

        for record in data.get("vehicle_expenses", []):
            if normalize_plate(record.get("vehicle_id", "")) != source_plate:
                continue
            record_payload = record.copy()
            record_payload.pop("id", None)
            record_payload["vehicle_id"] = target_plate
            source_linked = record_payload.get("linked_vehicle_file_id")
            if source_linked is not None:
                mapped = file_id_map.get(str(source_linked))
                record_payload["linked_vehicle_file_id"] = mapped
            new_record = VehicleExpense(**record_payload)
            session.add(new_record)
        session.commit()

        for record in data.get("legacy_expenses", []):
            if normalize_plate(record.get("vehicle_id", "")) != source_plate:
                continue
            record_payload = record.copy()
            record_payload.pop("id", None)
            record_payload["vehicle_id"] = target_plate
            new_record = Expense(**record_payload)
            session.add(new_record)
        session.commit()

        for record in data.get("vehicle_visits", []):
            if normalize_plate(record.get("vehicle_id", "")) != source_plate:
                continue
            record_payload = record.copy()
            record_payload.pop("id", None)
            record_payload["vehicle_id"] = target_plate
            new_record = VehicleVisit(**record_payload)
            session.add(new_record)

        for record in data.get("vehicle_links", []):
            if normalize_plate(record.get("vehicle_id", "")) != source_plate:
                continue
            record_payload = record.copy()
            record_payload.pop("id", None)
            record_payload["vehicle_id"] = target_plate
            new_record = VehicleLink(**record_payload)
            session.add(new_record)

        for record in data.get("transfers", []):
            if normalize_plate(record.get("vehicle_id", "")) != source_plate:
                continue
            record_payload = record.copy()
            record_payload.pop("id", None)
            record_payload["vehicle_id"] = target_plate
            new_record = Transfer(**record_payload)
            session.add(new_record)

        for record in data.get("events", []):
            if normalize_plate(record.get("vehicle_id", "")) != source_plate:
                continue
            record_payload = record.copy()
            record_payload.pop("id", None)
            record_payload["vehicle_id"] = target_plate
            new_record = VehicleEvent(**record_payload)
            session.add(new_record)

        session.commit()

    return {
        "ok": True,
        "imported": imported,
        "skipped": skipped,
        "errors": errors,
        "id_map": id_map,
    }


def normalize_plate(value: str) -> str:
    if not value:
        raise HTTPException(status_code=422, detail="Matricula invalida")
    return value.strip().upper()


def vehicle_storage_key(license_plate: str) -> str:
    safe = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in license_plate.strip().upper())
    return safe or "unknown"


def _collect_files(
    storage_root: Path,
    files: list[Any],
    sale_docs: list[Any],
    documents: list[Any],
    photos: list[Any],
) -> tuple[list[dict[str, Any]], list[tuple[str, Path]], list[str]]:
    payload: list[dict[str, Any]] = []
    entries: list[tuple[str, Path]] = []
    warnings: list[str] = []

    def add_entry(export_path: str, source_path: Path, meta: dict[str, Any]) -> None:
        if not source_path.exists():
            warnings.append(f"Archivo faltante: {source_path}")
            return
        payload.append({"export_path": export_path, **meta})
        entries.append((export_path, source_path))

    for record in files:
        rel = Path("vehicles") / vehicle_storage_key(record.vehicle_id) / record.stored_name
        add_entry(
            f"files/{rel.as_posix()}",
            storage_root / rel,
            {"type": "vehicle_file", "vehicle_id": record.vehicle_id, "stored_name": record.stored_name, "id": record.id},
        )

    for record in sale_docs:
        rel = Path("vehicles") / vehicle_storage_key(record.vehicle_id) / "sale-documents" / record.stored_name
        add_entry(
            f"files/{rel.as_posix()}",
            storage_root / rel,
            {"type": "sale_document", "vehicle_id": record.vehicle_id, "stored_name": record.stored_name, "id": record.id},
        )

    for record in documents:
        rel = Path("vehiculos") / vehicle_storage_key(record.vehicle_id) / "documentos" / record.file_name
        add_entry(
            f"files/{rel.as_posix()}",
            storage_root / rel,
            {"type": "document", "vehicle_id": record.vehicle_id, "file_name": record.file_name, "id": record.id},
        )

    for record in photos:
        rel = Path("vehiculos") / vehicle_storage_key(record.vehicle_id) / "fotos" / record.file_name
        add_entry(
            f"files/{rel.as_posix()}",
            storage_root / rel,
            {"type": "photo", "vehicle_id": record.vehicle_id, "file_name": record.file_name, "id": record.id},
        )

    payload.sort(key=lambda entry: entry["export_path"])
    entries.sort(key=lambda entry: entry[0])
    return payload, entries, warnings


def _build_zip(
    manifest: dict[str, Any],
    data_json: bytes,
    file_entries: list[tuple[str, Path]],
    include_files: bool,
) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, indent=2))
        archive.writestr("data.json", data_json)
        if include_files:
            for export_path, source_path in file_entries:
                if not _is_safe_zip_path(export_path):
                    continue
                archive.write(source_path, export_path)
    return buffer.getvalue()


def _read_json_from_zip(archive: zipfile.ZipFile, name: str) -> dict[str, Any]:
    try:
        with archive.open(name) as handle:
            return json.loads(handle.read().decode("utf-8"))
    except KeyError as exc:
        raise HTTPException(status_code=422, detail=f"Falta {name} en el paquete") from exc
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"{name} invalido") from exc


def _vehicle_identity(vehicle: dict[str, Any]) -> tuple[str, str]:
    vin = (vehicle.get("vin") or "").strip()
    if vin:
        return ("vin", vin.upper())
    plate = normalize_plate(vehicle.get("license_plate", ""))
    purchase_date = str(vehicle.get("purchase_date") or "")
    return ("plate_purchase", f"{plate}:{purchase_date}")


def _find_existing_vehicle(session: Session, identity: tuple[str, str]):
    from main import Vehicle

    key, value = identity
    if key == "vin":
        return session.exec(select(Vehicle).where(Vehicle.vin == value)).first()
    if key == "plate_purchase":
        plate, purchase_date = value.split(":", 1)
        parsed_date = _parse_date(purchase_date)
        query = select(Vehicle).where(Vehicle.license_plate == plate)
        if parsed_date:
            query = query.where(Vehicle.purchase_date == parsed_date)
        return session.exec(query).first()
    return None


def _delete_vehicle_related(session: Session, license_plate: str) -> None:
    from main import (
        Document,
        Expense,
        Photo,
        Sale,
        SaleDocument,
        Transfer,
        VehicleEvent,
        VehicleExpense,
        VehicleFile,
        VehicleLink,
        VehicleVisit,
        VehicleStatusEvent,
    )

    for model in (
        VehicleExpense,
        Expense,
        SaleDocument,
        Sale,
        VehicleFile,
        VehicleLink,
        VehicleVisit,
        VehicleEvent,
        VehicleStatusEvent,
        Transfer,
        Document,
        Photo,
    ):
        records = session.exec(select(model).where(model.vehicle_id == license_plate)).all()
        for record in records:
            session.delete(record)
    session.commit()


def _remove_vehicle_storage(storage_root: Path, license_plate: str) -> None:
    safe_plate = vehicle_storage_key(license_plate)
    for folder in ("vehicles", "vehiculos"):
        path = storage_root / folder / safe_plate
        if path.exists():
            _remove_dir(path)


def _apply_vehicle_update(target, payload: dict[str, Any]) -> None:
    payload = payload.copy()
    payload.pop("id", None)
    payload.pop("license_plate", None)
    for key, value in payload.items():
        setattr(target, key, value)


def _generate_unique_plate(session: Session, base_plate: str) -> str:
    from main import Vehicle

    base = normalize_plate(base_plate)
    candidate = base
    suffix = 1
    while session.get(Vehicle, candidate):
        candidate = f"{base}-C{suffix}"
        suffix += 1
    return candidate


def _find_export_path(file_entries: list[dict[str, Any]], source_id: str) -> str | None:
    for entry in file_entries:
        if source_id and str(entry.get("id")) == source_id:
            return entry["export_path"]
    return None


def _import_file_from_zip(
    archive: zipfile.ZipFile,
    export_path: str,
    dest_dir: Path,
    file_name: str,
) -> str:
    if not _is_safe_zip_path(export_path):
        raise HTTPException(status_code=422, detail="Ruta de archivo invalida")
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe_name = _unique_file_name(dest_dir, Path(file_name).name)
    dest_path = dest_dir / safe_name
    try:
        with archive.open(export_path) as source, dest_path.open("wb") as target:
            target.write(source.read())
    except KeyError as exc:
        raise HTTPException(status_code=422, detail="Archivo faltante en el paquete") from exc
    return safe_name


def _import_document_from_zip(
    archive: zipfile.ZipFile,
    export_path: str,
    dest_dir: Path,
    file_name: str,
) -> Path:
    if not _is_safe_zip_path(export_path):
        raise HTTPException(status_code=422, detail="Ruta de archivo invalida")
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe_name = _unique_file_name(dest_dir, Path(file_name).name)
    dest_path = dest_dir / safe_name
    try:
        with archive.open(export_path) as source, dest_path.open("wb") as target:
            target.write(source.read())
    except KeyError as exc:
        raise HTTPException(status_code=422, detail="Archivo faltante en el paquete") from exc
    return dest_path


def _unique_file_name(dest_dir: Path, file_name: str) -> str:
    name = Path(file_name).stem
    ext = Path(file_name).suffix
    candidate = f"{name}{ext}"
    counter = 1
    while (dest_dir / candidate).exists():
        candidate = f"{name}_{counter}{ext}"
        counter += 1
    return candidate


def _is_safe_zip_path(path: str) -> bool:
    if ".." in Path(path).parts:
        return False
    return not Path(path).is_absolute()


def _model_dump(model: Any) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return dict(model)


def _sorted_dump(items: list[Any], key: str) -> list[dict[str, Any]]:
    def sort_key(item: Any):
        value = getattr(item, key, None)
        return "" if value is None else str(value)

    return [_model_dump(item) for item in sorted(items, key=sort_key)]


def _generate_package_id() -> str:
    return datetime.utcnow().strftime("%Y%m%d_%H%M%S") + "_" + uuid4().hex[:6]


def _resolve_storage_root() -> Path:
    return Path(os.getenv("STORAGE_ROOT", "storage")).resolve()


def _remove_dir(path: Path) -> None:
    for item in path.rglob("*"):
        if item.is_file():
            item.unlink(missing_ok=True)
    for item in sorted(path.rglob("*"), reverse=True):
        if item.is_dir():
            item.rmdir()
    if path.exists():
        path.rmdir()


def _database_url() -> str:
    return os.getenv("DATABASE_URL", "sqlite:///sahocars.db")


def _database_path() -> Path:
    url = _database_url()
    if url.startswith("sqlite:///"):
        return Path(url.replace("sqlite:///", "")).resolve()
    return Path("sahocars.db").resolve()
def _parse_date(value: str):
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        return None
