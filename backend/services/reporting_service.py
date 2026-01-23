from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlmodel import Session, select


def compute_kpis(session: Session, filters: dict[str, Any]) -> dict[str, Any]:
    from main import Vehicle, VehicleExpense, VehicleExpenseCategory, VehicleStatus

    status = _coerce_status(filters.get("status"))
    vehicle_id = _normalize_vehicle_id(filters.get("vehicle_id"))
    date_from = filters.get("date_from")
    date_to = filters.get("date_to")
    branch_id = filters.get("branch_id")

    vehicles_total = _count_vehicles(session, Vehicle, branch_id, status, vehicle_id)
    if status is not None and status != VehicleStatus.PUBLISHED:
        vehicles_published = 0
    else:
        vehicles_published = _count_vehicles(
            session, Vehicle, branch_id, VehicleStatus.PUBLISHED, vehicle_id
        )
    vehicles_in_stock = _count_vehicles(
        session,
        Vehicle,
        branch_id,
        status,
        vehicle_id,
        exclude_statuses=(VehicleStatus.SOLD, VehicleStatus.DISCARDED),
    )

    sold_vehicle_ids = _sold_vehicle_ids(
        session, Vehicle, branch_id, status, vehicle_id, date_from=date_from, date_to=date_to
    )
    vehicles_sold = len(sold_vehicle_ids)

    total_income = _sum_sales(session, Vehicle, sold_vehicle_ids)
    total_purchase = _sum_expenses(
        session,
        VehicleExpense,
        sold_vehicle_ids,
        category=VehicleExpenseCategory.PURCHASE,
        date_from=None,
        date_to=None,
    )
    total_expenses = _sum_expenses(
        session,
        VehicleExpense,
        sold_vehicle_ids=None,
        category=VehicleExpenseCategory.PURCHASE,
        date_from=date_from,
        date_to=date_to,
        exclude_category=True,
        branch_id=branch_id,
        status=status,
        vehicle_id=vehicle_id,
    )

    total_profit = total_income - total_purchase - total_expenses
    avg_profit_per_sold = total_profit / vehicles_sold if vehicles_sold else None

    avg_margin_pct = _avg_margin_pct(
        session,
        Vehicle,
        VehicleExpense,
        sold_vehicle_ids,
        date_from=date_from,
        date_to=date_to,
    )
    avg_days_to_sell = _avg_days_to_sell(
        session, Vehicle, sold_vehicle_ids, date_from=date_from, date_to=date_to
    )
    avg_days_in_stock = _avg_days_in_stock(
        session,
        Vehicle,
        branch_id=branch_id,
        status=status,
        vehicle_id=vehicle_id,
        excluded_statuses=(VehicleStatus.SOLD, VehicleStatus.DISCARDED),
    )

    return {
        "filters": {
            "from": date_from.isoformat() if date_from else None,
            "to": date_to.isoformat() if date_to else None,
            "branch_id": branch_id,
            "status": status.value if status else None,
            "vehicle_id": vehicle_id,
        },
        "vehicles_total": vehicles_total,
        "vehicles_sold": vehicles_sold,
        "vehicles_published": vehicles_published,
        "vehicles_in_stock": vehicles_in_stock,
        "total_income": total_income,
        "total_purchase": total_purchase,
        "total_expenses": total_expenses,
        "total_profit": total_profit,
        "avg_profit_per_sold": avg_profit_per_sold,
        "avg_margin_pct": avg_margin_pct,
        "avg_days_to_sell": avg_days_to_sell,
        "avg_days_in_stock": avg_days_in_stock,
    }


