"""Run: pytest   (PRD acceptance tests: fans example, scenario savings, API validation)"""
import os, tempfile
os.chdir(tempfile.mkdtemp())  # isolated sqlite file
from fastapi.testclient import TestClient
from app.engine import appliance_energy
from app.main import app

c = TestClient(app)


def test_fan_example():
    r = appliance_energy(4, 1, 75, 6, 26)
    assert round(r["daily_kwh"], 2) == 1.8 and round(r["monthly_kwh"], 2) == 46.8


def test_rooms_multiplied_once():
    assert appliance_energy(4, 10, 75, 6, 26)["total_quantity"] == 40


def _facility():
    f = c.post("/api/facilities", json={"name": "T", "facility_type": "office", "tariff_per_kwh": 8, "emissions_factor": 0.5}).json()
    s = c.post(f"/api/facilities/{f['id']}/sections", json={"name": "S", "room_count": 1}).json()
    a = c.post(f"/api/sections/{s['id']}/appliances", json={"name": "Heater", "quantity_per_room": 1, "rated_power_watts": 1000,
                                                             "hours_per_day": 10, "days_per_month": 100 // 4 if False else 25}).json()
    return f["id"], s["id"], a["id"]


def test_scenario_savings():
    fid, sid, aid = _facility()          # 1 kW x 10 h x 25 d = 250 kWh
    base = c.get(f"/api/facilities/{fid}/summary").json()["totals"]
    assert base["kwh"] == 250 and base["cost"] == 2000 and base["co2_kg"] == 125
    r = c.post(f"/api/facilities/{fid}/simulate", json={"appliances": {aid: {"hours_per_day": 9}}}).json()
    assert round(r["savings"]["kwh"], 6) == 25 and round(r["savings"]["cost"], 6) == 200 and round(r["savings"]["co2_kg"], 6) == 12.5
    r0 = c.post(f"/api/facilities/{fid}/simulate", json={}).json()
    assert r0["savings"]["kwh"] == 0


def test_validation():
    fid, sid, _ = _facility()
    bad = {"name": "x", "quantity_per_room": 0, "rated_power_watts": -5, "hours_per_day": 30}
    assert c.post(f"/api/sections/{sid}/appliances", json=bad).status_code == 422
    assert c.get("/api/facilities/9999/summary").status_code == 404


def test_demo_history_and_recs():
    f = c.post("/api/demo").json()
    fid = f["id"]
    h = c.get(f"/api/facilities/{fid}/history/analysis").json()
    assert h["summary"]["records"] == 12 and h["summary"]["anomaly_count"] >= 1
    assert h["observed_savings"]["available"]
    recs = c.get(f"/api/facilities/{fid}/recommendations").json()
    assert recs and all(r["reason"] for r in recs)
    assert c.get(f"/api/facilities/{fid}/report.csv").status_code == 200


def test_csv_import_and_duplicates():
    fid, *_ = _facility()
    csv_text = "period_start,period_end,energy_kwh\n2025-01-01,2025-01-31,300\n2025-01-01,2025-01-31,300\n2025-02-01,bad,10\n"
    r = c.post(f"/api/facilities/{fid}/history/csv", files={"file": ("h.csv", csv_text)}).json()
    assert r["added"] == 1 and len(r["errors"]) == 2
