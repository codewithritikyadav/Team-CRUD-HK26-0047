"""Demo data. Everything here is SIMULATED and labelled that way."""
import math
from datetime import date, timedelta
from .models import Appliance, Facility, HistoricalRecord, Section
from .engine import summarize

SECTIONS = [
    # name, type, rooms, days, start, end, [(name, cat, qty_per_room, watts, hours)]
    ("Classrooms", "Classroom block", 10, 26, "09:00", "16:00",
     [("Ceiling fan", "cooling", 4, 75, 7), ("LED tube light", "lighting", 6, 20, 7), ("Projector", "computing", 1, 250, 3)]),
    ("Computer labs", "Computer laboratory", 2, 26, "09:00", "18:00",
     [("Desktop computer", "computing", 30, 150, 8), ("Split AC 1.5 ton", "cooling", 2, 1500, 8),
      ("LED tube light", "lighting", 10, 20, 9), ("Ceiling fan", "cooling", 4, 75, 9)]),
    ("Faculty offices", "Office", 4, 26, "09:00", "17:00",
     [("Laptop", "computing", 3, 60, 8), ("Split AC 1.5 ton", "cooling", 1, 1500, 7), ("LED tube light", "lighting", 4, 20, 8),
      ("Water cooler", "appliance", 1, 300, 10)]),
    ("Seminar hall", "Seminar hall", 1, 12, "10:00", "17:00",
     [("Split AC 1.5 ton", "cooling", 4, 1500, 5), ("LED tube light", "lighting", 20, 20, 6), ("Projector", "computing", 2, 250, 4)]),
]


def create_demo(db):
    f = Facility(name="Demo Institute (simulated)", facility_type="institution", location="Demo campus",
                 tariff_per_kwh=8.0, emissions_factor=0.716,
                 emissions_factor_source="CEA CO2 Baseline Database (India grid average) - verify the latest published value")
    db.add(f); db.flush()
    for name, typ, rooms, days, st, en, apps in SECTIONS:
        s = Section(facility_id=f.id, name=name, section_type=typ, room_count=rooms, operating_days=days, start_time=st, end_time=en)
        db.add(s); db.flush()
        for n, c, q, w, h in apps:
            db.add(Appliance(section_id=s.id, name=n, category=c, quantity_per_room=q, rated_power_watts=w, hours_per_day=h, days_per_month=days))
    db.flush(); db.refresh(f)

    # 12 months of SIMULATED readings: ~8% above estimate, seasonal curve, one spike, savings after month 9.
    base = summarize(f)["totals"]["kwh"] * 1.08
    start = date.today().replace(day=1)
    months = []
    y, m = start.year, start.month
    for _ in range(12):
        m -= 1
        if m == 0: y, m = y - 1, 12
        months.append(date(y, m, 1))
    months.reverse()
    action = months[9]
    f.action_date = action
    for i, d in enumerate(months):
        nxt = (d.replace(day=28) + timedelta(days=4)).replace(day=1)
        kwh = base * (1 + 0.04 * math.sin((i - 2) / 12 * 2 * math.pi)) * (1 + 0.015 * ((i * 7) % 5 - 2))
        if i == 5: kwh *= 1.6                   # unusual month to demo anomaly detection
        if i >= 9: kwh *= 0.92                  # post-action drop
        db.add(HistoricalRecord(facility_id=f.id, period_start=d, period_end=nxt - timedelta(days=1),
                                energy_kwh=round(kwh, 1), cost=round(kwh * 8.2, 0), source_type="simulated"))
    db.commit()
    return f