def list_vehicle_report_rows(session: Session, filters: dict[str, Any]) -> list[dict[str, Any]]:
    from main import Branch, Vehicle, VehicleExpense, VehicleExpenseCategory, VehicleStatus

    status = _coerce_status(filters.get("status"))
    vehicle_id = _normalize_vehicle_id(filters.get("vehicle_id"))
    date_from = filters.get("date_from")
    date_to = filters.get("date_to")
    branch_id = filters.get("branch_id")

    purchase_sub = (
        select(
            VehicleExpense.vehicle_id,
            func.coalesce(func.sum(VehicleExpense.amount), 0).label("purchase_total"),
        )
        .where(VehicleExpense.category == VehicleExpenseCategory.PURCHASE)
        .group_by(VehicleExpense.vehicle_id)
        .subquery()
    )

    other_expenses_sub = (
        select(
            VehicleExpense.vehicle_id,
            func.coalesce(func.sum(VehicleExpense.amount), 0).label("other_total"),
        )
        .where(VehicleExpense.category != VehicleExpenseCategory.PURCHASE)
        .group_by(VehicleExpense.vehicle_id)
    )
    if date_from:
        other_expenses_sub = other_expenses_sub.where(VehicleExpense.date >= date_from)
    if date_to:
        other_expenses_sub = other_expenses_sub.where(VehicleExpense.date <= date_to)
    other_expenses_sub = other_expenses_sub.subquery()

    stmt = (
        select(
            Vehicle.license_plate,
            Vehicle.brand,
            Vehicle.model,
            Vehicle.version,
            Vehicle.branch_id,
            Branch.name.label("branch_name"),
            Vehicle.status,
            Vehicle.purchase_date,
            Vehicle.created_at,
            Vehicle.sale_price,
            Vehicle.sold_at,
            func.coalesce(purchase_sub.c.purchase_total, 0).label("purchase_total"),
            func.coalesce(other_expenses_sub.c.other_total, 0).label("other_total"),
        )
        .select_from(Vehicle)
        .outerjoin(Branch, Branch.id == Vehicle.branch_id)
        .outerjoin(purchase_sub, purchase_sub.c.vehicle_id == Vehicle.license_plate)
        .outerjoin(other_expenses_sub, other_expenses_sub.c.vehicle_id == Vehicle.license_plate)
    )

    if branch_id is not None:
        stmt = stmt.where(Vehicle.branch_id == branch_id)
    if status is not None:
        stmt = stmt.where(Vehicle.status == status)
    if vehicle_id:
        stmt = stmt.where(Vehicle.license_plate == vehicle_id)
    if date_from:
        stmt = stmt.where(Vehicle.sold_at >= date_from)
    if date_to:
        stmt = stmt.where(Vehicle.sold_at <= date_to)

    stmt = stmt.order_by(Vehicle.license_plate)
    rows = session.exec(stmt).all()

    today = date.today()
    results = []
    for row in rows:
        (
            plate,
            brand,
            model,
            version,
            branch_id,
            branch_name,
            status_value,
            purchase_date,
            created_at,
            sale_price,
            sold_at,
            purchase_total,
            other_total,
        ) = row

        purchase_total = float(purchase_total or 0)
        other_total = float(other_total or 0)
        sale_price_value = float(sale_price) if sale_price is not None else None

        profit = None
        margin_pct = None
        if sale_price_value is not None:
            profit = sale_price_value - purchase_total - other_total
            if sale_price_value > 0:
                margin_pct = profit / sale_price_value

        start_date = purchase_date or (created_at.date() if created_at else None)
        end_date = sold_at or today
        days_in_stock = (end_date - start_date).days if start_date else None

        title_parts = " ".join([part for part in [brand, model, version] if part])
        title = title_parts if title_parts else plate
        if plate and plate not in title:
            title = f"{title} ({plate})" if title else plate

        results.append(
            {
                "vehicle_id": plate,
                "title": title,
                "branch_id": branch_id,
                "branch": branch_name,
                "status": status_value.value if isinstance(status_value, VehicleStatus) else status_value,
                "purchase_price": purchase_total,
                "total_expenses": other_total,
                "sale_price": sale_price_value,
                "sold_at": sold_at.isoformat() if sold_at else None,
                "profit": profit,
                "margin_pct": margin_pct,
                "days_in_stock": days_in_stock,
            }
        )

    return results


