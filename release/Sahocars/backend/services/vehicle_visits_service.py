from __future__ import annotations

from fastapi import HTTPException
from sqlmodel import Session, select


def list_visits(session: Session, vehicle_id: str):
    from main import Vehicle, VehicleVisit

    if not session.get(Vehicle, vehicle_id):
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    query = (
        select(VehicleVisit)
        .where(VehicleVisit.vehicle_id == vehicle_id)
        .order_by(VehicleVisit.visit_date.desc(), VehicleVisit.created_at.desc())
    )
    return session.exec(query).all()


def create_visit(session: Session, vehicle_id: str, payload):
    from main import Vehicle, VehicleEventType, VehicleVisit
    from services.vehicle_events_service import emit_event

    if not session.get(Vehicle, vehicle_id):
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    if not payload.visit_date:
        raise HTTPException(status_code=422, detail="La fecha de visita es requerida")
    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=422, detail="El nombre es requerido")
    phone = (payload.phone or "").strip()
    email = (payload.email or "").strip()
    if not phone and not email:
        raise HTTPException(status_code=422, detail="Telefono o email es requerido")
    duration_minutes = payload.duration_minutes or 30
    if duration_minutes <= 0:
        raise HTTPException(status_code=422, detail="La duracion debe ser mayor que 0")
    timezone = (payload.timezone or "Europe/Madrid").strip() or "Europe/Madrid"

    visit = VehicleVisit(
        vehicle_id=vehicle_id,
        visit_date=payload.visit_date,
        name=payload.name.strip(),
        phone=phone or None,
        email=email or None,
        notes=payload.notes.strip() if payload.notes else None,
        scheduled_at=payload.scheduled_at,
        duration_minutes=duration_minutes,
        timezone=timezone,
        calendar_status="pending" if payload.scheduled_at else None,
    )
    session.add(visit)
    session.commit()
    session.refresh(visit)
    emit_event(
        session,
        vehicle_id,
        VehicleEventType.VISIT_CREATED,
        {
            "id": visit.id,
            "name": visit.name,
            "phone": visit.phone,
            "email": visit.email,
        },
    )
    return visit


def update_visit(session: Session, vehicle_id: str, visit_id: int, payload):
    from main import VehicleVisit

    visit = session.get(VehicleVisit, visit_id)
    if not visit or visit.vehicle_id != vehicle_id:
        raise HTTPException(status_code=404, detail="Visita no encontrada")

    update_data = payload.model_dump(exclude_unset=True)
    if "duration_minutes" in update_data and update_data["duration_minutes"] is not None:
        if update_data["duration_minutes"] <= 0:
            raise HTTPException(status_code=422, detail="La duracion debe ser mayor que 0")

    for key, value in update_data.items():
        setattr(visit, key, value)

    if "scheduled_at" in update_data or "duration_minutes" in update_data or "timezone" in update_data:
        if visit.scheduled_at:
            visit.calendar_status = "pending"
        else:
            visit.calendar_status = None
            visit.calendar_event_id = None
            visit.calendar_event_html_link = None
            visit.calendar_last_error = None
            visit.calendar_last_synced_at = None

    session.add(visit)
    session.commit()
    session.refresh(visit)
    return visit


def delete_visit(session: Session, vehicle_id: str, visit_id: int):
    from main import VehicleEventType, VehicleVisit
    from services.vehicle_events_service import emit_event

    visit = session.get(VehicleVisit, visit_id)
    if not visit or visit.vehicle_id != vehicle_id:
        raise HTTPException(status_code=404, detail="Visita no encontrada")
    payload = {
        "id": visit.id,
        "name": visit.name,
        "phone": visit.phone,
        "email": visit.email,
    }
    session.delete(visit)
    session.commit()
    emit_event(session, vehicle_id, VehicleEventType.VISIT_DELETED, payload)
