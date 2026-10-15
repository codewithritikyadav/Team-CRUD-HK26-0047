"""Read-only analysis endpoints: summary, what-if, recommendations, CSV report."""
import csv, io
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
from .. import schemas as s
from ..database import get_db
from ..engine import compare, scenario_to_dict, summarize
from ..recommendations import generate
from .facilities import _get
from ..models import Facility

router = APIRouter(prefix="/facilities/{fid}")


@router.get("/summary")
def summary(fid: int, db: Session = Depends(get_db)):
    return summarize(_get(db, Facility, fid, "Facility"))


@router.post("/simulate")
def simulate(fid: int, body: s.Scenario, db: Session = Depends(get_db)):
    return compare(_get(db, Facility, fid, "Facility"), scenario_to_dict(body))


@router.get("/recommendations")
def recommendations(fid: int, db: Session = Depends(get_db)):
    f = _get(db, Facility, fid, "Facility")
    return generate(f, f.records)


@router.get("/report.csv")
def report(fid: int, db: Session = Depends(get_db)):
    f = _get(db, Facility, fid, "Facility")
    sm, buf = summarize(f), io.StringIO()
    w = csv.writer(buf)
    w.writerow(["WattWise AI report - ESTIMATED values (not meter readings)"])
    w.writerow(["Facility", f.name, "Type", f.facility_type, "Period", f.reporting_period])
    w.writerow(["Tariff (INR/kWh) [assumption]", f.tariff_per_kwh])
    w.writerow(["Emissions factor (kg CO2/kWh)", f.emissions_factor, "Source", f.emissions_factor_source])
    w.writerow([])
    w.writerow(["Section", "Appliance", "Category", "Total qty", "Hours/day", "Days/month", "kWh/month", "Cost (INR)", "CO2 (kg)"])
    for a in sm["appliances_ranked"]:
        w.writerow([a["section_name"], a["name"], a["category"], a["total_quantity"], a["hours_per_day"],
                    a["days_per_month"], round(a["kwh"], 2), round(a["cost"], 2), round(a["co2_kg"], 2)])
    t = sm["totals"]
    w.writerow([]); w.writerow(["TOTAL (estimated)", "", "", "", "", "", round(t["kwh"], 2), round(t["cost"], 2), round(t["co2_kg"], 2)])
    w.writerow([]); w.writerow(["Recommendations (potential, not achieved savings)"])
    w.writerow(["Title", "Reason", "kWh/month", "INR/month", "kg CO2/month", "Assumptions"])
    for r in generate(f, f.records):
        i = r["impact"] or {}
        w.writerow([r["title"], r["reason"], i.get("kwh", ""), i.get("cost", ""), i.get("co2_kg", ""), r["assumptions"]])
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="wattwise_{f.id}_report.csv"'})
