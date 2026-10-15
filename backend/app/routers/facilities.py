"""CRUD for facilities, sections, appliances + presets + demo loader."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models as m, schemas as s
from ..database import get_db
from ..presets import PRESETS
from ..seed import create_demo

router = APIRouter()


def _get(db, model, id_, label):
    obj = db.get(model, id_)
    if not obj:
        raise HTTPException(404, f"{label} {id_} not found")
    return obj


def _save(db, obj):
    db.add(obj); db.commit(); db.refresh(obj)
    return obj


@router.get("/presets")
def presets():
    return PRESETS


@router.post("/demo", response_model=s.FacilityOut)
def load_demo(db: Session = Depends(get_db)):
    return create_demo(db)


@router.get("/facilities", response_model=list[s.FacilityBrief])
def list_facilities(db: Session = Depends(get_db)):
    return db.query(m.Facility).order_by(m.Facility.id.desc()).all()


@router.post("/facilities", response_model=s.FacilityOut)
def create_facility(body: s.FacilityIn, db: Session = Depends(get_db)):
    return _save(db, m.Facility(**body.model_dump()))


@router.get("/facilities/{fid}", response_model=s.FacilityOut)
def get_facility(fid: int, db: Session = Depends(get_db)):
    return _get(db, m.Facility, fid, "Facility")


@router.put("/facilities/{fid}", response_model=s.FacilityOut)
def update_facility(fid: int, body: s.FacilityIn, db: Session = Depends(get_db)):
    f = _get(db, m.Facility, fid, "Facility")
    for k, v in body.model_dump().items():
        setattr(f, k, v)
    return _save(db, f)


@router.delete("/facilities/{fid}")
def delete_facility(fid: int, db: Session = Depends(get_db)):
    db.delete(_get(db, m.Facility, fid, "Facility")); db.commit()
    return {"ok": True}


@router.post("/facilities/{fid}/sections", response_model=s.SectionOut)
def add_section(fid: int, body: s.SectionIn, db: Session = Depends(get_db)):
    _get(db, m.Facility, fid, "Facility")
    return _save(db, m.Section(facility_id=fid, **body.model_dump()))


@router.put("/sections/{sid}", response_model=s.SectionOut)
def update_section(sid: int, body: s.SectionIn, db: Session = Depends(get_db)):
    sec = _get(db, m.Section, sid, "Section")
    for k, v in body.model_dump().items():
        setattr(sec, k, v)
    return _save(db, sec)


@router.delete("/sections/{sid}")
def delete_section(sid: int, db: Session = Depends(get_db)):
    db.query(m.HistoricalRecord).filter_by(section_id=sid).delete()
    db.delete(_get(db, m.Section, sid, "Section")); db.commit()
    return {"ok": True}


@router.post("/sections/{sid}/appliances", response_model=s.ApplianceOut)
def add_appliance(sid: int, body: s.ApplianceIn, db: Session = Depends(get_db)):
    _get(db, m.Section, sid, "Section")
    return _save(db, m.Appliance(section_id=sid, **body.model_dump()))


@router.put("/appliances/{aid}", response_model=s.ApplianceOut)
def update_appliance(aid: int, body: s.ApplianceIn, db: Session = Depends(get_db)):
    a = _get(db, m.Appliance, aid, "Appliance")
    for k, v in body.model_dump().items():
        setattr(a, k, v)
    return _save(db, a)


@router.delete("/appliances/{aid}")
def delete_appliance(aid: int, db: Session = Depends(get_db)):
    db.delete(_get(db, m.Appliance, aid, "Appliance")); db.commit()
    return {"ok": True}
