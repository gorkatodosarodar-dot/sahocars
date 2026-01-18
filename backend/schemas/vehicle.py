from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlmodel import SQLModel

from models.vehicle import VehicleStatus


class VehicleCreate(SQLModel):
    vin: str
    license_plate: str
    brand: str
    model: str
    year: int
    km: int
    branch_id: int
    purchase_date: date
    version: Optional[str] = None
    color: Optional[str] = None
    status: Optional[VehicleStatus] = None
    notes: Optional[str] = None


class VehicleRead(SQLModel):
    id: int
    vin: str
    license_plate: str
    brand: str
    model: str
    year: int
    km: int
    branch_id: int
    purchase_date: date
    status: VehicleStatus
    version: Optional[str] = None
    color: Optional[str] = None
    notes: Optional[str] = None
    sale_price: Optional[float] = None
    sale_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VehicleUpdate(SQLModel):
    vin: Optional[str] = None
    license_plate: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    km: Optional[int] = None
    branch_id: Optional[int] = None
    purchase_date: Optional[date] = None
    version: Optional[str] = None
    color: Optional[str] = None
    status: Optional[VehicleStatus] = None
    notes: Optional[str] = None
    sale_price: Optional[float] = None
    sale_date: Optional[date] = None

    class Config:
        from_attributes = True
