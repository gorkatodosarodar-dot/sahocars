from __future__ import annotations

from datetime import date


def _create_vehicle(client, license_plate: str, branch_id: int):
    payload = {
        "vin": f"VIN-{license_plate}",
        "license_plate": license_plate,
        "brand": "Test",
        "model": "Report",
        "year": 2021,
        "km": 500,
        "branch_id": branch_id,
        "purchase_date": date.today().isoformat(),
        "status": "published",
    }
    response = client.post("/vehicles", json=payload)
    assert response.status_code == 200
    return response.json()


def _add_expense(client, plate: str, amount: float, category: str):
    payload = {
        "amount": amount,
        "currency": "EUR",
        "date": date.today().isoformat(),
        "category": category,
    }
    response = client.post(f"/vehicles/{plate}/expenses", json=payload)
    assert response.status_code == 201


def _close_sale(client, plate: str, sale_price: float):
    payload = {
        "sale_price": sale_price,
        "sold_at": date.today().isoformat(),
        "sale_notes": "test",
    }
    response = client.post(f"/vehicles/{plate}/sale", json=payload)
    assert response.status_code == 200


def test_reports_kpis_basic(app_context):
    client, _tmp_path = app_context

    branches = client.get("/branches").json()
    branch_id = branches[0]["id"]

    v1 = _create_vehicle(client, "KPIS1", branch_id)
    v2 = _create_vehicle(client, "KPIS2", branch_id)

    _add_expense(client, v1["license_plate"], 6000.0, "PURCHASE")
    _add_expense(client, v1["license_plate"], 500.0, "OTHER")
    _add_expense(client, v2["license_plate"], 5000.0, "PURCHASE")
    _add_expense(client, v2["license_plate"], 200.0, "OTHER")

    _close_sale(client, v1["license_plate"], 10000.0)
    _close_sale(client, v2["license_plate"], 8000.0)

    today = date.today().isoformat()
    rows_resp = client.get(f"/reports/vehicles?from={today}&to={today}")
    assert rows_resp.status_code == 200
    rows = rows_resp.json()

    resp = client.get(f"/reports/kpis?from={today}&to={today}")
    assert resp.status_code == 200
    data = resp.json()

    expected_income = sum(row["sale_price"] or 0 for row in rows)
    expected_purchase = sum(row["purchase_price"] or 0 for row in rows)
    expected_expenses = sum(row["total_expenses"] or 0 for row in rows)
    expected_profit = sum(row["profit"] or 0 for row in rows)

    assert data["vehicles_sold"] == len(rows)
    assert data["total_income"] == expected_income
    assert data["total_purchase"] == expected_purchase
    assert data["total_expenses"] == expected_expenses
    assert data["total_profit"] == expected_profit
