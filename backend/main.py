from __future__ import annotations

import os
import shutil
import sqlite3
from uuid import uuid4
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse
from sqlalchemy import Column, Enum as SAEnum, JSON, inspect, text, update
from sqlmodel import Field, Session, SQLModel, create_engine, select
from services.vehicle_expenses_service import (
    create_expense as create_vehicle_expense_service,
    delete_expense as delete_vehicle_expense_service,
    list_expenses as list_vehicle_expenses_service,
    update_expense as update_vehicle_expense_service,
)
from services.vehicle_events_service import emit_event, list_timeline
from services.vehicle_finance_service import compute_vehicle_financials, get_vehicle_kpis
from services.vehicle_status_service import change_status, list_status_events
from services.vehicle_visits_service import create_visit, delete_visit, list_visits, update_visit
from services.backup_service import _get_schema_version
from services.google_calendar_service import create_or_update_event
from routers.admin_backup import router as admin_backup_router
from routers.admin_vehicle_transfer import router as admin_vehicle_transfer_router
from routers.reports import router as reports_router
from routers.google_auth import router as google_auth_router
from app.config import get_app_branch, get_app_commit, get_app_version, get_database_url, get_env
from app.logging_setup import setup_logging
from app.migrations import run_migrations
from app.paths import get_backups_dir, get_data_dir, get_db_path, get_logs_dir, get_storage_dir, migrate_legacy_data

DATABASE_URL = get_database_url()
STORAGE_ROOT = get_storage_dir()
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "20"))
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
ALLOWED_PHOTO_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