def breakdown_by_branch(session: Session, filters: dict[str, Any]) -> list[dict[str, Any]]:
    from main import Branch, Vehicle, VehicleExpense, VehicleExpenseCategory, VehicleStatus

    status = _coerce_status(filters.get("status"))
    vehicle_id = _normalize_vehicle_id(filters.get("vehicle_id"))
    date_from = filters.get("date_from")
    date_to = filters.get("date_to")
    branch_id = filters.get("branch_id")

    sold_stmt = select(
        Vehicle.license_plate.label("vehicle_id"),
        Vehicle.branch_id.label("branch_id"),
        Vehicle.sale_price.label("sale_price"),
    ).where(Vehicle.status == VehicleStatus.SOLD)

    if branch_id is not None:
        sold_stmt = sold_stmt.where(Vehicle.branch_id == branch_id)
    if status is not None:
        sold_stmt = sold_stmt.where(Vehicle.status == status)
    if vehicle_id:
        sold_stmt = sold_stmt.where(Vehicle.license_plate == vehicle_id)
    if date_from:
        sold_stmt = sold_stmt.where(Vehicle.sold_at >= date_from)
    if date_to:
        sold_stmt = sold_stmt.where(Vehicle.sold_at <= date_to)

    sold_sub = sold_stmt.subquery()

    purchase_sub = (
        select(
            VehicleExpense.vehicle_id,
            func.coalesce(func.sum(VehicleExpense.amount), 0).label("purchase_total"),
        )
        .where(VehicleExpense.category == VehicleExpenseCategory.PURCHASE)
        .group_by(VehicleExpense.vehicle_id)
        .subquery()
    )

    other_sub = (
        select(
            VehicleExpense.vehicle_id,
            func.coalesce(func.sum(VehicleExpense.amount), 0).label("other_total"),
        )
        .where(VehicleExpense.category != VehicleExpenseCategory.PURCHASE)
        .group_by(VehicleExpense.vehicle_id)
    )
    if date_from:
        other_sub = other_sub.where(VehicleExpense.date >= date_from)
    if date_to:
        other_sub = other_sub.where(VehicleExpense.date <= date_to)
    other_sub = other_sub.subquery()

    stmt = (
        select(
            sold_sub.c.branch_id,
            func.count(sold_sub.c.vehicle_id).label("sold"),
            func.coalesce(func.sum(sold_sub.c.sale_price), 0).label("income"),
            func.coalesce(func.sum(purchase_sub.c.purchase_total), 0).label("purchase_total"),
            func.coalesce(func.sum(other_sub.c.other_total), 0).label("other_total"),
        )
        .select_from(sold_sub)
        .outerjoin(purchase_sub, purchase_sub.c.vehicle_id == sold_sub.c.vehicle_id)
        .outerjoin(other_sub, other_sub.c.vehicle_id == sold_sub.c.vehicle_id)
        .group_by(sold_sub.c.branch_id)
    )

    branch_map = {
        branch.id: branch.name
        for branch in session.exec(select(Branch)).all()
    }

    results = []
    for branch_id_value, sold, income, purchase_total, other_total in session.exec(stmt).all():
        income_value = float(income or 0)
        purchase_value = float(purchase_total or 0)
        other_value = float(other_total or 0)
        results.append(
            {
                "branch_id": branch_id_value,
                "branch_name": branch_map.get(branch_id_value, ""),
                "sold": int(sold or 0),
                "income": income_value,
                "profit": income_value - purchase_value - other_value,
            }
        )
    return results


def _coerce_status(status: str | None):
    if status is None:
        return None
    from main import VehicleStatus

    try:
        return VehicleStatus(status)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Estado invalido") from exc


def _normalize_vehicle_id(value: str | None) -> str | None:
    if not value:
        return None
    return value.strip().upper()


def _count_vehicles(
    session: Session,
    Vehicle,
    branch_id: int | None,
    status,
    vehicle_id: str | None,
    exclude_statuses: tuple | None = None,
) -> int:
    stmt = select(func.count()).select_from(Vehicle)
    if branch_id is not None:
        stmt = stmt.where(Vehicle.branch_id == branch_id)
    if status is not None:
        stmt = stmt.where(Vehicle.status == status)
    if vehicle_id:
        stmt = stmt.where(Vehicle.license_plate == vehicle_id)
    if exclude_statuses:
        stmt = stmt.where(Vehicle.status.not_in(exclude_statuses))
    return int(session.exec(stmt).one() or 0)


