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

class SatelliteStatus(str, Enum):
    OPERATIONAL = "OPERATIONAL"
    DEGRADED = "DEGRADED"
    OFFLINE = "OFFLINE"
    MAINTENANCE = "MAINTENANCE"

class AnomalySeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class AnomalyStatus(str, Enum):
    OPEN = "OPEN"
    INVESTIGATING = "INVESTIGATING"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"

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
    mission_name: str = Field(..., max_length=100)
    launch_date: Optional[date] = None
    end_date: Optional[date] = None
    status: MissionStatus = MissionStatus.PLANNED
    objective: Optional[str] = None
    budget: Optional[float] = None
    lead_agency: Optional[str] = Field(None, max_length=100)

class MissionCreate(MissionBase):
    pass

class MissionUpdate(BaseModel):
    mission_name: Optional[str] = Field(None, max_length=100)
    launch_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[MissionStatus] = None
    objective: Optional[str] = None
    budget: Optional[float] = None
    lead_agency: Optional[str] = Field(None, max_length=100)

class MissionResponse(MissionBase):
    mission_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    satellite_count: Optional[int] = 0

    class Config:
        from_attributes = True

# ==================== SATELLITE MODELS ====================
class SatelliteBase(BaseModel):
    satellite_name: str = Field(..., max_length=100)
    norad_id: Optional[str] = Field(None, max_length=20)
    mission_id: Optional[int] = None
    launch_date: Optional[date] = None
    orbit_type: Optional[str] = Field(None, max_length=50)
    altitude_km: Optional[float] = None
    status: SatelliteStatus = SatelliteStatus.OPERATIONAL
    health_score: Optional[float] = Field(None, ge=0, le=100)

class SatelliteCreate(SatelliteBase):
    pass

class SatelliteUpdate(BaseModel):
    satellite_name: Optional[str] = Field(None, max_length=100)
    norad_id: Optional[str] = Field(None, max_length=20)
    mission_id: Optional[int] = None
    launch_date: Optional[date] = None
    orbit_type: Optional[str] = Field(None, max_length=50)
    altitude_km: Optional[float] = None
    status: Optional[SatelliteStatus] = None
    health_score: Optional[float] = Field(None, ge=0, le=100)

class SatelliteResponse(SatelliteBase):
    satellite_id: int
    last_contact: Optional[datetime] = None
    created_at: datetime
    mission_name: Optional[str] = None

    class Config:
        from_attributes = True

# ==================== TELEMETRY MODELS ====================
class TelemetryBase(BaseModel):
    satellite_id: int
    timestamp: datetime
    parameter_name: str = Field(..., max_length=50)
    parameter_value: float
    unit: Optional[str] = Field(None, max_length=20)
    data_source: Optional[str] = Field(None, max_length=50)

class TelemetryCreate(TelemetryBase):
    pass

class TelemetryResponse(TelemetryBase):
    telemetry_id: int
    satellite_name: Optional[str] = None

    class Config:
        from_attributes = True

class TelemetryStats(BaseModel):
    parameter_name: str
    avg_value: float
    min_value: float
    max_value: float
    count: int

# ==================== ANOMALY MODELS ====================
class AnomalyBase(BaseModel):
    satellite_id: int
    detected_at: datetime
    severity: AnomalySeverity
    description: str
    status: AnomalyStatus = AnomalyStatus.OPEN
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None

class AnomalyCreate(AnomalyBase):
    pass

class AnomalyUpdate(BaseModel):
    severity: Optional[AnomalySeverity] = None
    description: Optional[str] = None
    status: Optional[AnomalyStatus] = None
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None

class AnomalyResponse(AnomalyBase):
    anomaly_id: int
    satellite_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# ==================== GROUND STATION MODELS ====================
class GroundStationBase(BaseModel):
    station_name: str = Field(..., max_length=100)
    location: Optional[str] = Field(None, max_length=200)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    elevation_m: Optional[float] = None
    status: Optional[str] = Field(None, max_length=20)
    antenna_count: Optional[int] = None

class GroundStationCreate(GroundStationBase):
    pass

class GroundStationUpdate(BaseModel):
    station_name: Optional[str] = Field(None, max_length=100)
    location: Optional[str] = Field(None, max_length=200)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    elevation_m: Optional[float] = None
    status: Optional[str] = Field(None, max_length=20)
    antenna_count: Optional[int] = None

class GroundStationResponse(GroundStationBase):
    station_id: int
    created_at: datetime

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
    report_type: str  # MISSIONS, SATELLITES, TELEMETRY, ANOMALIES
    format: str = "pdf"  # pdf, csv, xlsx
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    filters: Optional[dict] = None

class PaginatedResponse(BaseModel):
    items: List[dict]
    total: int
    page: int
    page_size: int
    total_pages: int