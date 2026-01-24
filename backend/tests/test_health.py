from __future__ import annotations

from pathlib import Path


def test_health_ok(app_context):
    client, data_dir = app_context

    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()

    assert payload["ok"] is True
    assert payload["checks"]["db_readwrite"] == "ok"
    assert payload["checks"]["storage_readwrite"] == "ok"
    assert payload["checks"]["backups_readwrite"] == "ok"
    assert payload["checks"]["migrations"] == "ok"

    reported_dir = Path(payload["data_dir"]).resolve()
    assert reported_dir == data_dir.resolve()
