from __future__ import annotations

import os
import shutil
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from sqlmodel import Field, Session, SQLModel, select

from db import create_db_and_tables, engine, get_session
from models.vehicle import Vehicle, VehicleStatus
from routers.vehicles import router as vehicles_router

STORAGE_ROOT = Path(os.getenv("STORAGE_ROOT", "storage")).resolve()


class Branch(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str


class Expense(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    vehicle_id: int = Field(foreign_key="vehicle.id")
    concept: str
    amount: float
    expense_date: date
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Sale(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    vehicle_id: int = Field(foreign_key="vehicle.id", unique=True)
    sale_price: float
    sale_date: date
    notes: Optional[str] = None
    client_name: Optional[str] = None
    client_tax_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    vehicle_id: int = Field(foreign_key="vehicle.id")
    doc_type: str
    file_name: str
    stored_path: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = None


class Photo(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    vehicle_id: int = Field(foreign_key="vehicle.id")
    file_name: str
    stored_path: str
    display_order: Optional[int] = None
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)


class Transfer(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    vehicle_id: int = Field(foreign_key="vehicle.id")
    from_branch_id: Optional[int] = Field(default=None, foreign_key="branch.id")
    to_branch_id: int = Field(foreign_key="branch.id")
    transfer_date: date
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


app = FastAPI(title="Sahocars API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def init_db():
    create_db_and_tables()
    with Session(engine) as session:
        existing = session.exec(select(Branch)).all()
        if not existing:
            session.add_all([Branch(name="Montgat"), Branch(name="Juneda")])
            session.commit()


@app.on_event("startup")
def on_startup():
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    init_db()


@app.get("/health")
def healthcheck():
    return {"status": "ok"}


@app.get("/branches", response_model=List[Branch])
def list_branches(session: Session = Depends(get_session)):
    return session.exec(select(Branch)).all()


@app.post("/branches", response_model=Branch, status_code=201)
def create_branch(branch: Branch, session: Session = Depends(get_session)):
    name = branch.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre de la sucursal es obligatorio")
    new_branch = Branch(name=name)
    session.add(new_branch)
    session.commit()
    session.refresh(new_branch)
    return new_branch


app.include_router(vehicles_router)


@app.post("/vehicles/{vehicle_id}/transfer", response_model=Transfer)
def transfer_vehicle(
    vehicle_id: int,
    transfer: Transfer,
    session: Session = Depends(get_session),
):
    vehicle = session.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    transfer.vehicle_id = vehicle_id
    session.add(transfer)
    vehicle.branch_id = transfer.to_branch_id
    vehicle.updated_at = datetime.utcnow()
    session.add(vehicle)
    session.commit()
    session.refresh(transfer)
    return transfer


@app.get("/vehicles/{vehicle_id}/expenses", response_model=List[Expense])
def list_expenses(vehicle_id: int, session: Session = Depends(get_session)):
    return session.exec(select(Expense).where(Expense.vehicle_id == vehicle_id).order_by(Expense.expense_date.desc())).all()


@app.post("/vehicles/{vehicle_id}/expenses", response_model=Expense)
def add_expense(vehicle_id: int, expense: Expense, session: Session = Depends(get_session)):
    if not session.get(Vehicle, vehicle_id):
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    expense.vehicle_id = vehicle_id
    session.add(expense)
    session.commit()
    session.refresh(expense)
    return expense


@app.post("/vehicles/{vehicle_id}/sale", response_model=Sale)
def register_sale(vehicle_id: int, sale: Sale, session: Session = Depends(get_session)):
    vehicle = session.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    sale.vehicle_id = vehicle_id
    vehicle.sale_price = sale.sale_price
    vehicle.sale_date = sale.sale_date
    vehicle.status = VehicleStatus.SOLD
    vehicle.updated_at = datetime.utcnow()
    session.add(sale)
    session.add(vehicle)
    session.commit()
    session.refresh(sale)
    return sale


@app.get("/vehicles/{vehicle_id}/documents", response_model=List[Document])
def list_documents(vehicle_id: int, session: Session = Depends(get_session)):
    return session.exec(select(Document).where(Document.vehicle_id == vehicle_id).order_by(Document.uploaded_at.desc())).all()


@app.post("/vehicles/{vehicle_id}/documents", response_model=Document)
def upload_document(
    vehicle_id: int,
    doc_type: str = Query(..., description="tipo de documento"),
    notes: Optional[str] = Query(None),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    vehicle = session.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    storage_path = STORAGE_ROOT / "vehiculos" / str(vehicle_id) / "documentos"
    storage_path.mkdir(parents=True, exist_ok=True)
    safe_name = os.path.basename(file.filename)
    destination = storage_path / safe_name
    with destination.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    record = Document(
        vehicle_id=vehicle_id,
        doc_type=doc_type,
        file_name=safe_name,
        stored_path=str(destination),
        notes=notes,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


@app.get("/vehicles/{vehicle_id}/photos", response_model=List[Photo])
def list_photos(vehicle_id: int, session: Session = Depends(get_session)):
    return session.exec(select(Photo).where(Photo.vehicle_id == vehicle_id).order_by(Photo.display_order, Photo.uploaded_at)).all()


@app.post("/vehicles/{vehicle_id}/photos", response_model=Photo)
def upload_photo(
    vehicle_id: int,
    display_order: Optional[int] = Query(None),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    vehicle = session.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")
    existing_count = len(session.exec(select(Photo).where(Photo.vehicle_id == vehicle_id)).all())
    if existing_count >= 100:
        raise HTTPException(status_code=400, detail="Limite de 100 fotos alcanzado")
    storage_path = STORAGE_ROOT / "vehiculos" / str(vehicle_id) / "fotos"
    storage_path.mkdir(parents=True, exist_ok=True)
    safe_name = os.path.basename(file.filename)
    destination = storage_path / safe_name
    with destination.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    photo = Photo(
        vehicle_id=vehicle_id,
        file_name=safe_name,
        stored_path=str(destination),
        display_order=display_order,
    )
    session.add(photo)
    session.commit()
    session.refresh(photo)
    return photo


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
    vehicles_query = select(Vehicle)
    if branch_id:
        vehicles_query = vehicles_query.where(Vehicle.branch_id == branch_id)
    vehicles = session.exec(vehicles_query).all()
    vehicle_ids = [v.id for v in vehicles if v.id is not None]

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


@app.get("/export/vehicles")
def export_vehicles(session: Session = Depends(get_session)):
    vehicles = session.exec(select(Vehicle).order_by(Vehicle.id)).all()
    headers = [
        "id",
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
        "purchase_price",
        "purchase_date",
        "sale_price",
        "sale_date",
    ]
    lines = [",".join(headers)]
    for v in vehicles:
        values = [
            str(v.id or ""),
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
            str(v.purchase_price or ""),
            v.purchase_date.isoformat() if v.purchase_date else "",
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
    headers = ["id", "vehicle_id", "sale_price", "sale_date", "client_name", "client_tax_id", "notes"]
    lines = [",".join(headers)]
    for sale in sales:
        values = [
            str(sale.id or ""),
            str(sale.vehicle_id),
            str(sale.sale_price),
            sale.sale_date.isoformat(),
            (sale.client_name or "").replace(",", " "),
            sale.client_tax_id or "",
            (sale.notes or "").replace(",", " "),
        ]
        lines.append(",".join(values))
    return StreamingResponse(iter(["\n".join(lines)]), media_type="text/csv")
