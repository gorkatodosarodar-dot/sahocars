from __future__ import annotations

import os
from sqlmodel import SQLModel, Session, create_engine

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///sahocars.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}) if DATABASE_URL.startswith("sqlite") else create_engine(DATABASE_URL)


def get_session():
    """Yield a database session for dependency injection."""
    with Session(engine) as session:
        yield session


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
