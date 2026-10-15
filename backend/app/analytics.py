"""Historical-record analysis: estimate-vs-actual, carbon trend, anomalies, observed savings."""
from statistics import mean, median
from .engine import summarize

MIN_FOR_ANOMALY = 6  # don't flag anomalies on thin data


def _days(r):
    return (r.period_end - r.period_start).days + 1


def _monthly(r):
    """Normalise to a 30-day month so periods of different length are comparable."""
    return r.energy_kwh / _days(r) * 30


def _anomalies(values):
    """Modified z-score (median/MAD). Returns list of scores, or None if not enough data/variation."""
    if len(values) < MIN_FOR_ANOMALY:
        return None
    med = median(values)
    mad = median(abs(v - med) for v in values)
    if mad == 0:
        return None
    return [0.6745 * (v - med) / mad for v in values]


def history_analysis(f, records):
    est = summarize(f)
    est_sec = {s["id"]: s["kwh"] for s in est["sections"]}
    rows = sorted(records, key=lambda r: r.period_start)

    # anomaly scores computed per scope (facility-level vs each section) so scopes are never mixed
    scores = {}
    for scope in {r.section_id for r in rows}:
        grp = [r for r in rows if r.section_id == scope]
        z = _anomalies([_monthly(r) for r in grp])
        for i, r in enumerate(grp):
            scores[r.id] = z[i] if z else None

    out = []
    for r in rows:
        m = _monthly(r)
        estimate = est_sec.get(r.section_id) if r.section_id else est["totals"]["kwh"]
        gap = (m - estimate) if estimate is not None else None
        z = scores.get(r.id)
        out.append({
            "id": r.id, "period_start": r.period_start.isoformat(), "period_end": r.period_end.isoformat(),
            "days": _days(r), "label": r.source_type, "section_id": r.section_id, "meter_id": r.meter_id,
            "actual_kwh": r.energy_kwh, "actual_monthly_kwh": round(m, 2), "cost": r.cost,
            "co2_kg": round(r.energy_kwh * f.emissions_factor, 2),
            "estimate_monthly_kwh": round(estimate, 2) if estimate is not None else None,
            "gap_kwh": round(gap, 2) if gap is not None else None,
            "gap_pct": round(gap / estimate * 100, 1) if gap is not None and estimate else None,
            "anomaly": bool(z is not None and abs(z) >= 3.5),
            "anomaly_score": round(z, 2) if z is not None else None,
        })

    fac = [o for o in out if o["section_id"] is None and o["gap_pct"] is not None]
    summary = {
        "records": len(out),
        "avg_gap_pct": round(mean(o["gap_pct"] for o in fac), 1) if fac else None,
        "anomaly_status": ("ok" if any(v is not None for v in scores.values())
                           else f"Needs at least {MIN_FOR_ANOMALY} records with some variation"),
        "anomaly_count": sum(o["anomaly"] for o in out),
        "total_actual_kwh": round(sum(o["actual_kwh"] for o in out), 2),
        "total_co2_kg": round(sum(o["co2_kg"] for o in out), 2),
        "explanation": ("A gap between estimate and actual can come from wrong power assumptions, missing appliances, "
                        "variable load or different measurement boundaries. It is not automatically wasted electricity. "
                        "Flagged anomalies are unusual readings to investigate, not proof of waste."),
    }
    return {"records": out, "summary": summary, "observed_savings": _observed(f, rows)}


def _observed(f, rows):
    """Before/after comparison around facility.action_date using only real readings."""
    if not f.action_date:
        return {"available": False, "reason": "Set the date your energy-saving actions began."}
    fac = [r for r in rows if r.section_id is None]
    before = [_monthly(r) for r in fac if r.period_end < f.action_date]
    after = [_monthly(r) for r in fac if r.period_start >= f.action_date]
    if not before or not after:
        return {"available": False, "reason": "Need facility-level records both before and after the action date."}
    b, a = mean(before), mean(after)
    return {
        "available": True, "label": "observed", "action_date": f.action_date.isoformat(),
        "before_avg_kwh": round(b, 1), "after_avg_kwh": round(a, 1), "n_before": len(before), "n_after": len(after),
        "change_kwh": round(b - a, 1), "change_pct": round((b - a) / b * 100, 1),
        "co2_change_kg": round((b - a) * f.emissions_factor, 1),
        "caveat": ("Raw before/after difference (30-day normalised). Not adjusted for weather, occupancy or "
                   "schedule changes" + ("; fewer than 3 readings in one period, so treat as indicative." if min(len(before), len(after)) < 3 else ".")),
    }
