"""Telemetry view and add router."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
import oracledb
from ..database import get_db_dependency
from ..models import TelemetryCreate, TelemetryResponse, TelemetryStats, PaginatedResponse
from ..routers.auth import get_current_user, require_role, UserRole

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])


@router.get("", response_model=PaginatedResponse)
async def list_telemetry(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    satellite_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(get_current_user),
):
    cursor = conn.cursor()
    
    conditions = []
    params = []
    if satellite_id:
        conditions.append("t.satellite_id = :sid")
        params.append(satellite_id)
    if date_from:
        conditions.append("t.recorded_at >= TO_TIMESTAMP(:from_date, 'YYYY-MM-DD\"T\"HH24:MI:SS')")
        params.append(date_from)
    if date_to:
        conditions.append("t.recorded_at <= TO_TIMESTAMP(:to_date, 'YYYY-MM-DD\"T\"HH24:MI:SS')")
        params.append(date_to)
    
    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
    
    count_sql = f"SELECT COUNT(*) FROM TELEMETRY_LOG t {where_clause}"
    cursor.execute(count_sql, params)
    total = cursor.fetchone()[0]
    
    # Oracle 11g pagination with ROWNUM
    offset = (page - 1) * page_size
    end_row = offset + page_size
    
    sql = f"""
        SELECT * FROM (
            SELECT a.*, ROWNUM rn FROM (
                SELECT t.log_id, t.satellite_id, t.recorded_at, t.temperature_c,
                       t.battery_pct, t.signal_dbm, t.altitude_km, s.satellite_name
                FROM TELEMETRY_LOG t
                JOIN SATELLITE s ON t.satellite_id = s.satellite_id
                {where_clause}
                ORDER BY t.recorded_at DESC
            ) a WHERE ROWNUM <= :end_row
        ) WHERE rn > :offset
    """
    cursor.execute(sql, params + [end_row, offset])
    
    columns = [col[0].lower() for col in cursor.description]
    items = [dict(zip(columns, row)) for row in cursor]
    cursor.close()
    
    return PaginatedResponse(
        items=items, total=total, page=page,
        page_size=page_size, total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/stats")
async def get_telemetry_stats(
    satellite_id: int,
    hours: int = Query(24, ge=1, le=168),
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(get_current_user),
):
    cursor = conn.cursor()
    
    # FIXED: Use NUMTODSINTERVAL instead of INTERVAL with bind variable
    sql = """
        SELECT 
            ROUND(AVG(temperature_c), 4) as avg_temp,
            MIN(temperature_c) as min_temp,
            MAX(temperature_c) as max_temp,
            ROUND(AVG(battery_pct), 4) as avg_battery,
            MIN(battery_pct) as min_battery,
            MAX(battery_pct) as max_battery,
            ROUND(AVG(signal_dbm), 4) as avg_signal,
            MIN(signal_dbm) as min_signal,
            MAX(signal_dbm) as max_signal,
            ROUND(AVG(altitude_km), 4) as avg_altitude,
            MIN(altitude_km) as min_altitude,
            MAX(altitude_km) as max_altitude,
            COUNT(*) as count
        FROM TELEMETRY_LOG
        WHERE satellite_id = :sid
        AND recorded_at >= SYSTIMESTAMP - NUMTODSINTERVAL(:hours, 'HOUR')
    """
    cursor.execute(sql, {"sid": satellite_id, "hours": hours})
    
    row = cursor.fetchone()
    cursor.close()
    
    if not row or row[12] == 0:
        return {
            "temperature": {"avg": None, "min": None, "max": None, "count": 0},
            "battery": {"avg": None, "min": None, "max": None, "count": 0},
            "signal": {"avg": None, "min": None, "max": None, "count": 0},
            "altitude": {"avg": None, "min": None, "max": None, "count": 0},
        }
    
    return {
        "temperature": {
            "avg": row[0], "min": row[1], "max": row[2], "count": row[12]
        },
        "battery": {
            "avg": row[3], "min": row[4], "max": row[5], "count": row[12]
        },
        "signal": {
            "avg": row[6], "min": row[7], "max": row[8], "count": row[12]
        },
        "altitude": {
            "avg": row[9], "min": row[10], "max": row[11], "count": row[12]
        },
    }


@router.post("", response_model=TelemetryResponse, status_code=201)
async def create_telemetry(
    telemetry: TelemetryCreate,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.OPERATOR])),
):
    cursor = conn.cursor()
    
    # Verify satellite exists
    cursor.execute("SELECT satellite_name FROM SATELLITE WHERE satellite_id = :id", {"id": telemetry.satellite_id})
    sat_row = cursor.fetchone()
    if not sat_row:
        cursor.close()
        raise HTTPException(status_code=404, detail="Satellite not found")
    
    satellite_name = sat_row[0]
    
    sql = """
        INSERT INTO TELEMETRY_LOG (log_id, satellite_id, recorded_at, temperature_c, battery_pct, signal_dbm, altitude_km)
        VALUES (SEQ_TELEMETRY_ID.NEXTVAL, :sid, :rec_at, :temp, :battery, :signal, :altitude)
        RETURNING log_id INTO :lid
    """
    lid_var = cursor.var(oracledb.DB_TYPE_NUMBER)
    
    cursor.execute(sql, {
        "sid": telemetry.satellite_id,
        "rec_at": telemetry.recorded_at,
        "temp": telemetry.temperature_c,
        "battery": telemetry.battery_pct,
        "signal": telemetry.signal_dbm,
        "altitude": telemetry.altitude_km,
        "lid": lid_var,
    })
    conn.commit()
    
    log_id = lid_var.getvalue()[0]
    cursor.close()
    
    return {
        "log_id": log_id,
        "satellite_id": telemetry.satellite_id,
        "recorded_at": telemetry.recorded_at,
        "temperature_c": telemetry.temperature_c,
        "battery_pct": telemetry.battery_pct,
        "signal_dbm": telemetry.signal_dbm,
        "altitude_km": telemetry.altitude_km,
        "satellite_name": satellite_name,
    }