from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from fastapi import HTTPException
from sqlmodel import Session, select


def list_expenses(session: Session, vehicle_id: int):
    from main import Vehicle, VehicleExpense

    if not session.get(Vehicle, vehicle_id):
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    query = (
        select(VehicleExpense)
        .where(VehicleExpense.vehicle_id == vehicle_id)
        .order_by(VehicleExpense.date.desc(), VehicleExpense.created_at.desc())
    )
    return session.exec(query).all()


def create_expense(session: Session, vehicle_id: int, payload):
    from main import Vehicle, VehicleEventType, VehicleExpense, VehicleFile
    from services.vehicle_events_service import emit_event

    if not session.get(Vehicle, vehicle_id):
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    if payload.amount is None or payload.amount <= Decimal("0"):
        raise HTTPException(status_code=422, detail="El importe debe ser mayor que 0")
    if payload.linked_vehicle_file_id is not None:
        linked_file = session.get(VehicleFile, payload.linked_vehicle_file_id)
        if not linked_file or linked_file.vehicle_id != vehicle_id:
            raise HTTPException(status_code=404, detail="Archivo no encontrado")

    expense = VehicleExpense(
        vehicle_id=vehicle_id,
        amount=payload.amount,
        currency=payload.currency,
        date=payload.date,
        category=payload.category,
        vendor=payload.vendor,
        invoice_ref=payload.invoice_ref,
        payment_method=payload.payment_method,
        notes=payload.notes,
        linked_vehicle_file_id=payload.linked_vehicle_file_id,
    )
    session.add(expense)
    session.commit()
    session.refresh(expense)
    emit_event(
        session,
        vehicle_id,
        VehicleEventType.EXPENSE_CREATED,
        {
            "id": expense.id,
            "amount": float(expense.amount),
            "currency": expense.currency,
            "category": expense.category,
        },
    )
    return expense


def update_expense(session: Session, vehicle_id: int, expense_id: int, payload):
    from main import VehicleEventType, VehicleExpense, VehicleFile
    from services.vehicle_events_service import emit_event

    expense = session.get(VehicleExpense, expense_id)
    if not expense or expense.vehicle_id != vehicle_id:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    if payload.amount is not None and payload.amount <= Decimal("0"):
        raise HTTPException(status_code=422, detail="El importe debe ser mayor que 0")
    if payload.linked_vehicle_file_id is not None:
        linked_file = session.get(VehicleFile, payload.linked_vehicle_file_id)
        if not linked_file or linked_file.vehicle_id != vehicle_id:
            raise HTTPException(status_code=404, detail="Archivo no encontrado")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(expense, key, value)
    expense.updated_at = datetime.utcnow()
    session.add(expense)
    session.commit()
    session.refresh(expense)
    emit_event(
        session,
        vehicle_id,
        VehicleEventType.EXPENSE_UPDATED,
        {
            "id": expense.id,
            "amount": float(expense.amount),
            "currency": expense.currency,
            "category": expense.category,
        },
    )
    return expense


def delete_expense(session: Session, vehicle_id: int, expense_id: int):
    from main import VehicleEventType, VehicleExpense
    from services.vehicle_events_service import emit_event

    expense = session.get(VehicleExpense, expense_id)
    if not expense or expense.vehicle_id != vehicle_id:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    payload = {
        "id": expense.id,
        "amount": float(expense.amount),
        "currency": expense.currency,
        "category": expense.category,
    }
    session.delete(expense)
    session.commit()
    emit_event(session, vehicle_id, VehicleEventType.EXPENSE_DELETED, payload)
