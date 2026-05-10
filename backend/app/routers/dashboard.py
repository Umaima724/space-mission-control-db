"""Dashboard KPIs and charts data router."""
from fastapi import APIRouter, Depends
import oracledb
from ..database import get_db_dependency
from ..models import DashboardData, KpiCard
from ..routers.auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("", response_model=DashboardData)
async def get_dashboard(
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(get_current_user),
):
    cursor = conn.cursor()
    
    # KPIs
    kpis = []
    
    # Total missions
    cursor.execute("SELECT COUNT(*) FROM MISSIONS")
    total_missions = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM MISSIONS WHERE status = 'ACTIVE'")
    active_missions = cursor.fetchone()[0]
    kpis.append(KpiCard(
        title="Total Missions",
        value=total_missions,
        change=active_missions,
        icon="Rocket",
        color="blue"
    ))
    
    # Total satellites
    cursor.execute("SELECT COUNT(*) FROM SATELLITES")
    total_satellites = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM SATELLITES WHERE status = 'OPERATIONAL'")
    operational = cursor.fetchone()[0]
    kpis.append(KpiCard(
        title="Satellites",
        value=total_satellites,
        change=operational,
        icon="Satellite",
        color="green"
    ))
    
    # Active anomalies
    cursor.execute("SELECT COUNT(*) FROM ANOMALIES WHERE status IN ('OPEN', 'INVESTIGATING')")
    active_anomalies = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM ANOMALIES WHERE severity = 'CRITICAL' AND status IN ('OPEN', 'INVESTIGATING')")
    critical = cursor.fetchone()[0]
    kpis.append(KpiCard(
        title="Active Anomalies",
        value=active_anomalies,
        change=critical,
        icon="AlertTriangle",
        color="red" if critical > 0 else "yellow"
    ))
    
    # Ground stations
    cursor.execute("SELECT COUNT(*) FROM GROUND_STATIONS")
    total_stations = cursor.fetchone()[0]
    kpis.append(KpiCard(
        title="Ground Stations",
        value=total_stations,
        icon="Radio",
        color="purple"
    ))
    
    # Charts data
    charts = {}
    
    # Mission status distribution
    cursor.execute("SELECT status, COUNT(*) FROM MISSIONS GROUP BY status")
    mission_status = {"labels": [], "data": []}
    for row in cursor:
        mission_status["labels"].append(row[0])
        mission_status["data"].append(row[1])
    charts["missionStatus"] = mission_status
    
    # Satellite status distribution
    cursor.execute("SELECT status, COUNT(*) FROM SATELLITES GROUP BY status")
    sat_status = {"labels": [], "data": []}
    for row in cursor:
        sat_status["labels"].append(row[0])
        sat_status["data"].append(row[1])
    charts["satelliteStatus"] = sat_status
    
    # Anomalies by severity
    cursor.execute("SELECT severity, COUNT(*) FROM ANOMALIES WHERE status IN ('OPEN', 'INVESTIGATING') GROUP BY severity")
    anomaly_sev = {"labels": [], "data": []}
    for row in cursor:
        anomaly_sev["labels"].append(row[0])
        anomaly_sev["data"].append(row[1])
    charts["anomalySeverity"] = anomaly_sev
    
    # Telemetry volume last 7 days
    cursor.execute("""
        SELECT TO_CHAR(TRUNC(timestamp), 'YYYY-MM-DD') as day, COUNT(*)
        FROM TELEMETRY
        WHERE timestamp >= TRUNC(SYSDATE) - 6
        GROUP BY TRUNC(timestamp)
        ORDER BY day
    """)
    telemetry_vol = {"labels": [], "data": []}
    for row in cursor:
        telemetry_vol["labels"].append(row[0])
        telemetry_vol["data"].append(row[1])
    charts["telemetryVolume"] = telemetry_vol
    
    cursor.close()
    
    return DashboardData(kpis=kpis, charts=charts)