from __future__ import annotations

import io
from datetime import date


def _create_vehicle(client, license_plate: str, branch_id: int):
    payload = {
        "vin": f"VIN-{license_plate}",
        "license_plate": license_plate,
        "brand": "Test",
        "model": "Backup",
        "year": 2020,
        "km": 1000,
        "branch_id": branch_id,
        "purchase_date": date.today().isoformat(),
        "version": None,
        "color": None,
        "status": "intake",
    }
    response = client.post("/vehicles", json=payload)
    assert response.status_code == 200
    return response.json()


def test_backup_restore_smoke(app_context):
    client, _tmp_path = app_context

    branches = client.get("/branches").json()
    branch_id = branches[0]["id"]

    vehicle = _create_vehicle(client, "ABC123", branch_id)

    expense_payload = {
        "amount": 120.0,
        "currency": "EUR",
        "date": date.today().isoformat(),
        "category": "OTHER",
        "vendor": "Test",
        "notes": "Gasto",
    }
    expense_res = client.post(f"/vehicles/{vehicle['license_plate']}/expenses", json=expense_payload)
    assert expense_res.status_code == 201
    expense_id = expense_res.json()["id"]

    file_res = client.post(
        f"/vehicles/{vehicle['license_plate']}/files",
        data={"category": "document"},
        files={"file": ("nota.txt", io.BytesIO(b"backup-test"), "text/plain")},
    )
    assert file_res.status_code == 200
    files_list = client.get(f"/vehicles/{vehicle['license_plate']}/files").json()
    assert files_list
    file_id = files_list[0]["id"]

    backup_res = client.post("/admin/backups", json={"include_files": True})
    assert backup_res.status_code == 200
    backup_id = backup_res.json()["id"]

    del_file = client.delete(f"/vehicles/{vehicle['license_plate']}/files/{file_id}")
    assert del_file.status_code == 200
    del_expense = client.delete(f"/vehicles/{vehicle['license_plate']}/expenses/{expense_id}")
    assert del_expense.status_code == 200

    restore_res = client.post(f"/admin/backups/{backup_id}/restore", json={"dry_run": True})
    assert restore_res.status_code == 200
    assert restore_res.json()["restored"] is False
