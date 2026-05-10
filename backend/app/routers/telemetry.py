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
    parameter: Optional[str] = None,
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
    if parameter:
        conditions.append("t.parameter_name = :param")
        params.append(parameter)
    if date_from:
        conditions.append("t.timestamp >= TO_TIMESTAMP(:from_date, 'YYYY-MM-DD\"T\"HH24:MI:SS')")
        params.append(date_from)
    if date_to:
        conditions.append("t.timestamp <= TO_TIMESTAMP(:to_date, 'YYYY-MM-DD\"T\"HH24:MI:SS')")
        params.append(date_to)
    
    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
    
    count_sql = f"SELECT COUNT(*) FROM TELEMETRY t {where_clause}"
    cursor.execute(count_sql, params)
    total = cursor.fetchone()[0]
    
    offset = (page - 1) * page_size
    sql = f"""
        SELECT t.*, s.satellite_name
        FROM TELEMETRY t
        JOIN SATELLITES s ON t.satellite_id = s.satellite_id
        {where_clause}
        ORDER BY t.timestamp DESC
        OFFSET :offset ROWS FETCH NEXT :page_size ROWS ONLY
    """
    cursor.execute(sql, params + [offset, page_size])
    
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
    sql = """
        SELECT parameter_name,
               ROUND(AVG(parameter_value), 4) as avg_value,
               MIN(parameter_value) as min_value,
               MAX(parameter_value) as max_value,
               COUNT(*) as count
        FROM TELEMETRY
        WHERE satellite_id = :sid
        AND timestamp >= SYSTIMESTAMP - INTERVAL ':hours' HOUR
        GROUP BY parameter_name
    """
    cursor.execute(sql, {"sid": satellite_id, "hours": hours})
    
    stats = []
    for row in cursor:
        stats.append({
            "parameter_name": row[0],
            "avg_value": row[1],
            "min_value": row[2],
            "max_value": row[3],
            "count": row[4],
        })
    cursor.close()
    return stats

@router.post("", response_model=TelemetryResponse, status_code=201)
async def create_telemetry(
    telemetry: TelemetryCreate,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.OPERATOR])),
):
    cursor = conn.cursor()
    
    # Verify satellite exists
    cursor.execute("SELECT 1 FROM SATELLITES WHERE satellite_id = :id", {"id": telemetry.satellite_id})
    if not cursor.fetchone():
        cursor.close()
        raise HTTPException(status_code=404, detail="Satellite not found")
    
    sql = """
        INSERT INTO TELEMETRY (telemetry_id, satellite_id, timestamp, parameter_name, parameter_value, unit, data_source)
        VALUES (TELEMETRY_SEQ.NEXTVAL, :sid, :ts, :param, :val, :unit, :source)
        RETURNING telemetry_id INTO :tid
    """
    tid_var = cursor.var(oracledb.DB_TYPE_NUMBER)
    
    cursor.execute(sql, {
        "sid": telemetry.satellite_id,
        "ts": telemetry.timestamp,
        "param": telemetry.parameter_name,
        "val": telemetry.parameter_value,
        "unit": telemetry.unit,
        "source": telemetry.data_source,
        "tid": tid_var,
    })
    conn.commit()
    
    telemetry_id = tid_var.getvalue()[0]
    cursor.close()
    
    return {
        "telemetry_id": telemetry_id,
        "satellite_id": telemetry.satellite_id,
        "timestamp": telemetry.timestamp,
        "parameter_name": telemetry.parameter_name,
        "parameter_value": telemetry.parameter_value,
        "unit": telemetry.unit,
        "data_source": telemetry.data_source,
        "satellite_name": None,
    }