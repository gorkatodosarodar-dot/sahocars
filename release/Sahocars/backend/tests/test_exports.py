from __future__ import annotations


def test_export_vehicles_csv(app_context):
    client, _tmp_path = app_context

    response = client.get("/export/vehicles")
    assert response.status_code == 200
    assert "text/csv" in response.headers.get("content-type", "")
