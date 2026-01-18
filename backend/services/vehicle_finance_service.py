from __future__ import annotations

from datetime import date

from fastapi import HTTPException
from sqlmodel import Session, select


def get_vehicle_kpis(session: Session, vehicle_id: int):
    from main import Vehicle, VehicleExpense, VehicleExpenseCategory

    vehicle = session.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")

    expenses = session.exec(
        select(VehicleExpense.amount, VehicleExpense.category).where(VehicleExpense.vehicle_id == vehicle_id)
    ).all()
    purchase_total = 0.0
    other_total = 0.0
    for amount, category in expenses:
        if category == VehicleExpenseCategory.PURCHASE:
            purchase_total += float(amount)
        else:
            other_total += float(amount)
    total_expenses = purchase_total + other_total
    total_cost = total_expenses

    sale_price = float(vehicle.sale_price) if vehicle.sale_price is not None else None

    gross_margin = None
    if sale_price is not None and total_cost is not None:
        gross_margin = sale_price - total_cost

    roi = None
    if gross_margin is not None and total_cost and total_cost > 0:
        roi = gross_margin / total_cost

    days_in_stock = None
    if vehicle.purchase_date:
        days_in_stock = (date.today() - vehicle.purchase_date).days

    return {
        "vehicle_id": vehicle_id,
        "total_expenses": total_expenses,
        "total_cost": total_cost,
        "sale_price": sale_price,
        "gross_margin": gross_margin,
        "roi": roi,
        "days_in_stock": days_in_stock,
    }
