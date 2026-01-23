from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from db import get_session
from services.reporting_service import breakdown_by_branch, compute_kpis, list_vehicle_report_rows

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/kpis")
def report_kpis(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    branch_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    vehicle_id: Optional[str] = Query(None),
    session: Session = Depends(get_session),
):
    filters = {
        "date_from": from_date,
        "date_to": to_date,
        "branch_id": branch_id,
        "status": status,
        "vehicle_id": vehicle_id,
    }
    return compute_kpis(session, filters)


@router.get("/vehicles")
def report_vehicles(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    branch_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    vehicle_id: Optional[str] = Query(None),
    session: Session = Depends(get_session),
):
    filters = {
        "date_from": from_date,
        "date_to": to_date,
        "branch_id": branch_id,
        "status": status,
        "vehicle_id": vehicle_id,
    }
    return list_vehicle_report_rows(session, filters)


@router.get("/by-branch")
def report_by_branch(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    branch_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    vehicle_id: Optional[str] = Query(None),
    session: Session = Depends(get_session),
):
    filters = {
        "date_from": from_date,
        "date_to": to_date,
        "branch_id": branch_id,
        "status": status,
        "vehicle_id": vehicle_id,
    }
    return breakdown_by_branch(session, filters)
