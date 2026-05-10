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
    
    count_sql = f"SELECT COUNT(*) FROM SATELLITES s {where_clause}"
    cursor.execute(count_sql, params)
    total = cursor.fetchone()[0]
    
    offset = (page - 1) * page_size
    sql = f"""
        SELECT s.*, m.mission_name
        FROM SATELLITES s
        LEFT JOIN MISSIONS m ON s.mission_id = m.mission_id
        {where_clause}
        ORDER BY s.created_at DESC
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

@router.get("/{satellite_id}", response_model=SatelliteResponse)
async def get_satellite(
    satellite_id: int,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(get_current_user),
):
    cursor = conn.cursor()
    cursor.execute("""
        SELECT s.*, m.mission_name 
        FROM SATELLITES s 
        LEFT JOIN MISSIONS m ON s.mission_id = m.mission_id 
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
        INSERT INTO SATELLITES (satellite_id, satellite_name, norad_id, mission_id, launch_date, 
                                orbit_type, altitude_km, status, health_score)
        VALUES (SATELLITE_SEQ.NEXTVAL, :name, :norad, :mid, :launch, :orbit, :alt, :status, :health)
        RETURNING satellite_id, created_at INTO :sid, :cat
    """
    sid_var = cursor.var(oracledb.DB_TYPE_NUMBER)
    cat_var = cursor.var(oracledb.DB_TYPE_TIMESTAMP)
    
    cursor.execute(sql, {
        "name": satellite.satellite_name,
        "norad": satellite.norad_id,
        "mid": satellite.mission_id,
        "launch": satellite.launch_date,
        "orbit": satellite.orbit_type,
        "alt": satellite.altitude_km,
        "status": satellite.status.value,
        "health": satellite.health_score,
        "sid": sid_var,
        "cat": cat_var,
    })
    conn.commit()
    
    satellite_id = sid_var.getvalue()[0]
    created_at = cat_var.getvalue()[0]
    cursor.close()
    
    return {
        "satellite_id": satellite_id,
        "satellite_name": satellite.satellite_name,
        "norad_id": satellite.norad_id,
        "mission_id": satellite.mission_id,
        "launch_date": satellite.launch_date,
        "orbit_type": satellite.orbit_type,
        "altitude_km": satellite.altitude_km,
        "status": satellite.status.value,
        "health_score": satellite.health_score,
        "created_at": created_at,
        "last_contact": None,
        "mission_name": None,
    }

@router.put("/{satellite_id}", response_model=SatelliteResponse)
async def update_satellite(
    satellite_id: int,
    satellite: SatelliteUpdate,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.OPERATOR])),
):
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM SATELLITES WHERE satellite_id = :id", {"id": satellite_id})
    if not cursor.fetchone():
        cursor.close()
        raise HTTPException(status_code=404, detail="Satellite not found")
    
    updates, params = [], {"id": satellite_id}
    
    if satellite.satellite_name is not None:
        updates.append("satellite_name = :name"); params["name"] = satellite.satellite_name
    if satellite.norad_id is not None:
        updates.append("norad_id = :norad"); params["norad"] = satellite.norad_id
    if satellite.mission_id is not None:
        updates.append("mission_id = :mid"); params["mid"] = satellite.mission_id
    if satellite.launch_date is not None:
        updates.append("launch_date = :launch"); params["launch"] = satellite.launch_date
    if satellite.orbit_type is not None:
        updates.append("orbit_type = :orbit"); params["orbit"] = satellite.orbit_type
    if satellite.altitude_km is not None:
        updates.append("altitude_km = :alt"); params["alt"] = satellite.altitude_km
    if satellite.status is not None:
        updates.append("status = :status"); params["status"] = satellite.status.value
    if satellite.health_score is not None:
        updates.append("health_score = :health"); params["health"] = satellite.health_score
    
    if not updates:
        cursor.close()
        raise HTTPException(status_code=400, detail="No fields to update")
    
    updates.append("updated_at = CURRENT_TIMESTAMP")
    sql = f"UPDATE SATELLITES SET {', '.join(updates)} WHERE satellite_id = :id"
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
    cursor.execute("DELETE FROM SATELLITES WHERE satellite_id = :id", {"id": satellite_id})
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
    
    # Get latest telemetry for key parameters
    sql = """
        SELECT parameter_name, parameter_value, unit, timestamp
        FROM TELEMETRY
        WHERE satellite_id = :id
        AND timestamp >= SYSTIMESTAMP - INTERVAL '24' HOUR
        ORDER BY timestamp DESC
    """
    cursor.execute(sql, {"id": satellite_id})
    
    telemetry = {}
    for row in cursor:
        param = row[0]
        if param not in telemetry:
            telemetry[param] = {"value": row[1], "unit": row[2], "timestamp": row[3]}
    
    # Get anomaly count
    cursor.execute("""
        SELECT COUNT(*) FROM ANOMALIES 
        WHERE satellite_id = :id AND status IN ('OPEN', 'INVESTIGATING')
    """, {"id": satellite_id})
    active_anomalies = cursor.fetchone()[0]
    
    cursor.close()
    
    return {
        "satellite_id": satellite_id,
        "latest_telemetry": telemetry,
        "active_anomalies": active_anomalies,
        "health_status": "CRITICAL" if active_anomalies > 5 else "WARNING" if active_anomalies > 0 else "HEALTHY",
    }