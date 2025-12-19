from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlmodel import SQLModel

from models.vehicle import VehicleStatus


class VehicleBase(SQLModel):
    vin: Optional[str] = None
    license_plate: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    version: Optional[str] = None
    year: Optional[int] = None
    km: Optional[int] = None
    color: Optional[str] = None
    branch_id: Optional[int] = None
    status: Optional[VehicleStatus] = None
    purchase_price: Optional[float] = None
    purchase_date: Optional[date] = None
    notes: Optional[str] = None


class VehicleCreate(VehicleBase):
    vin: str
    license_plate: str
    brand: str
    model: str
    year: int
    km: int
    branch_id: int
    status: VehicleStatus
    purchase_price: float
    purchase_date: date


class VehicleRead(VehicleBase):
    id: int
    sale_price: Optional[float] = None
    sale_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VehicleUpdate(VehicleBase):
    class Config:
        from_attributes = True
