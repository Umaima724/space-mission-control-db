"""Pydantic models and schemas for the Space Mission Control API."""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from enum import Enum

# ==================== ENUMS ====================
class MissionStatus(str, Enum):
    PLANNED = "PLANNED"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    ABORTED = "ABORTED"

class MissionType(str, Enum):
    CREWED = "CREWED"
    UNCREWED = "UNCREWED"

class SatelliteStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    DECOMMISSIONED = "DECOMMISSIONED"

class AnomalySeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class UserRole(str, Enum):
    ADMIN = "ADMIN"
    OPERATOR = "OPERATOR"
    VIEWER = "VIEWER"

# ==================== AUTH MODELS ====================
class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    username: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[UserRole] = None

# ==================== MISSION MODELS ====================
class MissionBase(BaseModel):
    mission_name: str = Field(..., max_length=150)
    mission_type: MissionType = MissionType.UNCREWED
    launch_date: date
    status: MissionStatus = MissionStatus.PLANNED
    objective: str = Field(..., max_length=500)
    agency_name: str = Field(..., max_length=100)

class MissionCreate(MissionBase):
    pass

class MissionUpdate(BaseModel):
    mission_name: Optional[str] = Field(None, max_length=150)
    mission_type: Optional[MissionType] = None
    launch_date: Optional[date] = None
    status: Optional[MissionStatus] = None
    objective: Optional[str] = None
    agency_name: Optional[str] = Field(None, max_length=100)

class MissionResponse(MissionBase):
    mission_id: int
    satellite_count: Optional[int] = 0

    class Config:
        from_attributes = True

# ==================== SATELLITE MODELS ====================
class SatelliteBase(BaseModel):
    satellite_name: str = Field(..., max_length=100)
    mission_id: int
    orbit_id: Optional[int] = None
    mass_kg: float = Field(..., gt=0)
    frequency_mhz: float = Field(..., gt=0)
    status: SatelliteStatus = SatelliteStatus.ACTIVE
    launch_date: date

class SatelliteCreate(SatelliteBase):
    pass

class SatelliteUpdate(BaseModel):
    satellite_name: Optional[str] = Field(None, max_length=100)
    mission_id: Optional[int] = None
    orbit_id: Optional[int] = None
    mass_kg: Optional[float] = Field(None, gt=0)
    frequency_mhz: Optional[float] = Field(None, gt=0)
    status: Optional[SatelliteStatus] = None
    launch_date: Optional[date] = None

class SatelliteResponse(SatelliteBase):
    satellite_id: int
    mission_name: Optional[str] = None

    class Config:
        from_attributes = True

# ==================== TELEMETRY MODELS ====================
class TelemetryBase(BaseModel):
    satellite_id: int
    recorded_at: datetime
    temperature_c: float
    battery_pct: Optional[float] = Field(None, ge=0, le=100)
    signal_dbm: Optional[float] = Field(None, ge=-150, le=0)
    altitude_km: float

class TelemetryCreate(TelemetryBase):
    pass

class TelemetryResponse(TelemetryBase):
    log_id: int
    satellite_name: Optional[str] = None

    class Config:
        from_attributes = True

class TelemetryStats(BaseModel):
    temperature: dict
    battery: dict
    signal: dict
    altitude: dict

# ==================== ANOMALY MODELS ====================
class AnomalyBase(BaseModel):
    satellite_id: int
    reported_by: int
    severity: AnomalySeverity
    description: str = Field(..., max_length=1000)
    reported_at: Optional[datetime] = None
    resolved: str = 'N'  # 'Y' or 'N'
    resolution_note: Optional[str] = Field(None, max_length=500)

class AnomalyCreate(AnomalyBase):
    pass

class AnomalyUpdate(BaseModel):
    severity: Optional[AnomalySeverity] = None
    description: Optional[str] = None
    resolved: Optional[str] = None
    resolution_note: Optional[str] = None

class AnomalyResponse(AnomalyBase):
    anomaly_id: int
    satellite_name: Optional[str] = None

    class Config:
        from_attributes = True

# ==================== GROUND STATION MODELS ====================
class GroundStationBase(BaseModel):
    center_id: Optional[int] = None
    station_name: str = Field(..., max_length=100)
    location: str = Field(..., max_length=150)
    latitude: float
    longitude: float
    operational: str = 'Y'  # 'Y' or 'N'
    frequency_range: str = Field(..., max_length=50)

class GroundStationCreate(GroundStationBase):
    pass

class GroundStationUpdate(BaseModel):
    center_id: Optional[int] = None
    station_name: Optional[str] = Field(None, max_length=100)
    location: Optional[str] = Field(None, max_length=150)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    operational: Optional[str] = None
    frequency_range: Optional[str] = Field(None, max_length=50)

class GroundStationResponse(GroundStationBase):
    station_id: int

    class Config:
        from_attributes = True

# ==================== DASHBOARD MODELS ====================
class KpiCard(BaseModel):
    title: str
    value: str | int | float
    change: Optional[float] = None
    icon: Optional[str] = None
    color: Optional[str] = None

class ChartData(BaseModel):
    labels: List[str]
    datasets: List[dict]

class DashboardData(BaseModel):
    kpis: List[KpiCard]
    charts: dict

# ==================== REPORT MODELS ====================
class ReportRequest(BaseModel):
    report_type: str  # MISSIONS, SATELLITES, TELEMETRY, ANOMALY_REPORT
    format: str = "pdf"  # pdf, csv
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    filters: Optional[dict] = None

class PaginatedResponse(BaseModel):
    items: List[dict]
    total: int
    page: int
    page_size: int
    total_pages: int