class Branch(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str


class VehicleStatus(str, Enum):
    INTAKE = "intake"
    PREP = "prep"
    READY = "ready"
    PUBLISHED = "published"
    RESERVED = "reserved"
    SOLD = "sold"
    DISCARDED = "discarded"


class Vehicle(SQLModel, table=True):
    license_plate: str = Field(primary_key=True, index=True, sa_column_kwargs={"unique": True})
    vin: Optional[str] = Field(default=None, index=True)
    brand: Optional[str] = None
    model: Optional[str] = None
    version: Optional[str] = None
    year: Optional[int] = None
    km: Optional[int] = None
    color: Optional[str] = None
    branch_id: int = Field(foreign_key="branch.id")
    status: VehicleStatus = Field(
        default=VehicleStatus.INTAKE,
        sa_column=Column(
            SAEnum(VehicleStatus, values_callable=lambda enums: [e.value for e in enums], native_enum=False)
        ),
    )
    status_changed_at: datetime = Field(default_factory=datetime.utcnow)
    status_reason: Optional[str] = None
    sold_at: Optional[date] = None
    reserved_until: Optional[date] = None
    sale_price: Optional[float] = None
    published_price: Optional[float] = None
    target_margin_pct: Optional[float] = None
    sale_notes: Optional[str] = None
    purchase_date: Optional[date] = None
    sale_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Expense(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    vehicle_id: str = Field(foreign_key="vehicle.license_plate")
    concept: str
    amount: float
    expense_date: date
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class VehicleExpenseCategory(str, Enum):
    PURCHASE = "PURCHASE"
    MECHANICAL = "MECHANICAL"
    TIRES = "TIRES"
    TRANSPORT = "TRANSPORT"
    ADMIN = "ADMIN"
    CLEANING = "CLEANING"
    OTHER = "OTHER"


class VehicleExpense(SQLModel, table=True):
    __tablename__ = "vehicle_expenses"

    id: Optional[int] = Field(default=None, primary_key=True)
    vehicle_id: str = Field(foreign_key="vehicle.license_plate")
    amount: Decimal
    currency: str = Field(default="EUR")
    date: date
    category: VehicleExpenseCategory
    vendor: Optional[str] = None
    invoice_ref: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    linked_vehicle_file_id: Optional[int] = Field(default=None, foreign_key="vehiclefile.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Sale(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    vehicle_id: str = Field(foreign_key="vehicle.license_plate", sa_column_kwargs={"unique": True})
    sale_price: float
    sale_date: date
    notes: Optional[str] = None
    client_name: Optional[str] = None
    client_tax_id: Optional[str] = None
    client_phone: Optional[str] = None
    client_email: Optional[str] = None
    client_address: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    vehicle_id: str = Field(foreign_key="vehicle.license_plate")
    doc_type: str
    file_name: str
    stored_path: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = None


class Photo(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    vehicle_id: str = Field(foreign_key="vehicle.license_plate")
    file_name: str
    stored_path: str
    display_order: Optional[int] = None
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)


class SaleDocument(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    vehicle_id: str = Field(foreign_key="vehicle.license_plate")
    sale_id: Optional[int] = Field(default=None, foreign_key="sale.id")
    original_name: str
    stored_name: str
    mime_type: str
    size_bytes: int
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class VehicleFile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    vehicle_id: str = Field(foreign_key="vehicle.license_plate")
    category: str
    original_name: str
    stored_name: str
    mime_type: str
    size_bytes: int
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class VehicleLink(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    vehicle_id: str = Field(foreign_key="vehicle.license_plate")
    title: Optional[str] = None
    url: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class VehicleVisit(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    vehicle_id: str = Field(foreign_key="vehicle.license_plate")
    visit_date: date
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: int = 30
    calendar_event_id: Optional[str] = None
    calendar_event_html_link: Optional[str] = None
    calendar_status: Optional[str] = None
    calendar_last_error: Optional[str] = None
    calendar_last_synced_at: Optional[datetime] = None
    timezone: str = "Europe/Madrid"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class GoogleToken(SQLModel, table=True):
    __tablename__ = "google_tokens"

    id: Optional[int] = Field(default=None, primary_key=True)
    access_token: str
    refresh_token: Optional[str] = None
    expiry: Optional[datetime] = None
    scopes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class VehicleEventType(str, Enum):
    STATUS_CHANGE = "STATUS_CHANGE"
    EXPENSE_CREATED = "EXPENSE_CREATED"
    EXPENSE_UPDATED = "EXPENSE_UPDATED"
    EXPENSE_DELETED = "EXPENSE_DELETED"
    VISIT_CREATED = "VISIT_CREATED"
    VISIT_DELETED = "VISIT_DELETED"
    FILE_UPLOADED = "FILE_UPLOADED"
    FILE_DELETED = "FILE_DELETED"
    NOTE_CREATED = "NOTE_CREATED"
    NOTE_DELETED = "NOTE_DELETED"
    VEHICLE_UPDATED = "VEHICLE_UPDATED"
    BRANCH_MOVED = "BRANCH_MOVED"


class VehicleEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    vehicle_id: str = Field(foreign_key="vehicle.license_plate")
    type: VehicleEventType
    payload: dict = Field(default_factory=dict, sa_column=Column(JSON))
    actor: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class VehicleStatusEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    vehicle_id: str = Field(foreign_key="vehicle.license_plate")
    from_status: VehicleStatus = Field(
        sa_column=Column(
            SAEnum(VehicleStatus, values_callable=lambda enums: [e.value for e in enums], native_enum=False)
        )
    )
    to_status: VehicleStatus = Field(
        sa_column=Column(
            SAEnum(VehicleStatus, values_callable=lambda enums: [e.value for e in enums], native_enum=False)
        )
    )
    changed_at: datetime = Field(default_factory=datetime.utcnow)
    note: Optional[str] = None
    actor: Optional[str] = None


class VehicleLinkCreate(SQLModel):
    title: Optional[str] = None
    url: str


class VehicleDetailOut(SQLModel):
    vin: Optional[str] = None
    license_plate: str
    brand: Optional[str] = None
    model: Optional[str] = None
    version: Optional[str] = None
    year: Optional[int] = None
    km: Optional[int] = None
    color: Optional[str] = None
    branch_id: Optional[int] = None
    status: VehicleStatus
    status_changed_at: datetime
    status_reason: Optional[str] = None
    sold_at: Optional[date] = None
    reserved_until: Optional[date] = None
    sale_price: Optional[float] = None
    published_price: Optional[float] = None
    target_margin_pct: Optional[float] = None
    sale_notes: Optional[str] = None
    purchase_date: Optional[date] = None
    sale_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    total_expenses: float
    profit: Optional[float] = None
    margin_pct: Optional[float] = None


class VehicleMoveBranchRequest(SQLModel):
    to_branch_id: int
    note: Optional[str] = None


class VehicleVisitCreate(SQLModel):
    visit_date: date
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = 30
    timezone: Optional[str] = "Europe/Madrid"


class VehicleVisitUpdate(SQLModel):
    visit_date: Optional[date] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    timezone: Optional[str] = None


class VehicleVisitOut(SQLModel):
    id: int
    vehicle_id: str
    visit_date: date
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    calendar_event_id: Optional[str] = None
    calendar_event_html_link: Optional[str] = None
    calendar_status: Optional[str] = None
    calendar_last_error: Optional[str] = None
    calendar_last_synced_at: Optional[datetime] = None
    timezone: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class VehicleKpisOut(SQLModel):
    vehicle_id: str
    total_expenses: float
    total_cost: Optional[float] = None
    sale_price: Optional[float] = None
    gross_margin: Optional[float] = None
    roi: Optional[float] = None
    days_in_stock: Optional[int] = None


class VehicleStatusChange(SQLModel):
    to_status: VehicleStatus
    note: Optional[str] = None
    reserved_until: Optional[date] = None
    sold_at: Optional[date] = None


class VehicleTimelineItem(SQLModel):
    id: int
    type: VehicleEventType
    created_at: datetime
    summary: str
    payload: dict


class VehicleCreate(SQLModel):
    vin: str
    license_plate: str
    brand: str
    model: str
    year: int
    km: int
    branch_id: int
    purchase_date: str  # Acepta string en formato ISO
    version: Optional[str] = None
    color: Optional[str] = None
    status: Optional[VehicleStatus] = None
    status_reason: Optional[str] = None
    sold_at: Optional[date] = None
    reserved_until: Optional[date] = None
    sale_notes: Optional[str] = None
    published_price: Optional[float] = None
    target_margin_pct: Optional[float] = None
    notes: Optional[str] = None


class VehicleUpdate(SQLModel):
    vin: Optional[str] = None
    license_plate: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    version: Optional[str] = None
    year: Optional[int] = None
    km: Optional[int] = None
    color: Optional[str] = None
    branch_id: Optional[int] = None
    status: Optional[VehicleStatus] = None
    status_reason: Optional[str] = None
    sold_at: Optional[date] = None
    reserved_until: Optional[date] = None
    sale_notes: Optional[str] = None
    sale_price: Optional[float] = None
    published_price: Optional[float] = None
    target_margin_pct: Optional[float] = None
    purchase_date: Optional[date] = None
    sale_date: Optional[date] = None
    notes: Optional[str] = None


class Transfer(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    vehicle_id: str = Field(foreign_key="vehicle.license_plate")
    from_branch_id: Optional[int] = Field(default=None, foreign_key="branch.id")
    to_branch_id: int = Field(foreign_key="branch.id")
    transfer_date: date
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TransferCreate(SQLModel):
    from_branch_id: Optional[int] = Field(default=None, foreign_key="branch.id")
    to_branch_id: int = Field(foreign_key="branch.id")
    transfer_date: date
    notes: Optional[str] = None


class ExpenseCreate(SQLModel):
    concept: str
    amount: float
    expense_date: date
    notes: Optional[str] = None


class VehicleExpenseCreate(SQLModel):
    amount: Decimal
    currency: str = "EUR"
    date: date
    category: VehicleExpenseCategory
    vendor: Optional[str] = None
    invoice_ref: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    linked_vehicle_file_id: Optional[int] = None


class VehicleExpenseUpdate(SQLModel):
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
    date: Optional[str] = None
    category: Optional[VehicleExpenseCategory] = None
    vendor: Optional[str] = None
    invoice_ref: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    linked_vehicle_file_id: Optional[int] = None


class VehicleExpenseOut(SQLModel):
    id: int
    vehicle_id: str
    amount: Decimal
    currency: str
    date: date
    category: VehicleExpenseCategory
    vendor: Optional[str] = None
    invoice_ref: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    linked_vehicle_file_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SaleCloseRequest(SQLModel):
    sale_price: float
    sold_at: date
    sale_notes: Optional[str] = None


class SaleCreate(SQLModel):
    sale_price: float
    sale_date: date
    notes: Optional[str] = None
    client_name: Optional[str] = None
    client_tax_id: Optional[str] = None
    client_phone: Optional[str] = None
    client_email: Optional[str] = None
    client_address: Optional[str] = None


class SaleUpdate(SQLModel):
    sale_price: Optional[float] = None
    sale_date: Optional[date] = None
    notes: Optional[str] = None
    client_name: Optional[str] = None
    client_tax_id: Optional[str] = None
    client_phone: Optional[str] = None
    client_email: Optional[str] = None
    client_address: Optional[str] = None


engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}) if DATABASE_URL.startswith("sqlite") else create_engine(DATABASE_URL)
app = FastAPI(title="Sahocars API", version="2.0")
_vehicle_has_id_column_cache: Optional[bool] = None

_logger = setup_logging(get_env(), get_app_version(), get_app_branch(), get_app_commit())
migrate_legacy_data(_logger)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(admin_backup_router)
app.include_router(admin_vehicle_transfer_router)
app.include_router(reports_router)
app.include_router(google_auth_router)


@app.get("/version")
def get_version():
    return _build_version_response()


@app.get("/version/info")
def get_version_info():
    return _build_version_response()


@app.get("/health")
def get_health():
    migrations_ok = getattr(app.state, "migrations_ok", True)
    checks = {
        "db_readwrite": _check_db_rw(),
        "storage_readwrite": _check_dir_rw(get_storage_dir()),
        "backups_readwrite": _check_dir_rw(get_backups_dir()),
        "migrations": "ok" if migrations_ok else "fail",
    }
    return {
        "ok": all(value == "ok" for value in checks.values()),
        "timestamp": datetime.utcnow().isoformat(),
        "version": {
            "app_version": get_app_version(),
            "branch": get_app_branch(),
            "commit": get_app_commit(),
        },
        "data_dir": str(get_data_dir()),
        "db_path": str(get_db_path()),
        "storage_dir": str(get_storage_dir()),
        "backups_dir": str(get_backups_dir()),
        "checks": checks,
    }


@app.get("/docs/readme")
def get_readme():
    readme_path = _get_readme_path()
    if not readme_path.exists():
        raise HTTPException(status_code=404, detail="README no encontrado.")
    return Response(readme_path.read_text(encoding="utf-8"), media_type="text/markdown; charset=utf-8")


def get_session():
    with Session(engine) as session:
        yield session


def init_db():
    SQLModel.metadata.create_all(engine)
    _ensure_vehicle_status_schema()
    _ensure_vehicle_branch_schema()
    _ensure_vehicle_visit_schema()
    _ensure_vehicle_pricing_schema()
    _ensure_sale_schema()
    with Session(engine) as session:
        existing = session.exec(select(Branch)).all()
        if not existing:
            session.add_all([Branch(name="Montgat"), Branch(name="Juneda")])
            session.commit()
        default_branch_id = _get_default_branch_id(session)
        if default_branch_id is None:
            session.add(Branch(name="Principal"))
            session.commit()
            default_branch_id = _get_default_branch_id(session)
        if default_branch_id is not None:
            _ensure_branch_assignments(session, default_branch_id)
        _seed_initial_status_events(session)


def _ensure_vehicle_status_schema() -> None:
    if not DATABASE_URL.startswith("sqlite"):
        return
    with engine.begin() as conn:
        columns = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(vehicle);").fetchall()}
        if "status" not in columns:
            conn.exec_driver_sql("ALTER TABLE vehicle ADD COLUMN status TEXT;")
        if "status_changed_at" not in columns:
            conn.exec_driver_sql("ALTER TABLE vehicle ADD COLUMN status_changed_at DATETIME;")
        if "status_reason" not in columns:
            conn.exec_driver_sql("ALTER TABLE vehicle ADD COLUMN status_reason TEXT;")
        if "sold_at" not in columns:
            conn.exec_driver_sql("ALTER TABLE vehicle ADD COLUMN sold_at DATE;")
        if "reserved_until" not in columns:
            conn.exec_driver_sql("ALTER TABLE vehicle ADD COLUMN reserved_until DATE;")
        if "sale_notes" not in columns:
            conn.exec_driver_sql("ALTER TABLE vehicle ADD COLUMN sale_notes TEXT;")
        mapping = {
            "pendiente recepcion": "intake",
            "en revision": "prep",
            "en exposicion": "published",
            "reservado": "reserved",
            "vendido": "sold",
            "descartado": "discarded",
            "devuelto": "discarded",
        }
        for old_value, new_value in mapping.items():
            conn.exec_driver_sql(
                "UPDATE vehicle SET status = ? WHERE status = ?;",
                (new_value, old_value),
            )
        conn.exec_driver_sql(
            "UPDATE vehicle SET status = 'intake' "
            "WHERE status IS NULL OR status = '' "
            "OR status NOT IN ('intake','prep','ready','published','reserved','sold','discarded');"
        )
        conn.exec_driver_sql(
            "UPDATE vehicle SET status_changed_at = COALESCE(status_changed_at, created_at, ?);",
            (datetime.utcnow().isoformat(),),
        )
        conn.exec_driver_sql(
            "UPDATE vehicle SET sold_at = sale_date "
            "WHERE status = 'sold' AND sold_at IS NULL AND sale_date IS NOT NULL;"
        )


def _ensure_vehicle_branch_schema() -> None:
    if not DATABASE_URL.startswith("sqlite"):
        return
    with engine.begin() as conn:
        columns = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(vehicle);").fetchall()}
        if "branch_id" not in columns:
            conn.exec_driver_sql("ALTER TABLE vehicle ADD COLUMN branch_id INTEGER;")


def _ensure_vehicle_visit_schema() -> None:
    if not DATABASE_URL.startswith("sqlite"):
        return
    with engine.begin() as conn:
        columns = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(vehiclevisit);").fetchall()}
        if "scheduled_at" not in columns:
            conn.exec_driver_sql("ALTER TABLE vehiclevisit ADD COLUMN scheduled_at DATETIME;")
        if "duration_minutes" not in columns:
            conn.exec_driver_sql("ALTER TABLE vehiclevisit ADD COLUMN duration_minutes INTEGER;")
        if "calendar_event_id" not in columns:
            conn.exec_driver_sql("ALTER TABLE vehiclevisit ADD COLUMN calendar_event_id TEXT;")
        if "calendar_event_html_link" not in columns:
            conn.exec_driver_sql("ALTER TABLE vehiclevisit ADD COLUMN calendar_event_html_link TEXT;")
        if "calendar_status" not in columns:
            conn.exec_driver_sql("ALTER TABLE vehiclevisit ADD COLUMN calendar_status TEXT;")
        if "calendar_last_error" not in columns:
            conn.exec_driver_sql("ALTER TABLE vehiclevisit ADD COLUMN calendar_last_error TEXT;")
        if "calendar_last_synced_at" not in columns:
            conn.exec_driver_sql("ALTER TABLE vehiclevisit ADD COLUMN calendar_last_synced_at DATETIME;")
        if "timezone" not in columns:
            conn.exec_driver_sql("ALTER TABLE vehiclevisit ADD COLUMN timezone TEXT;")


def _ensure_vehicle_pricing_schema() -> None:
    if not DATABASE_URL.startswith("sqlite"):
        return
    with engine.begin() as conn:
        columns = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(vehicle);").fetchall()}
        if "published_price" not in columns:
            conn.exec_driver_sql("ALTER TABLE vehicle ADD COLUMN published_price REAL;")
        if "target_margin_pct" not in columns:
            conn.exec_driver_sql("ALTER TABLE vehicle ADD COLUMN target_margin_pct REAL;")


def _ensure_sale_schema() -> None:
    if not DATABASE_URL.startswith("sqlite"):
        return
    with engine.begin() as conn:
        columns = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(sale);").fetchall()}
        if "client_name" not in columns:
            conn.exec_driver_sql("ALTER TABLE sale ADD COLUMN client_name TEXT;")
        if "client_tax_id" not in columns:
            conn.exec_driver_sql("ALTER TABLE sale ADD COLUMN client_tax_id TEXT;")
        if "client_phone" not in columns:
            conn.exec_driver_sql("ALTER TABLE sale ADD COLUMN client_phone TEXT;")
        if "client_email" not in columns:
            conn.exec_driver_sql("ALTER TABLE sale ADD COLUMN client_email TEXT;")
        if "client_address" not in columns:
            conn.exec_driver_sql("ALTER TABLE sale ADD COLUMN client_address TEXT;")
        if "created_at" not in columns:
            conn.exec_driver_sql("ALTER TABLE sale ADD COLUMN created_at DATETIME;")


def _get_default_branch_id(session: Session) -> Optional[int]:
    return session.exec(select(Branch.id).order_by(Branch.id)).first()


def _ensure_branch_assignments(session: Session, default_branch_id: int) -> None:
    session.exec(
        update(Vehicle)
        .where(Vehicle.branch_id.is_(None))
        .values(branch_id=default_branch_id, updated_at=datetime.utcnow())
    )
    session.commit()


def _seed_initial_status_events(session: Session) -> None:
    existing_vehicle_ids = {
        row[0] for row in session.exec(select(VehicleStatusEvent.vehicle_id)).all()
    }
    vehicles = session.exec(select(Vehicle)).all()
    for vehicle in vehicles:
        if vehicle.license_plate in existing_vehicle_ids:
            continue
        session.add(
            VehicleStatusEvent(
                vehicle_id=vehicle.license_plate,
                from_status=vehicle.status,
                to_status=vehicle.status,
                changed_at=vehicle.status_changed_at or vehicle.created_at,
                note="Inicial",
                actor="system",
            )
        )
    session.commit()


@app.on_event("startup")
def on_startup():
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    migrations_ok, migrations_error = run_migrations()
    app.state.migrations_ok = migrations_ok
    app.state.migrations_error = migrations_error
    if not migrations_ok:
        _logger.error("Error en migraciones: %s", migrations_error)
    init_db()


@app.get("/branches", response_model=List[Branch])
def list_branches(session: Session = Depends(get_session)):
    return session.exec(select(Branch)).all()


@app.post("/vehicles", response_model=Vehicle)
def create_vehicle(vehicle_data: VehicleCreate, session: Session = Depends(get_session)):
    try:
        data = vehicle_data.model_dump()
        data["license_plate"] = normalize_plate(data["license_plate"])
        if session.get(Vehicle, data["license_plate"]):
            raise HTTPException(status_code=409, detail="La matricula ya existe")
        # Convertir string de fecha a date
        if isinstance(data.get("purchase_date"), str):
            data["purchase_date"] = datetime.fromisoformat(data["purchase_date"]).date()
        if isinstance(data.get("sale_date"), str):
            data["sale_date"] = datetime.fromisoformat(data["sale_date"]).date()
        if isinstance(data.get("reserved_until"), str):
            data["reserved_until"] = datetime.fromisoformat(data["reserved_until"]).date()
        if isinstance(data.get("sold_at"), str):
            data["sold_at"] = datetime.fromisoformat(data["sold_at"]).date()
        if not data.get("status"):
            data["status"] = VehicleStatus.INTAKE
        data["status_changed_at"] = datetime.utcnow()

        vehicle = Vehicle(**data)
        vehicle.created_at = datetime.utcnow()
        vehicle.updated_at = datetime.utcnow()
        session.add(vehicle)
        session.commit()
        session.refresh(vehicle)
        session.add(
            VehicleStatusEvent(
                vehicle_id=vehicle.license_plate,
                from_status=vehicle.status,
                to_status=vehicle.status,
                changed_at=vehicle.status_changed_at,
                note="Inicial",
                actor="system",
            )
        )
        session.commit()
        session.refresh(vehicle)
        return vehicle
    except Exception as e:
        session.rollback()
        print(f"Error en create_vehicle: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error al crear vehículo: {str(e)}")


@app.get("/vehicles", response_model=List[VehicleDetailOut])
def list_vehicles(
    state: Optional[VehicleStatus] = None,
    branch_id: Optional[int] = None,
    from_date: Optional[date] = Query(None, description="filter by purchase date >="),
    to_date: Optional[date] = Query(None, description="filter by purchase date <="),
    session: Session = Depends(get_session),
):
    try:
        query = select(Vehicle)
        if state:
            query = query.where(Vehicle.status == state)
        if branch_id:
            query = query.where(Vehicle.branch_id == branch_id)
        if from_date:
            query = query.where(Vehicle.purchase_date >= from_date)
        if to_date:
            query = query.where(Vehicle.purchase_date <= to_date)
        query = query.order_by(Vehicle.created_at.desc())
        vehicles = session.exec(query).all()
        return [_build_vehicle_detail(session, vehicle) for vehicle in vehicles]
    except Exception as e:
        print(f"Error en list_vehicles: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al listar vehículos: {str(e)}")


def _build_vehicle_detail(session: Session, vehicle: Vehicle) -> dict:
    payload = vehicle.model_dump()
    payload.update(compute_vehicle_financials(session, vehicle.license_plate))
    return payload


@app.get("/vehicles/{license_plate}", response_model=VehicleDetailOut)
def get_vehicle(license_plate: str, session: Session = Depends(get_session)):
    vehicle = session.get(Vehicle, normalize_plate(license_plate))
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    return _build_vehicle_detail(session, vehicle)


@app.patch("/vehicles/{license_plate}", response_model=Vehicle)
def update_vehicle(license_plate: str, data: VehicleUpdate, session: Session = Depends(get_session)):
    normalized_plate = normalize_plate(license_plate)
    vehicle = session.get(Vehicle, normalized_plate)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    update_data = data.model_dump(exclude_unset=True)
    if "license_plate" in update_data and normalize_plate(update_data["license_plate"]) != normalized_plate:
        raise HTTPException(status_code=422, detail="La matricula no se puede modificar")
    if any(
        key in update_data
        for key in (
            "status",
            "status_reason",
            "reserved_until",
            "sold_at",
            "sale_price",
            "sale_date",
            "sale_notes",
            "branch_id",
        )
    ):
        raise HTTPException(
            status_code=422,
            detail="Usa los endpoints /status, /sale o /move-branch para cambios de estado, venta o sucursal",
        )
    update_data.pop("license_plate", None)
    update_data.pop("created_at", None)
    for key, value in update_data.items():
        setattr(vehicle, key, value)
    vehicle.updated_at = datetime.utcnow()
    session.add(vehicle)
    session.commit()
    session.refresh(vehicle)
    return vehicle


@app.delete("/vehicles/{license_plate}")
def delete_vehicle(license_plate: str, session: Session = Depends(get_session)):
    resolved = _resolve_vehicle_identifier(session, license_plate)
    if not resolved:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    normalized_plate, vehicle = resolved

    for model in (
        VehicleExpense,
        Expense,
        Sale,
        SaleDocument,
        VehicleFile,
        VehicleLink,
        VehicleVisit,
        VehicleEvent,
        VehicleStatusEvent,
        Transfer,
        Document,
        Photo,
    ):
        records = session.exec(select(model).where(model.vehicle_id == normalized_plate)).all()
        for record in records:
            session.delete(record)

    session.delete(vehicle)
    session.commit()

    shutil.rmtree(vehicle_storage_dir(normalized_plate, "vehicles"), ignore_errors=True)
    shutil.rmtree(vehicle_storage_dir(normalized_plate, "vehiculos"), ignore_errors=True)

    return {"status": "ok"}


@app.post("/vehicles/{license_plate}/status", response_model=Vehicle)
def update_vehicle_status(
    license_plate: str,
    payload: VehicleStatusChange,
    session: Session = Depends(get_session),
):
    return change_status(
        session,
        normalize_plate(license_plate),
        payload.to_status,
        note=payload.note,
        actor="local_user",
        reserved_until=payload.reserved_until,
        sold_at=payload.sold_at,
    )


@app.post("/vehicles/{license_plate}/move-branch", response_model=Vehicle)
def move_vehicle_branch(
    license_plate: str,
    payload: VehicleMoveBranchRequest,
    session: Session = Depends(get_session),
):
    normalized_plate = normalize_plate(license_plate)
    vehicle = session.get(Vehicle, normalized_plate)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")

    target_branch = session.get(Branch, payload.to_branch_id)
    if not target_branch:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")

    if vehicle.branch_id == payload.to_branch_id:
        raise HTTPException(status_code=400, detail="El vehiculo ya esta en esa sucursal")

    from_branch_id = vehicle.branch_id
    from_branch = session.get(Branch, from_branch_id) if from_branch_id is not None else None
    vehicle.branch_id = payload.to_branch_id
    vehicle.updated_at = datetime.utcnow()
    session.add(vehicle)
    session.commit()
    session.refresh(vehicle)

    emit_event(
        session,
        normalized_plate,
        VehicleEventType.BRANCH_MOVED,
        {
            "from_branch_id": from_branch_id,
            "to_branch_id": payload.to_branch_id,
            "from_branch_name": from_branch.name if from_branch else None,
            "to_branch_name": target_branch.name,
            "note": payload.note,
        },
        actor="local_user",
    )
    session.refresh(vehicle)

    return vehicle


@app.get("/vehicles/{license_plate}/status/events")
def get_vehicle_status_events(
    license_plate: str,
    limit: int = Query(50, ge=1, le=200),
    session: Session = Depends(get_session),
):
    return list_status_events(session, normalize_plate(license_plate), limit=limit)


@app.get("/vehicles/{license_plate}/timeline", response_model=List[VehicleTimelineItem])
def get_vehicle_timeline(
    license_plate: str,
    limit: int = Query(50, ge=1, le=200),
    types: Optional[List[VehicleEventType]] = Query(None),
    session: Session = Depends(get_session),
):
    return list_timeline(session, normalize_plate(license_plate), limit=limit, types=types)


@app.post("/vehicles/{license_plate}/transfer", response_model=Transfer)
def transfer_vehicle(
    license_plate: str,
    transfer: TransferCreate,
    session: Session = Depends(get_session),
):
    normalized_plate = normalize_plate(license_plate)
    vehicle = session.get(Vehicle, normalized_plate)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    transfer_record = Transfer(vehicle_id=normalized_plate, **transfer.model_dump())
    session.add(transfer_record)
    vehicle.branch_id = transfer_record.to_branch_id
    vehicle.updated_at = datetime.utcnow()
    session.add(vehicle)
    session.commit()
    session.refresh(transfer_record)
    return transfer_record


@app.get("/vehicles/{license_plate}/expenses", response_model=List[VehicleExpenseOut])
def list_vehicle_expenses(license_plate: str, session: Session = Depends(get_session)):
    return list_vehicle_expenses_service(session, normalize_plate(license_plate))


@app.post("/vehicles/{license_plate}/expenses", response_model=VehicleExpenseOut, status_code=201)
def create_vehicle_expense(license_plate: str, payload: VehicleExpenseCreate, session: Session = Depends(get_session)):
    return create_vehicle_expense_service(session, normalize_plate(license_plate), payload)


@app.patch("/vehicles/{license_plate}/expenses/{expense_id}", response_model=VehicleExpenseOut)
def update_vehicle_expense(
    license_plate: str,
    expense_id: int,
    payload: VehicleExpenseUpdate,
    session: Session = Depends(get_session),
):
    return update_vehicle_expense_service(session, normalize_plate(license_plate), expense_id, payload)


@app.delete("/vehicles/{license_plate}/expenses/{expense_id}")
def delete_vehicle_expense(
    license_plate: str,
    expense_id: int,
    session: Session = Depends(get_session),
):
    delete_vehicle_expense_service(session, normalize_plate(license_plate), expense_id)
    return {"status": "ok"}


@app.get("/vehicles/{license_plate}/sale", response_model=Sale)
def get_sale(license_plate: str, session: Session = Depends(get_session)):
    normalized_plate = normalize_plate(license_plate)
    sale = session.exec(select(Sale).where(Sale.vehicle_id == normalized_plate)).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return sale


@app.post("/vehicles/{license_plate}/sale", response_model=VehicleDetailOut)
def register_sale(license_plate: str, sale: SaleCloseRequest, session: Session = Depends(get_session)):
    normalized_plate = normalize_plate(license_plate)
    if sale.sale_price <= 0:
        raise HTTPException(status_code=400, detail="sale_price debe ser mayor que 0")
    vehicle = session.get(Vehicle, normalized_plate)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    if vehicle.status == VehicleStatus.DISCARDED:
        raise HTTPException(status_code=400, detail="No se puede vender un vehiculo descartado")

    if vehicle.status != VehicleStatus.SOLD:
        change_status(
            session,
            normalized_plate,
            VehicleStatus.SOLD,
            note="Venta cerrada",
            actor="local_user",
            sold_at=sale.sold_at,
        )
        vehicle = session.get(Vehicle, normalized_plate)

    vehicle.sale_price = sale.sale_price
    vehicle.sold_at = sale.sold_at
    vehicle.sale_date = sale.sold_at
    vehicle.sale_notes = sale.sale_notes
    vehicle.updated_at = datetime.utcnow()
    session.add(vehicle)

    sale_record = session.exec(select(Sale).where(Sale.vehicle_id == normalized_plate)).first()
    if sale_record:
        sale_record.sale_price = sale.sale_price
        sale_record.sale_date = sale.sold_at
        sale_record.notes = sale.sale_notes
        session.add(sale_record)
    else:
        sale_record = Sale(
            vehicle_id=normalized_plate,
            sale_price=sale.sale_price,
            sale_date=sale.sold_at,
            notes=sale.sale_notes,
        )
        session.add(sale_record)

    session.commit()
    session.refresh(vehicle)
    return _build_vehicle_detail(session, vehicle)


@app.patch("/vehicles/{license_plate}/sale", response_model=Sale)
def update_sale(license_plate: str, payload: SaleUpdate, session: Session = Depends(get_session)):
    normalized_plate = normalize_plate(license_plate)
    sale_record = session.exec(select(Sale).where(Sale.vehicle_id == normalized_plate)).first()
    if not sale_record:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(sale_record, key, value)
    session.add(sale_record)
    if update_data.get("sale_price") is not None or update_data.get("sale_date") is not None:
        vehicle = session.get(Vehicle, normalized_plate)
        if vehicle:
            vehicle.sale_price = sale_record.sale_price
            vehicle.sale_date = sale_record.sale_date
            vehicle.sold_at = vehicle.sold_at or sale_record.sale_date
            if update_data.get("notes") is not None:
                vehicle.sale_notes = sale_record.notes
            session.add(vehicle)
            if vehicle.status != VehicleStatus.SOLD:
                change_status(
                    session,
                    normalized_plate,
                    VehicleStatus.SOLD,
                    note="Venta actualizada",
                    actor="system",
                    sold_at=sale_record.sale_date,
                )
            elif sale_record.sale_date and not vehicle.sold_at:
                vehicle.sold_at = sale_record.sale_date
                vehicle.updated_at = datetime.utcnow()
                session.add(vehicle)
                session.commit()
    session.commit()
    session.refresh(sale_record)
    return sale_record


@app.get("/vehicles/{license_plate}/documents", response_model=List[Document])
def list_documents(license_plate: str, session: Session = Depends(get_session)):
    normalized_plate = normalize_plate(license_plate)
    return session.exec(
        select(Document).where(Document.vehicle_id == normalized_plate).order_by(Document.uploaded_at.desc())
    ).all()


@app.post("/vehicles/{license_plate}/documents", response_model=Document)
def upload_document(
    license_plate: str,
    doc_type: str = Query(..., description="tipo de documento"),
    notes: Optional[str] = Query(None),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    normalized_plate = normalize_plate(license_plate)
    vehicle = session.get(Vehicle, normalized_plate)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    storage_path = vehicle_storage_dir(normalized_plate, "vehiculos", "documentos")
    storage_path.mkdir(parents=True, exist_ok=True)
    safe_name = os.path.basename(file.filename)
    destination = storage_path / safe_name
    with destination.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    record = Document(
        vehicle_id=normalized_plate,
        doc_type=doc_type,
        file_name=safe_name,
        stored_path=str(destination),
        notes=notes,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


@app.get("/vehicles/{license_plate}/photos", response_model=List[Photo])
def list_photos(license_plate: str, session: Session = Depends(get_session)):
    normalized_plate = normalize_plate(license_plate)
    return session.exec(
        select(Photo)
        .where(Photo.vehicle_id == normalized_plate)
        .order_by(Photo.display_order, Photo.uploaded_at)
    ).all()


@app.post("/vehicles/{license_plate}/photos", response_model=Photo)
def upload_photo(
    license_plate: str,
    display_order: Optional[int] = Query(None),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    normalized_plate = normalize_plate(license_plate)
    vehicle = session.get(Vehicle, normalized_plate)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    existing_count = len(session.exec(select(Photo).where(Photo.vehicle_id == normalized_plate)).all())
    if existing_count >= 100:
        raise HTTPException(status_code=400, detail="Limite de 100 fotos alcanzado")
    storage_path = vehicle_storage_dir(normalized_plate, "vehiculos", "fotos")
    storage_path.mkdir(parents=True, exist_ok=True)
    safe_name = os.path.basename(file.filename)
    destination = storage_path / safe_name
    with destination.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    photo = Photo(
        vehicle_id=normalized_plate,
        file_name=safe_name,
        stored_path=str(destination),
        display_order=display_order,
    )
    session.add(photo)
    session.commit()
    session.refresh(photo)
    return photo


def normalize_plate(value: str) -> str:
    normalized = value.strip().upper()
    if not normalized:
        raise HTTPException(status_code=422, detail="Matricula invalida")
    return normalized


def _vehicle_has_id_column(session: Session) -> bool:
    global _vehicle_has_id_column_cache
    if _vehicle_has_id_column_cache is not None:
        return _vehicle_has_id_column_cache
    try:
        inspector = inspect(session.get_bind())
        columns = {column["name"] for column in inspector.get_columns("vehicle")}
        _vehicle_has_id_column_cache = "id" in columns
    except Exception:
        _vehicle_has_id_column_cache = False
    return _vehicle_has_id_column_cache


def _resolve_vehicle_identifier(session: Session, identifier: str) -> tuple[str, Vehicle] | None:
    normalized = normalize_plate(identifier)
    vehicle = session.get(Vehicle, normalized)
    if vehicle:
        return normalized, vehicle
    if not identifier.isdigit() or not _vehicle_has_id_column(session):
        return None
    try:
        row = session.exec(text("SELECT license_plate FROM vehicle WHERE id = :id"), {"id": int(identifier)}).first()
    except Exception:
        return None
    if not row:
        return None
    try:
        legacy_plate = row[0]
    except Exception:
        legacy_plate = row
    if not legacy_plate:
        return None
    normalized_legacy = normalize_plate(str(legacy_plate))
    vehicle = session.get(Vehicle, normalized_legacy)
    if not vehicle:
        return None
    return normalized_legacy, vehicle


def _require_local_request(request: Request) -> None:
    allow_remote = os.getenv("SAHOCARS_ADMIN_ALLOW_REMOTE", "false").lower() == "true"
    if allow_remote:
        return
    client = request.client
    host = client.host if client else ""
    if host not in ("127.0.0.1", "::1", "localhost"):
        raise HTTPException(status_code=403, detail="Acceso solo local")


def _build_version_response() -> dict[str, object]:
    schema_version = None
    db_path = get_db_path()
    if DATABASE_URL.startswith("sqlite") and db_path.exists():
        schema_version = _get_schema_version(DATABASE_URL, db_path)
    return {
        "app_version": get_app_version(),
        "branch": get_app_branch(),
        "commit": get_app_commit(),
        "schema_version": schema_version,
        "env": get_env(),
    }


def _get_readme_path() -> Path:
    return Path(__file__).resolve().parents[1] / "README.md"


def _check_db_rw() -> str:
    if not DATABASE_URL.startswith("sqlite"):
        return "ok"
    try:
        db_path = get_db_path()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(db_path) as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS _health_check (id INTEGER PRIMARY KEY, ts TEXT)")
            conn.execute("INSERT INTO _health_check (ts) VALUES (?)", (datetime.utcnow().isoformat(),))
            conn.execute("DELETE FROM _health_check")
            conn.commit()
        return "ok"
    except Exception:
        return "fail"


def _check_dir_rw(path: Path) -> str:
    try:
        path.mkdir(parents=True, exist_ok=True)
        test_file = path / f".health_{uuid4().hex}"
        test_file.write_text("ok", encoding="utf-8")
        test_file.unlink(missing_ok=True)
        return "ok"
    except Exception:
        return "fail"


def vehicle_storage_key(license_plate: str) -> str:
    normalized = normalize_plate(license_plate)
    safe = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in normalized)
    return safe or "unknown"


def vehicle_storage_dir(license_plate: str, root_folder: str, *parts: str) -> Path:
    safe_plate = vehicle_storage_key(license_plate)
    return STORAGE_ROOT / root_folder / safe_plate / Path(*parts)


def ensure_vehicle_exists(license_plate: str, session: Session) -> None:
    if not session.get(Vehicle, normalize_plate(license_plate)):
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")


def safe_extension(file_name: str) -> str:
    return os.path.splitext(file_name)[1].lower()


def write_upload_file(destination: Path, upload: UploadFile) -> int:
    size_bytes = 0
    with destination.open("wb") as buffer:
        while True:
            chunk = upload.file.read(1024 * 1024)
            if not chunk:
                break
            size_bytes += len(chunk)
            if size_bytes > MAX_FILE_SIZE_BYTES:
                raise HTTPException(status_code=400, detail=f"Archivo supera el limite de {MAX_FILE_SIZE_MB}MB")
            buffer.write(chunk)
    return size_bytes


@app.get("/vehicles/{license_plate}/files", response_model=List[VehicleFile])
def list_vehicle_files(
    license_plate: str,
    category: Optional[str] = Query(None, description="document | expense | photo"),
    session: Session = Depends(get_session),
):
    normalized_plate = normalize_plate(license_plate)
    ensure_vehicle_exists(normalized_plate, session)
    if category and category not in {"document", "expense", "photo"}:
        raise HTTPException(status_code=400, detail="Categoria no valida")
    query = select(VehicleFile).where(VehicleFile.vehicle_id == normalized_plate)
    if category:
        query = query.where(VehicleFile.category == category)
    return session.exec(query.order_by(VehicleFile.created_at.desc())).all()


@app.post("/vehicles/{license_plate}/files", response_model=VehicleFile)
def upload_vehicle_file(
    license_plate: str,
    category: str = Form(...),
    file: UploadFile = File(...),
    notes: Optional[str] = Form(None),
    session: Session = Depends(get_session),
):
    normalized_plate = normalize_plate(license_plate)
    ensure_vehicle_exists(normalized_plate, session)
    if category not in {"document", "expense", "photo"}:
        raise HTTPException(status_code=400, detail="Categoria no valida")
    if category == "photo":
        if file.content_type not in ALLOWED_PHOTO_MIME_TYPES:
            raise HTTPException(status_code=400, detail="Formato de imagen no permitido")
    original_name = os.path.basename(file.filename or "archivo")
    extension = safe_extension(original_name)
    if category == "photo" and extension not in ALLOWED_PHOTO_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Extension de imagen no permitida")

    storage_dir = vehicle_storage_dir(normalized_plate, "vehicles")
    storage_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid4().hex}{extension}"
    destination = storage_dir / stored_name

    try:
        size_bytes = write_upload_file(destination, file)
    except HTTPException:
        if destination.exists():
            destination.unlink()
        raise
    finally:
        file.file.close()

    record = VehicleFile(
        vehicle_id=normalized_plate,
        category=category,
        original_name=original_name,
        stored_name=stored_name,
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=size_bytes,
        notes=notes,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    emit_event(
        session,
        normalized_plate,
        VehicleEventType.FILE_UPLOADED,
        {"id": record.id, "name": record.original_name, "category": record.category},
    )
    return record


@app.get("/vehicles/{license_plate}/files/{file_id}/download")
def download_vehicle_file(
    license_plate: str,
    file_id: int,
    session: Session = Depends(get_session),
):
    normalized_plate = normalize_plate(license_plate)
    record = session.get(VehicleFile, file_id)
    if not record or record.vehicle_id != normalized_plate:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    file_path = vehicle_storage_dir(normalized_plate, "vehicles") / record.stored_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return FileResponse(file_path, filename=record.original_name)


@app.delete("/vehicles/{license_plate}/files/{file_id}")
def delete_vehicle_file(
    license_plate: str,
    file_id: int,
    session: Session = Depends(get_session),
):
    normalized_plate = normalize_plate(license_plate)
    record = session.get(VehicleFile, file_id)
    if not record or record.vehicle_id != normalized_plate:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    file_path = vehicle_storage_dir(normalized_plate, "vehicles") / record.stored_name
    if file_path.exists():
        file_path.unlink()
    session.delete(record)
    session.commit()
    emit_event(
        session,
        normalized_plate,
        VehicleEventType.FILE_DELETED,
        {"id": record.id, "name": record.original_name, "category": record.category},
    )
    return {"status": "ok"}


@app.get("/vehicles/{license_plate}/sale-documents", response_model=List[SaleDocument])
def list_sale_documents(license_plate: str, session: Session = Depends(get_session)):
    normalized_plate = normalize_plate(license_plate)
    ensure_vehicle_exists(normalized_plate, session)
    return session.exec(
        select(SaleDocument)
        .where(SaleDocument.vehicle_id == normalized_plate)
        .order_by(SaleDocument.created_at.desc())
    ).all()


@app.post("/vehicles/{license_plate}/sale-documents", response_model=SaleDocument)
def upload_sale_document(
    license_plate: str,
    file: UploadFile = File(...),
    notes: Optional[str] = Form(None),
    sale_id: Optional[int] = Form(None),
    session: Session = Depends(get_session),
):
    normalized_plate = normalize_plate(license_plate)
    ensure_vehicle_exists(normalized_plate, session)
    sale = None
    if sale_id is not None:
        sale = session.get(Sale, sale_id)
        if not sale or sale.vehicle_id != normalized_plate:
            raise HTTPException(status_code=404, detail="Venta no encontrada")

    original_name = os.path.basename(file.filename or "archivo")
    extension = safe_extension(original_name)
    storage_dir = vehicle_storage_dir(normalized_plate, "vehicles", "sale-documents")
    storage_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid4().hex}{extension}"
    destination = storage_dir / stored_name

    try:
        size_bytes = write_upload_file(destination, file)
    except HTTPException:
        if destination.exists():
            destination.unlink()
        raise
    finally:
        file.file.close()

    record = SaleDocument(
        vehicle_id=normalized_plate,
        sale_id=sale.id if sale else None,
        original_name=original_name,
        stored_name=stored_name,
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=size_bytes,
        notes=notes,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


@app.get("/vehicles/{license_plate}/sale-documents/{document_id}/download")
def download_sale_document(
    license_plate: str,
    document_id: int,
    session: Session = Depends(get_session),
):
    normalized_plate = normalize_plate(license_plate)
    record = session.get(SaleDocument, document_id)
    if not record or record.vehicle_id != normalized_plate:
        raise HTTPException(status_code=404, detail="Documento de venta no encontrado")
    file_path = vehicle_storage_dir(normalized_plate, "vehicles", "sale-documents") / record.stored_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Documento de venta no encontrado")
    return FileResponse(file_path, filename=record.original_name)


@app.delete("/vehicles/{license_plate}/sale-documents/{document_id}")
def delete_sale_document(
    license_plate: str,
    document_id: int,
    session: Session = Depends(get_session),
):
    normalized_plate = normalize_plate(license_plate)
    record = session.get(SaleDocument, document_id)
    if not record or record.vehicle_id != normalized_plate:
        raise HTTPException(status_code=404, detail="Documento de venta no encontrado")
    file_path = vehicle_storage_dir(normalized_plate, "vehicles", "sale-documents") / record.stored_name
    if file_path.exists():
        file_path.unlink()
    session.delete(record)
    session.commit()
    return {"status": "ok"}


@app.get("/vehicles/{license_plate}/links", response_model=List[VehicleLink])
def list_vehicle_links(license_plate: str, session: Session = Depends(get_session)):
    normalized_plate = normalize_plate(license_plate)
    return session.exec(
        select(VehicleLink).where(VehicleLink.vehicle_id == normalized_plate).order_by(VehicleLink.created_at.desc())
    ).all()


@app.post("/vehicles/{license_plate}/links", response_model=VehicleLink)
def create_vehicle_link(
    license_plate: str,
    payload: VehicleLinkCreate,
    session: Session = Depends(get_session),
):
    normalized_plate = normalize_plate(license_plate)
    if not session.get(Vehicle, normalized_plate):
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    link = VehicleLink(vehicle_id=normalized_plate, **payload.model_dump())
    session.add(link)
    session.commit()
    session.refresh(link)
    return link


@app.delete("/vehicles/{license_plate}/links/{link_id}")
def delete_vehicle_link(
    license_plate: str,
    link_id: int,
    session: Session = Depends(get_session),
):
    normalized_plate = normalize_plate(license_plate)
    link = session.get(VehicleLink, link_id)
    if not link or link.vehicle_id != normalized_plate:
        raise HTTPException(status_code=404, detail="Enlace no encontrado")
    session.delete(link)
    session.commit()
    return {"status": "ok"}


@app.get("/vehicles/{license_plate}/visits", response_model=List[VehicleVisitOut])
def list_vehicle_visits(license_plate: str, session: Session = Depends(get_session)):
    return list_visits(session, normalize_plate(license_plate))


@app.post("/vehicles/{license_plate}/visits", response_model=VehicleVisitOut, status_code=201)
def create_vehicle_visit(
    license_plate: str,
    payload: VehicleVisitCreate,
    session: Session = Depends(get_session),
):
    return create_visit(session, normalize_plate(license_plate), payload)


@app.patch("/vehicles/{license_plate}/visits/{visit_id}", response_model=VehicleVisitOut)
def update_vehicle_visit(
    license_plate: str,
    visit_id: int,
    payload: VehicleVisitUpdate,
    session: Session = Depends(get_session),
):
    return update_visit(session, normalize_plate(license_plate), visit_id, payload)


@app.delete("/vehicles/{license_plate}/visits/{visit_id}")
def delete_vehicle_visit(
    license_plate: str,
    visit_id: int,
    session: Session = Depends(get_session),
):
    delete_visit(session, normalize_plate(license_plate), visit_id)
    return {"status": "ok"}


@app.post("/visits/{visit_id}/calendar/sync", response_model=VehicleVisitOut)
def sync_visit_calendar(
    visit_id: int,
    request: Request,
    session: Session = Depends(get_session),
):
    _require_local_request(request)
    visit = session.get(VehicleVisit, visit_id)
    if not visit:
        raise HTTPException(status_code=404, detail="Visita no encontrada")
    vehicle = session.get(Vehicle, visit.vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    branch_name = None
    if vehicle.branch_id is not None:
        branch = session.get(Branch, vehicle.branch_id)
        branch_name = branch.name if branch else None

    now = datetime.utcnow()
    had_event = bool(visit.calendar_event_id)
    try:
        result = create_or_update_event(session, visit, vehicle, branch_name)
        visit.calendar_event_id = result.get("id")
        visit.calendar_event_html_link = result.get("htmlLink")
        visit.calendar_status = "updated" if had_event else "created"
        visit.calendar_last_error = None
        visit.calendar_last_synced_at = now
    except HTTPException as exc:
        visit.calendar_status = "failed"
        visit.calendar_last_error = str(exc.detail)
        visit.calendar_last_synced_at = now
    except Exception as exc:
        visit.calendar_status = "failed"
        visit.calendar_last_error = str(exc)
        visit.calendar_last_synced_at = now

    session.add(visit)
    session.commit()
    session.refresh(visit)
    return visit


@app.get("/vehicles/{license_plate}/kpis", response_model=VehicleKpisOut)
def vehicle_kpis(license_plate: str, session: Session = Depends(get_session)):
    return get_vehicle_kpis(session, normalize_plate(license_plate))




@app.get("/documents/{document_id}")
def download_document(document_id: int, session: Session = Depends(get_session)):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return FileResponse(document.stored_path, filename=document.file_name)


@app.get("/photos/{photo_id}")
def download_photo(photo_id: int, session: Session = Depends(get_session)):
    photo = session.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Foto no encontrada")
    return FileResponse(photo.stored_path, filename=photo.file_name)


@app.get("/dashboard")
def dashboard(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    branch_id: Optional[int] = Query(None),
    session: Session = Depends(get_session),
):
    try:
        vehicles_query = select(Vehicle)
        if branch_id:
            vehicles_query = vehicles_query.where(Vehicle.branch_id == branch_id)
        vehicles = session.exec(vehicles_query).all()
        vehicle_ids = [v.license_plate for v in vehicles]

        income = 0.0
        if vehicle_ids:
            sale_query = select(Sale).where(Sale.vehicle_id.in_(vehicle_ids))
            if from_date:
                sale_query = sale_query.where(Sale.sale_date >= from_date)
            if to_date:
                sale_query = sale_query.where(Sale.sale_date <= to_date)
            income = sum(s.sale_price for s in session.exec(sale_query).all())

        expense_total = 0.0
        if vehicle_ids:
            expense_query = select(Expense).where(Expense.vehicle_id.in_(vehicle_ids))
            if from_date:
                expense_query = expense_query.where(Expense.expense_date >= from_date)
            if to_date:
                expense_query = expense_query.where(Expense.expense_date <= to_date)
            expense_total = sum(exp.amount for exp in session.exec(expense_query).all())

        margin = income - expense_total
        return {
            "vehicles": len(vehicles),
            "income": income,
            "expenses": expense_total,
            "margin": margin,
        }
    except Exception as e:
        print(f"Error en dashboard: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error en dashboard: {str(e)}")


@app.get("/export/vehicles")
def export_vehicles(session: Session = Depends(get_session)):
    vehicles = session.exec(select(Vehicle).order_by(Vehicle.license_plate)).all()
    headers = [
        "vin",
        "license_plate",
        "brand",
        "model",
        "version",
        "year",
        "km",
        "color",
        "branch_id",
        "status",
        "purchase_date",
        "target_margin_pct",
        "published_price",
        "sale_price",
        "sale_date",
    ]
    lines = [",".join(headers)]
    for v in vehicles:
        values = [
            v.vin or "",
            v.license_plate or "",
            v.brand or "",
            v.model or "",
            v.version or "",
            str(v.year or ""),
            str(v.km or ""),
            v.color or "",
            str(v.branch_id or ""),
            v.status or "",
            v.purchase_date.isoformat() if v.purchase_date else "",
            str(v.target_margin_pct if v.target_margin_pct is not None else ""),
            str(v.published_price if v.published_price is not None else ""),
            str(v.sale_price or ""),
            v.sale_date.isoformat() if v.sale_date else "",
        ]
        lines.append(",".join(value.replace(",", " ") for value in values))
    return StreamingResponse(iter(["\n".join(lines)]), media_type="text/csv")


@app.get("/export/expenses")
def export_expenses(session: Session = Depends(get_session)):
    expenses = session.exec(select(Expense).order_by(Expense.expense_date)).all()
    headers = ["id", "vehicle_id", "concept", "amount", "expense_date", "notes"]
    lines = [",".join(headers)]
    for exp in expenses:
        values = [
            str(exp.id or ""),
            str(exp.vehicle_id),
            exp.concept,
            str(exp.amount),
            exp.expense_date.isoformat(),
            (exp.notes or "").replace(",", " "),
        ]
        lines.append(",".join(values))
    return StreamingResponse(iter(["\n".join(lines)]), media_type="text/csv")


@app.get("/export/sales")
def export_sales(session: Session = Depends(get_session)):
    sales = session.exec(select(Sale).order_by(Sale.sale_date)).all()
    headers = [
        "id",
        "vehicle_id",
        "sale_price",
        "sale_date",
        "client_name",
        "client_tax_id",
        "client_phone",
        "client_email",
        "client_address",
        "notes",
    ]
    lines = [",".join(headers)]
    for sale in sales:
        values = [
            str(sale.id or ""),
            str(sale.vehicle_id),
            str(sale.sale_price),
            sale.sale_date.isoformat(),
            (sale.client_name or "").replace(",", " "),
            sale.client_tax_id or "",
            sale.client_phone or "",
            sale.client_email or "",
            (sale.client_address or "").replace(",", " "),
            (sale.notes or "").replace(",", " "),
        ]
        lines.append(",".join(values))
    return StreamingResponse(iter(["\n".join(lines)]), media_type="text/csv")


@app.get("/")
def root():
    return {
        "message": "Sahocars API operativa",
        "docs": "/docs",
        "health": "/health",
    }
