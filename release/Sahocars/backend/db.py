from __future__ import annotations

from sqlmodel import SQLModel, Session, create_engine

from app.config import get_database_url

DATABASE_URL = get_database_url()

engine = (
    create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    if DATABASE_URL.startswith("sqlite")
    else create_engine(DATABASE_URL)
)


def get_session():
    """Yield a database session for dependency injection."""
    with Session(engine) as session:
        yield session


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
