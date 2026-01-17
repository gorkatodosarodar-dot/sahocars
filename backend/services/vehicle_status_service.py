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
    from main import Vehicle, VehicleEventType
    from services.vehicle_events_service import emit_event

    vehicle = session.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")

    previous = vehicle.status
    vehicle.status = new_status
    vehicle.updated_at = datetime.utcnow()
    session.add(vehicle)
    session.commit()
    session.refresh(vehicle)
    payload = {
        "from": previous.value if hasattr(previous, "value") else previous,
        "to": new_status.value if hasattr(new_status, "value") else new_status,
        "note": note,
    }
    emit_event(session, vehicle_id, VehicleEventType.STATUS_CHANGE, payload, actor=actor)
    return vehicle
