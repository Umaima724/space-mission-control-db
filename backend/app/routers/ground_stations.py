"""Ground Station CRUD router."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
import oracledb
from ..database import get_db_dependency
from ..models import GroundStationCreate, GroundStationUpdate, GroundStationResponse, PaginatedResponse
from ..routers.auth import get_current_user, require_role, UserRole

router = APIRouter(prefix="/ground-stations", tags=["Ground Stations"])


@router.get("", response_model=PaginatedResponse)
async def list_ground_stations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    operational: Optional[str] = None,
    search: Optional[str] = None,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(get_current_user),
):
    cursor = conn.cursor()
    
    conditions = []
    params = []
    if operational:
        conditions.append("operational = :op")
        params.append(operational)
    if search:
        conditions.append("(LOWER(station_name) LIKE :search OR LOWER(location) LIKE :search)")
        params.append(f"%{search.lower()}%")
    
    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
    
    count_sql = f"SELECT COUNT(*) FROM GROUND_STATION {where_clause}"
    cursor.execute(count_sql, params)
    total = cursor.fetchone()[0]
    
    # Oracle 11g pagination with ROWNUM
    offset = (page - 1) * page_size
    end_row = offset + page_size
    
    sql = f"""
        SELECT * FROM (
            SELECT a.*, ROWNUM rn FROM (
                SELECT station_id, center_id, station_name, location, latitude, longitude, 
                       operational, frequency_range
                FROM GROUND_STATION
                {where_clause}
                ORDER BY station_id DESC
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


@router.get("/{station_id}", response_model=GroundStationResponse)
async def get_ground_station(
    station_id: int,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(get_current_user),
):
    cursor = conn.cursor()
    cursor.execute("""
        SELECT station_id, center_id, station_name, location, latitude, longitude, 
               operational, frequency_range
        FROM GROUND_STATION 
        WHERE station_id = :id
    """, {"id": station_id})
    row = cursor.fetchone()
    if not row:
        cursor.close()
        raise HTTPException(status_code=404, detail="Ground station not found")
    columns = [col[0].lower() for col in cursor.description]
    result = dict(zip(columns, row))
    cursor.close()
    return result


@router.post("", response_model=GroundStationResponse, status_code=201)
async def create_ground_station(
    station: GroundStationCreate,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.OPERATOR])),
):
    cursor = conn.cursor()
    
    # Verify center exists if provided
    if station.center_id is not None:
        cursor.execute("SELECT 1 FROM CONTROL_CENTER WHERE center_id = :id", {"id": station.center_id})
        if not cursor.fetchone():
            cursor.close()
            raise HTTPException(status_code=404, detail="Control center not found")
    
    sql = """
        INSERT INTO GROUND_STATION (station_id, center_id, station_name, location, latitude, longitude, 
                                    operational, frequency_range)
        VALUES (SEQ_STATION_ID.NEXTVAL, :cid, :name, :loc, :lat, :lon, :op, :freq)
        RETURNING station_id INTO :sid
    """
    sid_var = cursor.var(oracledb.DB_TYPE_NUMBER)
    
    cursor.execute(sql, {
        "cid": station.center_id,
        "name": station.station_name,
        "loc": station.location,
        "lat": station.latitude,
        "lon": station.longitude,
        "op": station.operational,
        "freq": station.frequency_range,
        "sid": sid_var,
    })
    conn.commit()
    
    station_id = sid_var.getvalue()[0]
    cursor.close()
    
    return await get_ground_station(station_id, conn, current_user)


@router.put("/{station_id}", response_model=GroundStationResponse)
async def update_ground_station(
    station_id: int,
    station: GroundStationUpdate,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.OPERATOR])),
):
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM GROUND_STATION WHERE station_id = :id", {"id": station_id})
    if not cursor.fetchone():
        cursor.close()
        raise HTTPException(status_code=404, detail="Ground station not found")
    
    updates, params = [], {"id": station_id}
    
    if station.center_id is not None:
        # Verify center exists
        cursor.execute("SELECT 1 FROM CONTROL_CENTER WHERE center_id = :id", {"id": station.center_id})
        if not cursor.fetchone():
            cursor.close()
            raise HTTPException(status_code=404, detail="Control center not found")
        updates.append("center_id = :cid")
        params["cid"] = station.center_id
    if station.station_name is not None:
        updates.append("station_name = :name")
        params["name"] = station.station_name
    if station.location is not None:
        updates.append("location = :loc")
        params["loc"] = station.location
    if station.latitude is not None:
        updates.append("latitude = :lat")
        params["lat"] = station.latitude
    if station.longitude is not None:
        updates.append("longitude = :lon")
        params["lon"] = station.longitude
    if station.operational is not None:
        updates.append("operational = :op")
        params["op"] = station.operational
    if station.frequency_range is not None:
        updates.append("frequency_range = :freq")
        params["freq"] = station.frequency_range
    
    if not updates:
        cursor.close()
        raise HTTPException(status_code=400, detail="No fields to update")
    
    sql = f"UPDATE GROUND_STATION SET {', '.join(updates)} WHERE station_id = :id"
    cursor.execute(sql, params)
    conn.commit()
    cursor.close()
    return await get_ground_station(station_id, conn, current_user)


@router.delete("/{station_id}")
async def delete_ground_station(
    station_id: int,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(require_role([UserRole.ADMIN])),
):
    cursor = conn.cursor()
    cursor.execute("DELETE FROM GROUND_STATION WHERE station_id = :id", {"id": station_id})
    if cursor.rowcount == 0:
        cursor.close()
        raise HTTPException(status_code=404, detail="Ground station not found")
    conn.commit()
    cursor.close()
    return {"message": "Ground station deleted successfully"}