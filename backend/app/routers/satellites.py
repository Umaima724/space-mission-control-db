"""Satellite CRUD + health monitoring router."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
import oracledb
from ..database import get_db_dependency
from ..models import SatelliteCreate, SatelliteUpdate, SatelliteResponse, PaginatedResponse
from ..routers.auth import get_current_user, require_role, UserRole

router = APIRouter(prefix="/satellites", tags=["Satellites"])


@router.get("", response_model=PaginatedResponse)
async def list_satellites(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    mission_id: Optional[int] = None,
    search: Optional[str] = None,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(get_current_user),
):
    cursor = conn.cursor()
    
    conditions = []
    params = []
    if status:
        conditions.append("s.status = :status")
        params.append(status)
    if mission_id:
        conditions.append("s.mission_id = :mid")
        params.append(mission_id)
    if search:
        conditions.append("LOWER(s.satellite_name) LIKE :search")
        params.append(f"%{search.lower()}%")
    
    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
    
    count_sql = f"SELECT COUNT(*) FROM SATELLITE s {where_clause}"
    cursor.execute(count_sql, params)
    total = cursor.fetchone()[0]
    
    # FIXED: Oracle 11g pagination with ROWNUM instead of OFFSET/FETCH
    offset = (page - 1) * page_size
    end_row = offset + page_size
    
    sql = f"""
        SELECT * FROM (
            SELECT a.*, ROWNUM rn FROM (
                SELECT s.satellite_id, s.mission_id, s.orbit_id, s.satellite_name, 
                       s.mass_kg, s.frequency_mhz, s.status, s.launch_date, m.mission_name
                FROM SATELLITE s
                LEFT JOIN MISSION m ON s.mission_id = m.mission_id
                {where_clause}
                ORDER BY s.satellite_id DESC
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


@router.get("/{satellite_id}", response_model=SatelliteResponse)
async def get_satellite(
    satellite_id: int,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(get_current_user),
):
    cursor = conn.cursor()
    cursor.execute("""
        SELECT s.satellite_id, s.mission_id, s.orbit_id, s.satellite_name,
               s.mass_kg, s.frequency_mhz, s.status, s.launch_date, m.mission_name
        FROM SATELLITE s 
        LEFT JOIN MISSION m ON s.mission_id = m.mission_id 
        WHERE s.satellite_id = :id
    """, {"id": satellite_id})
    row = cursor.fetchone()
    if not row:
        cursor.close()
        raise HTTPException(status_code=404, detail="Satellite not found")
    columns = [col[0].lower() for col in cursor.description]
    result = dict(zip(columns, row))
    cursor.close()
    return result


@router.post("", response_model=SatelliteResponse, status_code=201)
async def create_satellite(
    satellite: SatelliteCreate,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.OPERATOR])),
):
    cursor = conn.cursor()
    sql = """
        INSERT INTO SATELLITE (satellite_id, mission_id, orbit_id, satellite_name, 
                               mass_kg, frequency_mhz, status, launch_date)
        VALUES (SEQ_SATELLITE_ID.NEXTVAL, :mid, :oid, :name, :mass, :freq, :status, :launch)
        RETURNING satellite_id INTO :sid
    """
    sid_var = cursor.var(oracledb.DB_TYPE_NUMBER)
    
    cursor.execute(sql, {
        "mid": satellite.mission_id,
        "oid": satellite.orbit_id,
        "name": satellite.satellite_name,
        "mass": satellite.mass_kg,
        "freq": satellite.frequency_mhz,
        "status": satellite.status,
        "launch": satellite.launch_date,
        "sid": sid_var,
    })
    conn.commit()
    
    satellite_id = sid_var.getvalue()[0]
    cursor.close()
    
    # Fetch the created satellite to return full data
    return await get_satellite(satellite_id, conn, current_user)


@router.put("/{satellite_id}", response_model=SatelliteResponse)
async def update_satellite(
    satellite_id: int,
    satellite: SatelliteUpdate,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.OPERATOR])),
):
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM SATELLITE WHERE satellite_id = :id", {"id": satellite_id})
    if not cursor.fetchone():
        cursor.close()
        raise HTTPException(status_code=404, detail="Satellite not found")
    
    updates, params = [], {"id": satellite_id}
    
    if satellite.satellite_name is not None:
        updates.append("satellite_name = :name")
        params["name"] = satellite.satellite_name
    if satellite.mission_id is not None:
        updates.append("mission_id = :mid")
        params["mid"] = satellite.mission_id
    if satellite.orbit_id is not None:
        updates.append("orbit_id = :oid")
        params["oid"] = satellite.orbit_id
    if satellite.launch_date is not None:
        updates.append("launch_date = :launch")
        params["launch"] = satellite.launch_date
    if satellite.mass_kg is not None:
        updates.append("mass_kg = :mass")
        params["mass"] = satellite.mass_kg
    if satellite.frequency_mhz is not None:
        updates.append("frequency_mhz = :freq")
        params["freq"] = satellite.frequency_mhz
    if satellite.status is not None:
        updates.append("status = :status")
        params["status"] = satellite.status
    
    if not updates:
        cursor.close()
        raise HTTPException(status_code=400, detail="No fields to update")
    
    sql = f"UPDATE SATELLITE SET {', '.join(updates)} WHERE satellite_id = :id"
    cursor.execute(sql, params)
    conn.commit()
    cursor.close()
    return await get_satellite(satellite_id, conn, current_user)


@router.delete("/{satellite_id}")
async def delete_satellite(
    satellite_id: int,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(require_role([UserRole.ADMIN])),
):
    cursor = conn.cursor()
    cursor.execute("DELETE FROM SATELLITE WHERE satellite_id = :id", {"id": satellite_id})
    if cursor.rowcount == 0:
        cursor.close()
        raise HTTPException(status_code=404, detail="Satellite not found")
    conn.commit()
    cursor.close()
    return {"message": "Satellite deleted successfully"}


@router.get("/{satellite_id}/health")
async def get_satellite_health(
    satellite_id: int,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(get_current_user),
):
    cursor = conn.cursor()
    
    # FIXED: Use NUMTODSINTERVAL instead of INTERVAL literal
    sql = """
        SELECT temperature_c, battery_pct, signal_dbm, altitude_km, recorded_at
        FROM TELEMETRY_LOG
        WHERE satellite_id = :id
        AND recorded_at >= SYSTIMESTAMP - NUMTODSINTERVAL(24, 'HOUR')
        ORDER BY recorded_at DESC
        FETCH FIRST 1 ROW ONLY
    """
    cursor.execute(sql, {"id": satellite_id})
    
    row = cursor.fetchone()
    latest_telemetry = None
    if row:
        latest_telemetry = {
            "temperature_c": row[0],
            "battery_pct": row[1],
            "signal_dbm": row[2],
            "altitude_km": row[3],
            "recorded_at": row[4],
        }
    
    # Get anomaly count (resolved = 'N' means active/open)
    cursor.execute("""
        SELECT COUNT(*) FROM ANOMALY_REPORT 
        WHERE satellite_id = :id AND resolved = 'N'
    """, {"id": satellite_id})
    active_anomalies = cursor.fetchone()[0]
    
    cursor.close()
    
    return {
        "satellite_id": satellite_id,
        "latest_telemetry": latest_telemetry,
        "active_anomalies": active_anomalies,
        "health_status": "CRITICAL" if active_anomalies > 5 else "WARNING" if active_anomalies > 0 else "HEALTHY",
    }