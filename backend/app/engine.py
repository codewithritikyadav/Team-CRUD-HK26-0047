"""THE calculation engine. Dashboard, simulator, recommendations and reports all call this file.

kWh/day   = quantity_per_room x room_count x watts x hours / 1000
kWh/month = kWh/day x operating days
cost      = kWh x tariff
CO2 (kg)  = kWh x emissions factor
"""
from collections import defaultdict


def appliance_energy(quantity_per_room, room_count, watts, hours, days, efficiency_gain_pct=0.0):
    total_qty = quantity_per_room * room_count          # rooms multiplied exactly once
    eff_watts = watts * (1 - efficiency_gain_pct / 100)
    daily = total_qty * eff_watts * hours / 1000
    return {"total_quantity": total_qty, "daily_kwh": daily, "monthly_kwh": daily * days}


def _money(kwh, f):
    return kwh * f.tariff_per_kwh


def _co2(kwh, f):
    return kwh * f.emissions_factor


def summarize(f, scenario=None):
    """Aggregate a facility. `scenario` = {"appliances": {id: {...}}, "sections": {id: {...}}} (dicts)."""
    scenario = scenario or {}
    a_ov, s_ov = scenario.get("appliances", {}), scenario.get("sections", {})
    sections, flat, by_cat = [], [], defaultdict(float)

    for s in f.sections:
        so = s_ov.get(s.id, {})
        scale = so.get("hours_scale")
        scale = 1.0 if scale is None else scale
        apps, sec_kwh = [], 0.0
        for a in s.appliances:
            ao = {k: v for k, v in a_ov.get(a.id, {}).items() if v is not None}
            hours = min(24.0, ao.get("hours_per_day", a.hours_per_day) * scale)
            days = ao.get("days_per_month", so.get("days_per_month") or a.days_per_month)
            r = appliance_energy(
                ao.get("quantity_per_room", a.quantity_per_room), s.room_count,
                ao.get("rated_power_watts", a.rated_power_watts), hours, days,
                ao.get("efficiency_gain_pct", 0.0),
            )
            row = {
                "id": a.id, "name": a.name, "category": a.category, "section_id": s.id, "section_name": s.name,
                "total_quantity": r["total_quantity"], "hours_per_day": round(hours, 2), "days_per_month": days,
                "daily_kwh": r["daily_kwh"], "kwh": r["monthly_kwh"],
            }
            apps.append(row)
            sec_kwh += r["monthly_kwh"]
            by_cat[a.category] += r["monthly_kwh"]
        sections.append({"id": s.id, "name": s.name, "section_type": s.section_type, "room_count": s.room_count,
                         "kwh": sec_kwh, "appliances": apps})
        flat.extend(apps)

    total = sum(s["kwh"] for s in sections)
    for s in sections:
        s["share_pct"] = (s["kwh"] / total * 100) if total else 0.0
        s["cost"], s["co2_kg"] = _money(s["kwh"], f), _co2(s["kwh"], f)
    for a in flat:
        a["share_pct"] = (a["kwh"] / total * 100) if total else 0.0
        a["cost"], a["co2_kg"] = _money(a["kwh"], f), _co2(a["kwh"], f)

    return {
        "label": "estimated",
        "totals": {"kwh": total, "cost": _money(total, f), "co2_kg": _co2(total, f),
                   "annual_kwh": total * 12, "annual_cost": _money(total, f) * 12, "annual_co2_kg": _co2(total, f) * 12},
        "sections": sections,
        "appliances_ranked": sorted(flat, key=lambda x: x["kwh"], reverse=True),
        "by_category": [{"category": k, "kwh": v, "co2_kg": _co2(v, f), "share_pct": (v / total * 100) if total else 0}
                        for k, v in sorted(by_cat.items(), key=lambda kv: -kv[1])],
        "assumptions": {"tariff_per_kwh": f.tariff_per_kwh, "emissions_factor": f.emissions_factor,
                        "emissions_factor_source": f.emissions_factor_source,
                        "notes": ["Rated power is used as average power - real draw varies (esp. AC).",
                                  "Cost is energy charge only (no fixed charges, taxes or slabs).",
                                  "CO2 covers electricity only, not a full carbon footprint."]},
    }


def compare(f, scenario):
    """Baseline vs scenario using the same engine. Values are PROJECTED, never achieved."""
    base, scen = summarize(f), summarize(f, scenario)
    bt, st = base["totals"], scen["totals"]
    saving = {k: bt[k] - st[k] for k in ("kwh", "cost", "co2_kg", "annual_kwh", "annual_cost", "annual_co2_kg")}
    saving["pct"] = (saving["kwh"] / bt["kwh"] * 100) if bt["kwh"] else 0.0
    sec_scen = {s["id"]: s for s in scen["sections"]}
    per_section = [{"id": s["id"], "name": s["name"], "baseline_kwh": s["kwh"], "scenario_kwh": sec_scen[s["id"]]["kwh"],
                    "saving_kwh": s["kwh"] - sec_scen[s["id"]]["kwh"]} for s in base["sections"]]
    return {"label": "simulated", "baseline": base, "scenario": scen, "savings": saving, "per_section": per_section}


def scenario_to_dict(sc):
    """Pydantic Scenario -> plain dict with only the fields the user changed."""
    return {
        "appliances": {i: o.model_dump(exclude_none=True) for i, o in sc.appliances.items()},
        "sections": {i: o.model_dump(exclude_none=True) for i, o in sc.sections.items()},
    }
