from __future__ import annotations

from typing import Optional

from fastapi import HTTPException
from sqlmodel import Session, select


def emit_event(session: Session, vehicle_id: str, event_type, payload: dict, actor: Optional[str] = None):
    from main import VehicleEvent

    event = VehicleEvent(
        vehicle_id=vehicle_id,
        type=event_type,
        payload=payload,
        actor=actor,
    )
    session.add(event)
    session.commit()
    session.refresh(event)
    return event


def list_timeline(session: Session, vehicle_id: str, limit: int = 50, types: list | None = None):
    from main import Vehicle, VehicleEvent

    if not session.get(Vehicle, vehicle_id):
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")

    query = select(VehicleEvent).where(VehicleEvent.vehicle_id == vehicle_id)
    if types:
        query = query.where(VehicleEvent.type.in_(types))
    query = query.order_by(VehicleEvent.created_at.desc()).limit(limit)
    events = session.exec(query).all()
    return [
        {
            "id": event.id,
            "type": event.type,
            "created_at": event.created_at,
            "summary": _summary(event.type, event.payload),
            "payload": event.payload,
        }
        for event in events
    ]


def _summary(event_type, payload: dict) -> str:
    event_value = event_type.value if hasattr(event_type, "value") else str(event_type)
    if event_value == "STATUS_CHANGE":
        return f"Estado cambiado de {payload.get('from')} a {payload.get('to')}"
    if event_value == "EXPENSE_CREATED":
        amount = payload.get("amount")
        currency = payload.get("currency")
        return f"Gasto creado: {amount} {currency}".strip()
    if event_value == "EXPENSE_UPDATED":
        return "Gasto actualizado"
    if event_value == "EXPENSE_DELETED":
        return "Gasto eliminado"
    if event_value == "VISIT_CREATED":
        name = payload.get("name") or "-"
        return f"Visita creada: {name}"
    if event_value == "VISIT_DELETED":
        return "Visita eliminada"
    if event_value == "FILE_UPLOADED":
        return f"Archivo subido: {payload.get('name')}"
    if event_value == "FILE_DELETED":
        return f"Archivo eliminado: {payload.get('name')}"
    if event_value == "NOTE_CREATED":
        return "Nota creada"
    if event_value == "NOTE_DELETED":
        return "Nota eliminada"
    if event_value == "VEHICLE_UPDATED":
        return "Vehiculo actualizado"
    if event_value == "BRANCH_MOVED":
        from_branch = payload.get("from_branch_name") or payload.get("from_branch_id") or "-"
        to_branch = payload.get("to_branch_name") or payload.get("to_branch_id") or "-"
        return f"Sucursal cambiada de {from_branch} a {to_branch}"
    return "Evento"
