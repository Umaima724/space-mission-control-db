"""Mission CRUD router."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
import oracledb
from ..database import get_db_dependency
from ..models import MissionCreate, MissionUpdate, MissionResponse, PaginatedResponse
from ..routers.auth import get_current_user, require_role, UserRole

router = APIRouter(prefix="/missions", tags=["Missions"])


@router.get("", response_model=PaginatedResponse)
async def list_missions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(get_current_user),
):
    cursor = conn.cursor()
    
    # Build WHERE clause
    conditions = []
    params = []
    if status:
        conditions.append("status = :status")
        params.append(status)
    if search:
        conditions.append("(LOWER(mission_name) LIKE :search OR LOWER(objective) LIKE :search)")
        params.append(f"%{search.lower()}%")
    
    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
    
    # Count total
    count_sql = f"SELECT COUNT(*) FROM MISSION {where_clause}"
    cursor.execute(count_sql, params)
    total = cursor.fetchone()[0]
    
    # Fetch data with Oracle 11g pagination using ROWNUM
    offset = (page - 1) * page_size
    end_row = offset + page_size
    
    sql = f"""
        SELECT * FROM (
            SELECT a.*, ROWNUM rn FROM (
                SELECT m.mission_id, m.mission_name, m.mission_type, m.launch_date,
                       m.status, m.objective, m.agency_name,
                       (SELECT COUNT(*) FROM SATELLITE WHERE mission_id = m.mission_id) as satellite_count
                FROM MISSION m
                {where_clause}
                ORDER BY m.launch_date DESC
            ) a WHERE ROWNUM <= :end_row
        ) WHERE rn > :offset
    """
    cursor.execute(sql, params + [end_row, offset])
    
    columns = [col[0].lower() for col in cursor.description]
    items = []
    for row in cursor:
        items.append(dict(zip(columns, row)))
    
    cursor.close()
    
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{mission_id}", response_model=MissionResponse)
async def get_mission(
    mission_id: int,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(get_current_user),
):
    cursor = conn.cursor()
    cursor.execute("""
        SELECT mission_id, mission_name, mission_type, launch_date, status, objective, agency_name
        FROM MISSION 
        WHERE mission_id = :id
    """, {"id": mission_id})
    row = cursor.fetchone()
    if not row:
        cursor.close()
        raise HTTPException(status_code=404, detail="Mission not found")
    
    columns = [col[0].lower() for col in cursor.description]
    result = dict(zip(columns, row))
    cursor.close()
    return result


@router.post("", response_model=MissionResponse, status_code=201)
async def create_mission(
    mission: MissionCreate,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.OPERATOR])),
):
    cursor = conn.cursor()
    
    sql = """
        INSERT INTO MISSION (mission_id, mission_name, mission_type, launch_date, status, objective, agency_name)
        VALUES (SEQ_MISSION_ID.NEXTVAL, :name, :mtype, :launch, :status, :obj, :agency)
        RETURNING mission_id INTO :mid
    """
    mid_var = cursor.var(oracledb.DB_TYPE_NUMBER)
    
    cursor.execute(sql, {
        "name": mission.mission_name,
        "mtype": mission.mission_type,
        "launch": mission.launch_date,
        "status": mission.status,
        "obj": mission.objective,
        "agency": mission.agency_name,
        "mid": mid_var,
    })
    conn.commit()
    
    mission_id = mid_var.getvalue()[0]
    cursor.close()
    
    return await get_mission(mission_id, conn, current_user)


@router.put("/{mission_id}", response_model=MissionResponse)
async def update_mission(
    mission_id: int,
    mission: MissionUpdate,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.OPERATOR])),
):
    cursor = conn.cursor()
    
    # Check exists
    cursor.execute("SELECT 1 FROM MISSION WHERE mission_id = :id", {"id": mission_id})
    if not cursor.fetchone():
        cursor.close()
        raise HTTPException(status_code=404, detail="Mission not found")
    
    # Build dynamic update
    updates = []
    params = {"id": mission_id}
    
    if mission.mission_name is not None:
        updates.append("mission_name = :name")
        params["name"] = mission.mission_name
    if mission.mission_type is not None:
        updates.append("mission_type = :mtype")
        params["mtype"] = mission.mission_type
    if mission.launch_date is not None:
        updates.append("launch_date = :launch")
        params["launch"] = mission.launch_date
    if mission.status is not None:
        updates.append("status = :status")
        params["status"] = mission.status
    if mission.objective is not None:
        updates.append("objective = :obj")
        params["obj"] = mission.objective
    if mission.agency_name is not None:
        updates.append("agency_name = :agency")
        params["agency"] = mission.agency_name
    
    if not updates:
        cursor.close()
        raise HTTPException(status_code=400, detail="No fields to update")
    
    sql = f"UPDATE MISSION SET {', '.join(updates)} WHERE mission_id = :id"
    cursor.execute(sql, params)
    conn.commit()
    cursor.close()
    
    return await get_mission(mission_id, conn, current_user)


@router.delete("/{mission_id}")
async def delete_mission(
    mission_id: int,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(require_role([UserRole.ADMIN])),
):
    cursor = conn.cursor()
    cursor.execute("DELETE FROM MISSION WHERE mission_id = :id", {"id": mission_id})
    if cursor.rowcount == 0:
        cursor.close()
        raise HTTPException(status_code=404, detail="Mission not found")
    conn.commit()
    cursor.close()
    return {"message": "Mission deleted successfully"}