"""SQLAlchemy tables: Facility -> Section -> Appliance, plus HistoricalRecord."""
from datetime import date
from sqlalchemy import Date, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


class Facility(Base):
    __tablename__ = "facilities"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    facility_type: Mapped[str] = mapped_column(String(20))  # household | institution | office
    location: Mapped[str | None] = mapped_column(String(120), nullable=True)
    tariff_per_kwh: Mapped[float] = mapped_column(Float, default=8.0)
    emissions_factor: Mapped[float] = mapped_column(Float, default=0.716)
    emissions_factor_source: Mapped[str] = mapped_column(String(200), default="")
    reporting_period: Mapped[str] = mapped_column(String(60), default="Monthly")
    action_date: Mapped[date | None] = mapped_column(Date, nullable=True)  # when savings measures started

    sections = relationship("Section", cascade="all, delete-orphan", order_by="Section.id")
    records = relationship("HistoricalRecord", cascade="all, delete-orphan", order_by="HistoricalRecord.period_start")


class Section(Base):
    __tablename__ = "sections"
    id: Mapped[int] = mapped_column(primary_key=True)
    facility_id: Mapped[int] = mapped_column(ForeignKey("facilities.id"))
    name: Mapped[str] = mapped_column(String(120))
    section_type: Mapped[str] = mapped_column(String(60), default="Room")
    room_count: Mapped[int] = mapped_column(Integer, default=1)
    operating_days: Mapped[int] = mapped_column(Integer, default=26)
    start_time: Mapped[str] = mapped_column(String(5), default="09:00")
    end_time: Mapped[str] = mapped_column(String(5), default="17:00")
    notes: Mapped[str | None] = mapped_column(String(300), nullable=True)

    appliances = relationship("Appliance", cascade="all, delete-orphan", order_by="Appliance.id")


class Appliance(Base):
    __tablename__ = "appliances"
    id: Mapped[int] = mapped_column(primary_key=True)
    section_id: Mapped[int] = mapped_column(ForeignKey("sections.id"))
    name: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(20), default="other")  # lighting|cooling|computing|appliance|other
    quantity_per_room: Mapped[int] = mapped_column(Integer)  # PER ROOM - multiplied by section.room_count once
    rated_power_watts: Mapped[float] = mapped_column(Float)
    hours_per_day: Mapped[float] = mapped_column(Float)
    days_per_month: Mapped[int] = mapped_column(Integer, default=26)


class HistoricalRecord(Base):
    __tablename__ = "historical_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    facility_id: Mapped[int] = mapped_column(ForeignKey("facilities.id"))
    section_id: Mapped[int | None] = mapped_column(ForeignKey("sections.id"), nullable=True)
    meter_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    energy_kwh: Mapped[float] = mapped_column(Float)
    cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_type: Mapped[str] = mapped_column(String(20), default="meter")  # meter | bill | simulated
