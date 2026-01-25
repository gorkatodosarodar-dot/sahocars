from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import inspect, text
from sqlmodel import Session, select

from db import get_session
from models.vehicle import Vehicle, VehicleStatus
from schemas.vehicle import VehicleCreate, VehicleRead, VehicleUpdate

router = APIRouter(prefix="/vehicles", tags=["vehicles"])

_vehicle_has_id_column_cache: Optional[bool] = None


def _vehicle_has_id_column(session: Session) -> bool:
    global _vehicle_has_id_column_cache
    if _vehicle_has_id_column_cache is not None:
        return _vehicle_has_id_column_cache
    try:
        inspector = inspect(session.get_bind())
        columns = {column["name"] for column in inspector.get_columns("vehicle")}
        _vehicle_has_id_column_cache = "id" in columns
    except Exception:
        _vehicle_has_id_column_cache = False
    return _vehicle_has_id_column_cache


def _resolve_vehicle_identifier(session: Session, identifier: str) -> Vehicle | None:
    normalized = identifier.strip().upper()
    if not normalized:
        return None
    vehicle = session.get(Vehicle, normalized)
    if vehicle:
        return vehicle
    if not identifier.isdigit() or not _vehicle_has_id_column(session):
        return None
    try:
        row = session.exec(text("SELECT license_plate FROM vehicle WHERE id = :id"), {"id": int(identifier)}).first()
    except Exception:
        return None
    if not row:
        return None
    try:
        legacy_plate = row[0]
    except Exception:
        legacy_plate = row
    if not legacy_plate:
        return None
    return session.get(Vehicle, str(legacy_plate).strip().upper())


@router.post("", response_model=VehicleRead, status_code=201)
def create_vehicle(vehicle_data: VehicleCreate, session: Session = Depends(get_session)):
    payload = vehicle_data.model_dump(exclude_none=True)
    payload["license_plate"] = payload["license_plate"].strip().upper()
    if session.get(Vehicle, payload["license_plate"]):
        raise HTTPException(status_code=409, detail="La matricula ya existe")
    vehicle = Vehicle(**payload)
    session.add(vehicle)
    session.commit()
    session.refresh(vehicle)
    return vehicle


@router.get("", response_model=List[VehicleRead])
def list_vehicles(
    status: Optional[VehicleStatus] = Query(None),
    branch_id: Optional[int] = Query(None),
    from_date: Optional[date] = Query(None, description="filter by purchase date >="),
    to_date: Optional[date] = Query(None, description="filter by purchase date <="),
    session: Session = Depends(get_session),
):
    query = select(Vehicle)
    if status:
        query = query.where(Vehicle.status == status)
    if branch_id:
        query = query.where(Vehicle.branch_id == branch_id)
    if from_date:
        query = query.where(Vehicle.purchase_date >= from_date)
    if to_date:
        query = query.where(Vehicle.purchase_date <= to_date)
    query = query.order_by(Vehicle.created_at.desc())
    return session.exec(query).all()


@router.get("/{license_plate}", response_model=VehicleRead)
def get_vehicle(license_plate: str, session: Session = Depends(get_session)):
    vehicle = session.get(Vehicle, license_plate.strip().upper())
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    return vehicle


@router.patch("/{license_plate}", response_model=VehicleRead)
def update_vehicle(license_plate: str, data: VehicleUpdate, session: Session = Depends(get_session)):
    normalized_plate = license_plate.strip().upper()
    vehicle = session.get(Vehicle, normalized_plate)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    update_data = data.model_dump(exclude_unset=True)
    if "license_plate" in update_data and update_data["license_plate"].strip().upper() != normalized_plate:
        raise HTTPException(status_code=422, detail="La matricula no se puede modificar")
    update_data.pop("license_plate", None)
    update_data.pop("created_at", None)
    update_data.pop("updated_at", None)
    for key, value in update_data.items():
        setattr(vehicle, key, value)
    vehicle.updated_at = datetime.utcnow()
    session.add(vehicle)
    session.commit()
    session.refresh(vehicle)
    return vehicle


@router.delete("/{license_plate}")
def delete_vehicle(license_plate: str, session: Session = Depends(get_session)):
    vehicle = _resolve_vehicle_identifier(session, license_plate)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    session.delete(vehicle)
    session.commit()
    return {"status": "ok"}
