"""Rule-based recommendations. Every number comes from engine.compare() on a stated assumption."""
from .engine import compare, summarize
from .analytics import history_analysis

LED_GAIN = 40      # % power reduction assumed when moving lighting to efficient LED
COOLING_GAIN = 25  # % power reduction assumed for higher-efficiency cooling
LIGHT_SHARE, COOL_SHARE, SECTION_SHARE, GAP_PCT = 20, 25, 35, 15


def _impact(f, scenario):
    s = compare(f, scenario)["savings"]
    return {"kwh": round(s["kwh"], 1), "cost": round(s["cost"], 0), "co2_kg": round(s["co2_kg"], 1),
            "annual_cost": round(s["annual_cost"], 0), "annual_co2_kg": round(s["annual_co2_kg"], 0)}


def _by_category(summary, cat):
    return [a for a in summary["appliances_ranked"] if a["category"] == cat]


def generate(f, records):
    base = summarize(f)
    total = base["totals"]["kwh"]
    recs = []
    if total <= 0:
        return [{"id": "empty", "title": "Add appliances to get recommendations", "severity": "info",
                 "reason": "No estimated consumption yet.", "action": "Add sections and appliances in Inventory.",
                 "affected": None, "impact": None, "assumptions": "", "scenario": None}]

    # 1. Lighting share
    for cat, gain, share_thr, title, action in (
        ("lighting", LED_GAIN, LIGHT_SHARE, "Review lighting schedules and efficiency",
         "Check lights left on outside use hours and evaluate efficient LED/ sensor-based alternatives."),
        ("cooling", COOLING_GAIN, COOL_SHARE, "Evaluate higher-efficiency cooling",
         "Check thermostat set-points and compare a higher star-rating / inverter option. Keep required comfort and ventilation."),
    ):
        apps = _by_category(base, cat)
        share = sum(a["kwh"] for a in apps) / total * 100
        if apps and share >= share_thr:
            sc = {"appliances": {a["id"]: {"efficiency_gain_pct": gain} for a in apps}, "sections": {}}
            recs.append({"id": f"{cat}-share", "severity": "medium", "title": title,
                         "reason": f"{cat.capitalize()} makes up {share:.0f}% of estimated usage (threshold {share_thr}%).",
                         "action": action, "affected": f"{len(apps)} {cat} appliance entries", "impact": _impact(f, sc),
                         "assumptions": f"Assumes a {gain}% reduction in average power draw - replace with your product's data.",
                         "scenario": sc})

    # 2. Long-running high-energy appliance
    for a in base["appliances_ranked"][:5]:
        if a["category"] not in ("appliance",) and a["hours_per_day"] >= 6 and a["share_pct"] >= 8:
            sc = {"appliances": {a["id"]: {"hours_per_day": max(0.0, a["hours_per_day"] - 1)}}, "sections": {}}
            recs.append({"id": f"hours-{a['id']}", "severity": "medium",
                         "title": f"Check if all {a['hours_per_day']:.0f} daily hours of '{a['name']}' are needed",
                         "reason": f"It is one of the top consumers ({a['share_pct']:.0f}% of estimated total) and runs {a['hours_per_day']:.1f} h/day.",
                         "action": "Review schedules, auto-off timers and idle periods. Do not cut required cooling, ventilation or safety equipment.",
                         "affected": f"{a['name']} in {a['section_name']}", "impact": _impact(f, sc),
                         "assumptions": "Models a 1 hour/day reduction; the real opportunity depends on actual use.", "scenario": sc})
            break

    # 3. Dominant section
    top = base["sections"] and max(base["sections"], key=lambda s: s["kwh"])
    if top and len(base["sections"]) > 1 and top["share_pct"] >= SECTION_SHARE:
        sc = {"appliances": {}, "sections": {top["id"]: {"hours_scale": 0.9}}}
        recs.append({"id": "top-section", "severity": "high", "title": f"Prioritise '{top['name']}' for an energy audit",
                     "reason": f"It accounts for {top['share_pct']:.0f}% of estimated facility usage.",
                     "action": "Walk the section, verify appliance counts, ratings and real operating hours.",
                     "affected": top["name"], "impact": _impact(f, sc),
                     "assumptions": "Impact shown models a 10% cut in operating hours across this section.", "scenario": sc})

    # 4-5. Historical evidence
    if records:
        h = history_analysis(f, records)
        gap = h["summary"]["avg_gap_pct"]
        if gap is not None and abs(gap) >= GAP_PCT:
            direction = "higher" if gap > 0 else "lower"
            recs.append({"id": "history-gap", "severity": "info", "title": "Calibrate your appliance inventory",
                         "reason": f"Actual meter/bill readings average {abs(gap):.0f}% {direction} than your estimate.",
                         "action": "Look for missing appliances, wrong power ratings or hours. Do not read the gap as waste.",
                         "affected": "Whole facility", "impact": None,
                         "assumptions": "Records normalised to a 30-day month; only facility-level records used.", "scenario": None})
        n = h["summary"]["anomaly_count"]
        if n:
            months = ", ".join(r["period_start"][:7] for r in h["records"] if r["anomaly"])
            recs.append({"id": "history-anomaly", "severity": "high", "title": "Investigate unusual readings",
                         "reason": f"{n} reading(s) deviate strongly from the usual pattern ({months}).",
                         "action": "Check events, equipment faults, schedule changes or meter issues for those periods.",
                         "affected": "Historical records", "impact": None,
                         "assumptions": "Statistical outlier (modified z-score >= 3.5). Cause is unknown without evidence.", "scenario": None})
    return recs
