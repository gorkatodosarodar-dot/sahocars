from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class VehicleStatus(str, Enum):
    PENDING = "pendiente recepcion"
    REVIEW = "en revision"
    SHOWROOM = "en exposicion"
    RESERVED = "reservado"
    SOLD = "vendido"


class Vehicle(SQLModel, table=True):
    __tablename__ = "vehicle"

    id: Optional[int] = Field(default=None, primary_key=True)
    vin: str = Field(index=True)
    license_plate: str = Field(index=True)
    brand: str
    model: str
    version: Optional[str] = None
    year: int
    km: int
    color: Optional[str] = None
    branch_id: int = Field(foreign_key="branch.id")
    status: VehicleStatus = Field(default=VehicleStatus.PENDING)
    purchase_price: float
    purchase_date: date
    sale_price: Optional[float] = None
    sale_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
