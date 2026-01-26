from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column, Enum as SAEnum
from sqlmodel import Field, SQLModel


class VehicleStatus(str, Enum):
    INTAKE = "intake"
    PREP = "prep"
    READY = "ready"
    PUBLISHED = "published"
    RESERVED = "reserved"
    SOLD = "sold"
    DISCARDED = "discarded"


class Vehicle(SQLModel, table=True):
    __tablename__ = "vehicle"

    license_plate: str = Field(primary_key=True, index=True, sa_column_kwargs={"unique": True})
    vin: str = Field(index=True)
    brand: str
    model: str
    version: Optional[str] = None
    year: int
    km: int
    color: Optional[str] = None
    branch_id: int = Field(foreign_key="branch.id")
    status: VehicleStatus = Field(
        default=VehicleStatus.INTAKE,
        sa_column=Column(
            SAEnum(VehicleStatus, values_callable=lambda enums: [e.value for e in enums], native_enum=False)
        ),
    )
    status_changed_at: datetime = Field(default_factory=datetime.utcnow)
    status_reason: Optional[str] = None
    sold_at: Optional[date] = None
    reserved_until: Optional[date] = None
    purchase_date: date
    sale_price: Optional[float] = None
    published_price: Optional[float] = None
    target_margin_pct: Optional[float] = None
    sale_notes: Optional[str] = None
    sale_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
