"""Pydantic request/response models. Validation rules live here."""
from datetime import date
from typing import Dict, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator

Category = Literal["lighting", "cooling", "computing", "appliance", "other"]


class ApplianceIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    category: Category = "other"
    quantity_per_room: int = Field(gt=0, le=10000)
    rated_power_watts: float = Field(gt=0, le=100000)
    hours_per_day: float = Field(ge=0, le=24)
    days_per_month: int = Field(ge=1, le=31, default=26)


class ApplianceOut(ApplianceIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    section_id: int


class SectionIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    section_type: str = Field(default="Room", max_length=60)
    room_count: int = Field(gt=0, le=1000, default=1)
    operating_days: int = Field(ge=1, le=31, default=26)
    start_time: str = Field(default="09:00", pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(default="17:00", pattern=r"^\d{2}:\d{2}$")
    notes: Optional[str] = Field(default=None, max_length=300)


class SectionOut(SectionIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    facility_id: int
    appliances: list[ApplianceOut] = []


class FacilityIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    facility_type: Literal["household", "institution", "office"]
    location: Optional[str] = Field(default=None, max_length=120)
    tariff_per_kwh: float = Field(gt=0, le=100, default=8.0)
    emissions_factor: float = Field(gt=0, le=5, default=0.716)
    emissions_factor_source: str = Field(
        default="CEA CO2 Baseline Database (India grid average) - verify the latest published value", max_length=200
    )
    reporting_period: str = Field(default="Monthly", max_length=60)
    action_date: Optional[date] = None


class FacilityOut(FacilityIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sections: list[SectionOut] = []


class FacilityBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    facility_type: str


class RecordIn(BaseModel):
    period_start: date
    period_end: date
    energy_kwh: float = Field(gt=0)
    cost: Optional[float] = Field(default=None, ge=0)
    source_type: Literal["meter", "bill", "simulated"] = "meter"
    meter_id: Optional[str] = Field(default=None, max_length=60)
    section_id: Optional[int] = None

    @model_validator(mode="after")
    def _dates(self):
        if self.period_end < self.period_start:
            raise ValueError("period_end must be on or after period_start")
        return self


class RecordOut(RecordIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    facility_id: int


# ---- What-if simulator payloads (only changed fields are sent) ----
class ApplianceOverride(BaseModel):
    quantity_per_room: Optional[int] = Field(default=None, ge=0, le=10000)
    rated_power_watts: Optional[float] = Field(default=None, gt=0, le=100000)
    hours_per_day: Optional[float] = Field(default=None, ge=0, le=24)
    days_per_month: Optional[int] = Field(default=None, ge=1, le=31)
    efficiency_gain_pct: Optional[float] = Field(default=None, ge=0, le=90)


class SectionOverride(BaseModel):
    hours_scale: Optional[float] = Field(default=None, ge=0, le=2)
    days_per_month: Optional[int] = Field(default=None, ge=1, le=31)


class Scenario(BaseModel):
    appliances: Dict[int, ApplianceOverride] = {}
    sections: Dict[int, SectionOverride] = {}
