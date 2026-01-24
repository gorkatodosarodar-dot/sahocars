from __future__ import annotations

import sys
import os
from uuid import uuid4
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel


@pytest.fixture()
def app_context(monkeypatch: pytest.MonkeyPatch):
    base_temp = os.getenv("TEMP") or os.getenv("TMP") or str(Path.cwd())
    base_dir = Path(base_temp) / "sahocars_pytest"
    base_dir.mkdir(parents=True, exist_ok=True)
    data_dir = base_dir / f"sahocars-test-{uuid4().hex}"
    data_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("SAHOCARS_DATA_DIR", str(data_dir))
    monkeypatch.setenv("SAHOCARS_ENV", "test")
    monkeypatch.setenv("SAHOCARS_SKIP_LEGACY_MIGRATION", "true")

    for module_name in ("main", "db", "app.config", "app.paths", "app.migrations"):
        sys.modules.pop(module_name, None)

    SQLModel.metadata.clear()

    import main

    with TestClient(main.app) as client:
        yield client, data_dir
