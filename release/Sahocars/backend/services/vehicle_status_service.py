from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from fastapi import HTTPException
from sqlmodel import Session


def change_status(
    session: Session,
    vehicle_id: str,
    new_status,
    note: Optional[str] = None,
    actor: Optional[str] = None,
    reserved_until: Optional[date] = None,
    sold_at: Optional[date] = None,
):
    from main import Vehicle, VehicleEventType, VehicleStatus, VehicleStatusEvent
    from services.vehicle_events_service import emit_event

    vehicle = session.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")

    previous = vehicle.status or VehicleStatus.INTAKE
    if new_status == previous:
        raise HTTPException(status_code=400, detail="El vehiculo ya tiene ese estado")
    if is_terminal_status(previous):
        raise HTTPException(status_code=400, detail="El estado actual es terminal y no admite cambios")
    allowed = _allowed_transitions(previous)
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Transicion invalida: {previous} -> {new_status}",
        )

    now = datetime.utcnow()
    vehicle.status = new_status
    vehicle.status_changed_at = now
    vehicle.status_reason = note
    if new_status == VehicleStatus.RESERVED:
        if reserved_until is not None:
            vehicle.reserved_until = reserved_until
    else:
        vehicle.reserved_until = None
    if new_status == VehicleStatus.SOLD:
        if sold_at is not None:
            vehicle.sold_at = sold_at
        elif vehicle.sale_date:
            vehicle.sold_at = vehicle.sale_date
    else:
        vehicle.sold_at = None
    vehicle.updated_at = now
    session.add(vehicle)
    session.commit()
    session.refresh(vehicle)
    status_event = VehicleStatusEvent(
        vehicle_id=vehicle_id,
        from_status=previous,
        to_status=new_status,
        changed_at=now,
        note=note,
        actor=actor or "local_user",
    )
    session.add(status_event)
    session.commit()
    payload = {
        "from": previous.value if hasattr(previous, "value") else previous,
        "to": new_status.value if hasattr(new_status, "value") else new_status,
        "note": note,
    }
    emit_event(session, vehicle_id, VehicleEventType.STATUS_CHANGE, payload, actor=actor)
    session.refresh(vehicle)
    return vehicle


def list_status_events(session: Session, vehicle_id: str, limit: int = 50):
    from main import Vehicle, VehicleStatusEvent
    from sqlmodel import select

    if not session.get(Vehicle, vehicle_id):
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    query = (
        select(VehicleStatusEvent)
        .where(VehicleStatusEvent.vehicle_id == vehicle_id)
        .order_by(VehicleStatusEvent.changed_at.desc())
        .limit(limit)
    )
    events = session.exec(query).all()
    return [
        {
            "id": event.id,
            "vehicle_id": event.vehicle_id,
            "from_status": event.from_status,
            "to_status": event.to_status,
            "changed_at": event.changed_at,
            "note": event.note,
            "actor": event.actor,
        }
        for event in events
    ]


def _allowed_transitions(status):
    from main import VehicleStatus

    if isinstance(status, str):
        try:
            status = VehicleStatus(status)
        except ValueError:
            return set()

    return {
        VehicleStatus.INTAKE: {VehicleStatus.PREP, VehicleStatus.READY, VehicleStatus.DISCARDED},
        VehicleStatus.PREP: {VehicleStatus.READY, VehicleStatus.DISCARDED},
        VehicleStatus.READY: {VehicleStatus.PUBLISHED, VehicleStatus.DISCARDED},
        VehicleStatus.PUBLISHED: {VehicleStatus.RESERVED, VehicleStatus.SOLD, VehicleStatus.DISCARDED, VehicleStatus.READY},
        VehicleStatus.RESERVED: {VehicleStatus.SOLD, VehicleStatus.PUBLISHED, VehicleStatus.DISCARDED},
        VehicleStatus.SOLD: set(),
        VehicleStatus.DISCARDED: set(),
    }.get(status, set())


def is_terminal_status(status) -> bool:
    from main import VehicleStatus

    if isinstance(status, str):
        try:
            status = VehicleStatus(status)
        except ValueError:
            return False
    return status in {VehicleStatus.SOLD, VehicleStatus.DISCARDED}
