from __future__ import annotations

from fastapi import HTTPException
from sqlmodel import Session, select


def list_visits(session: Session, vehicle_id: int):
    from main import Vehicle, VehicleVisit

    if not session.get(Vehicle, vehicle_id):
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    query = (
        select(VehicleVisit)
        .where(VehicleVisit.vehicle_id == vehicle_id)
        .order_by(VehicleVisit.visit_date.desc(), VehicleVisit.created_at.desc())
    )
    return session.exec(query).all()


def create_visit(session: Session, vehicle_id: int, payload):
    from main import Vehicle, VehicleVisit

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

    visit = VehicleVisit(
        vehicle_id=vehicle_id,
        visit_date=payload.visit_date,
        name=payload.name.strip(),
        phone=phone or None,
        email=email or None,
        notes=payload.notes.strip() if payload.notes else None,
    )
    session.add(visit)
    session.commit()
    session.refresh(visit)
    return visit


def delete_visit(session: Session, vehicle_id: int, visit_id: int):
    from main import VehicleVisit

    visit = session.get(VehicleVisit, visit_id)
    if not visit or visit.vehicle_id != vehicle_id:
        raise HTTPException(status_code=404, detail="Visita no encontrada")
    session.delete(visit)
    session.commit()
