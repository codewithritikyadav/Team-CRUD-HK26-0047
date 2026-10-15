"""Historical electricity records: manual entry, CSV import, analysis."""
import csv, io
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import ValidationError
from sqlalchemy.orm import Session
from .. import models as m, schemas as s
from ..analytics import history_analysis
from ..database import get_db
from .facilities import _get

router = APIRouter(prefix="/facilities/{fid}/history")


def _exists(db, fid, r: s.RecordIn):
    return db.query(m.HistoricalRecord).filter_by(
        facility_id=fid, section_id=r.section_id, period_start=r.period_start, period_end=r.period_end).first()


@router.get("", response_model=list[s.RecordOut])
def list_records(fid: int, db: Session = Depends(get_db)):
    return _get(db, m.Facility, fid, "Facility").records


@router.post("", response_model=s.RecordOut)
def add_record(fid: int, body: s.RecordIn, db: Session = Depends(get_db)):
    _get(db, m.Facility, fid, "Facility")
    if _exists(db, fid, body):
        raise HTTPException(409, "A record for this exact period already exists")
    rec = m.HistoricalRecord(facility_id=fid, **body.model_dump())
    db.add(rec); db.commit(); db.refresh(rec)
    return rec


@router.delete("/{rid}")
def delete_record(fid: int, rid: int, db: Session = Depends(get_db)):
    rec = db.get(m.HistoricalRecord, rid)
    if not rec or rec.facility_id != fid:
        raise HTTPException(404, "Record not found")
    db.delete(rec); db.commit()
    return {"ok": True}


@router.post("/csv")
async def import_csv(fid: int, file: UploadFile, db: Session = Depends(get_db)):
    """Columns: period_start, period_end, energy_kwh [, cost, source_type, meter_id]. Bad rows are reported, not guessed."""
    _get(db, m.Facility, fid, "Facility")
    rows = csv.DictReader(io.StringIO((await file.read()).decode("utf-8-sig")))
    added, errors = 0, []
    for n, row in enumerate(rows, start=2):
        try:
            rec = s.RecordIn(
                period_start=date.fromisoformat(row["period_start"].strip()),
                period_end=date.fromisoformat(row["period_end"].strip()),
                energy_kwh=float(row["energy_kwh"]),
                cost=float(row["cost"]) if row.get("cost") else None,
                source_type=(row.get("source_type") or "meter").strip(),
                meter_id=(row.get("meter_id") or None))
        except (KeyError, ValueError, ValidationError, AttributeError) as e:
            errors.append(f"Row {n}: {str(e).splitlines()[0]}")
            continue
        if _exists(db, fid, rec):
            errors.append(f"Row {n}: duplicate period skipped")
            continue
        db.add(m.HistoricalRecord(facility_id=fid, **rec.model_dump())); db.flush()
        added += 1
    db.commit()
    return {"added": added, "errors": errors}


@router.get("/analysis")
def analysis(fid: int, db: Session = Depends(get_db)):
    f = _get(db, m.Facility, fid, "Facility")
    return history_analysis(f, f.records)