def _sold_vehicle_ids(
    session: Session,
    Vehicle,
    branch_id: int | None,
    status,
    vehicle_id: str | None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[str]:
    from main import VehicleStatus

    stmt = select(Vehicle.license_plate).where(Vehicle.status == VehicleStatus.SOLD)
    if branch_id is not None:
        stmt = stmt.where(Vehicle.branch_id == branch_id)
    if status is not None:
        stmt = stmt.where(Vehicle.status == status)
    if vehicle_id:
        stmt = stmt.where(Vehicle.license_plate == vehicle_id)
    if date_from:
        stmt = stmt.where(Vehicle.sold_at >= date_from)
    if date_to:
        stmt = stmt.where(Vehicle.sold_at <= date_to)
    return [value for value in session.exec(stmt).all()]


def _sum_sales(session: Session, Vehicle, sold_vehicle_ids: list[str]) -> float:
    if not sold_vehicle_ids:
        return 0.0
    stmt = select(func.coalesce(func.sum(Vehicle.sale_price), 0)).where(
        Vehicle.license_plate.in_(sold_vehicle_ids)
    )
    return float(session.exec(stmt).one() or 0)


def _sum_expenses(
    session: Session,
    VehicleExpense,
    sold_vehicle_ids: list[str] | None,
    category=None,
    date_from: date | None = None,
    date_to: date | None = None,
    exclude_category: bool = False,
    branch_id: int | None = None,
    status=None,
    vehicle_id: str | None = None,
) -> float:
    from main import Vehicle

    stmt = select(func.coalesce(func.sum(VehicleExpense.amount), 0))
    if sold_vehicle_ids is not None:
        if not sold_vehicle_ids:
            return 0.0
        stmt = stmt.where(VehicleExpense.vehicle_id.in_(sold_vehicle_ids))
    else:
        stmt = stmt.join(Vehicle, Vehicle.license_plate == VehicleExpense.vehicle_id)
        if branch_id is not None:
            stmt = stmt.where(Vehicle.branch_id == branch_id)
        if status is not None:
            stmt = stmt.where(Vehicle.status == status)
        if vehicle_id:
            stmt = stmt.where(Vehicle.license_plate == vehicle_id)

    if category is not None:
        if exclude_category:
            stmt = stmt.where(VehicleExpense.category != category)
        else:
            stmt = stmt.where(VehicleExpense.category == category)

    if date_from:
        stmt = stmt.where(VehicleExpense.date >= date_from)
    if date_to:
        stmt = stmt.where(VehicleExpense.date <= date_to)

    return float(session.exec(stmt).one() or 0)


def _avg_margin_pct(
    session: Session,
    Vehicle,
    VehicleExpense,
    sold_vehicle_ids: list[str],
    date_from: date | None = None,
    date_to: date | None = None,
) -> float | None:
    if not sold_vehicle_ids:
        return None
    from main import VehicleExpenseCategory

    purchase_sub = (
        select(
            VehicleExpense.vehicle_id,
            func.coalesce(func.sum(VehicleExpense.amount), 0).label("purchase_total"),
        )
        .where(VehicleExpense.category == VehicleExpenseCategory.PURCHASE)
        .group_by(VehicleExpense.vehicle_id)
        .subquery()
    )

    other_sub = (
        select(
            VehicleExpense.vehicle_id,
            func.coalesce(func.sum(VehicleExpense.amount), 0).label("other_total"),
        )
        .where(VehicleExpense.category != VehicleExpenseCategory.PURCHASE)
        .group_by(VehicleExpense.vehicle_id)
    )
    if date_from:
        other_sub = other_sub.where(VehicleExpense.date >= date_from)
    if date_to:
        other_sub = other_sub.where(VehicleExpense.date <= date_to)
    other_sub = other_sub.subquery()

    profit_expr = Vehicle.sale_price - func.coalesce(purchase_sub.c.purchase_total, 0) - func.coalesce(
        other_sub.c.other_total, 0
    )
    margin_expr = profit_expr / Vehicle.sale_price

    stmt = (
        select(func.avg(margin_expr))
        .select_from(Vehicle)
        .outerjoin(purchase_sub, purchase_sub.c.vehicle_id == Vehicle.license_plate)
        .outerjoin(other_sub, other_sub.c.vehicle_id == Vehicle.license_plate)
        .where(Vehicle.license_plate.in_(sold_vehicle_ids))
        .where(Vehicle.sale_price.is_not(None))
        .where(Vehicle.sale_price > 0)
    )

    value = session.exec(stmt).one()
    return float(value) if value is not None else None


def _avg_days_to_sell(
    session: Session,
    Vehicle,
    sold_vehicle_ids: list[str],
    date_from: date | None = None,
    date_to: date | None = None,
) -> float | None:
    if not sold_vehicle_ids:
        return None
    sold_stmt = select(
        func.avg(
            func.julianday(Vehicle.sold_at)
            - func.julianday(func.coalesce(Vehicle.purchase_date, func.date(Vehicle.created_at)))
        )
    ).where(Vehicle.license_plate.in_(sold_vehicle_ids))
    if date_from:
        sold_stmt = sold_stmt.where(Vehicle.sold_at >= date_from)
    if date_to:
        sold_stmt = sold_stmt.where(Vehicle.sold_at <= date_to)
    value = session.exec(sold_stmt).one()
    return float(value) if value is not None else None


def _avg_days_in_stock(
    session: Session,
    Vehicle,
    branch_id: int | None,
    status,
    vehicle_id: str | None,
    excluded_statuses: tuple,
) -> float | None:
    stmt = select(
        func.avg(
            func.julianday(func.current_date())
            - func.julianday(func.coalesce(Vehicle.purchase_date, func.date(Vehicle.created_at)))
        )
    ).where(Vehicle.status.not_in(excluded_statuses))
    if branch_id is not None:
        stmt = stmt.where(Vehicle.branch_id == branch_id)
    if status is not None:
        stmt = stmt.where(Vehicle.status == status)
    if vehicle_id:
        stmt = stmt.where(Vehicle.license_plate == vehicle_id)
    value = session.exec(stmt).one()
    return float(value) if value is not None else None
