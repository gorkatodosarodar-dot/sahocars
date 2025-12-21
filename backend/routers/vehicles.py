from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from db import get_session
from models.vehicle import Vehicle, VehicleStatus
from schemas.vehicle import VehicleCreate, VehicleRead, VehicleUpdate

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@router.post("", response_model=VehicleRead, status_code=201)
def create_vehicle(vehicle_data: VehicleCreate, session: Session = Depends(get_session)):
    vehicle = Vehicle(**vehicle_data.model_dump(exclude_none=True))
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


@router.get("/{vehicle_id}", response_model=VehicleRead)
def get_vehicle(vehicle_id: int, session: Session = Depends(get_session)):
    vehicle = session.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    return vehicle


@router.patch("/{vehicle_id}", response_model=VehicleRead)
def update_vehicle(vehicle_id: int, data: VehicleUpdate, session: Session = Depends(get_session)):
    vehicle = session.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    update_data = data.model_dump(exclude_unset=True)
    update_data.pop("id", None)
    update_data.pop("created_at", None)
    update_data.pop("updated_at", None)
    for key, value in update_data.items():
        setattr(vehicle, key, value)
    vehicle.updated_at = datetime.utcnow()
    session.add(vehicle)
    session.commit()
    session.refresh(vehicle)
    return vehicle
