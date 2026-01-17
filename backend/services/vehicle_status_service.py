from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlmodel import Session


def change_status(
    session: Session,
    vehicle_id: int,
    new_status,
    note: Optional[str] = None,
    actor: Optional[str] = None,
):
    from main import Vehicle

    vehicle = session.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")

    vehicle.status = new_status
    vehicle.updated_at = datetime.utcnow()
    session.add(vehicle)
    session.commit()
    session.refresh(vehicle)
    return vehicle
