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
    count_sql = f"SELECT COUNT(*) FROM MISSIONS {where_clause}"
    cursor.execute(count_sql, params)
    total = cursor.fetchone()[0]
    
    # Fetch data with pagination
    offset = (page - 1) * page_size
    sql = f"""
        SELECT m.*, (SELECT COUNT(*) FROM SATELLITES WHERE mission_id = m.mission_id) as satellite_count
        FROM MISSIONS m
        {where_clause}
        ORDER BY m.created_at DESC
        OFFSET :offset ROWS FETCH NEXT :page_size ROWS ONLY
    """
    cursor.execute(sql, params + [offset, page_size])
    
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
    cursor.execute("SELECT * FROM MISSIONS WHERE mission_id = :id", {"id": mission_id})
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
        INSERT INTO MISSIONS (mission_id, mission_name, launch_date, end_date, status, objective, budget, lead_agency)
        VALUES (MISSION_SEQ.NEXTVAL, :name, :launch, :end, :status, :obj, :budget, :agency)
        RETURNING mission_id, created_at INTO :mid, :cat
    """
    mid_var = cursor.var(oracledb.DB_TYPE_NUMBER)
    cat_var = cursor.var(oracledb.DB_TYPE_TIMESTAMP)
    
    cursor.execute(sql, {
        "name": mission.mission_name,
        "launch": mission.launch_date,
        "end": mission.end_date,
        "status": mission.status.value,
        "obj": mission.objective,
        "budget": mission.budget,
        "agency": mission.lead_agency,
        "mid": mid_var,
        "cat": cat_var,
    })
    conn.commit()
    
    mission_id = mid_var.getvalue()[0]
    created_at = cat_var.getvalue()[0]
    cursor.close()
    
    return {
        "mission_id": mission_id,
        "mission_name": mission.mission_name,
        "launch_date": mission.launch_date,
        "end_date": mission.end_date,
        "status": mission.status.value,
        "objective": mission.objective,
        "budget": mission.budget,
        "lead_agency": mission.lead_agency,
        "created_at": created_at,
        "satellite_count": 0,
    }

@router.put("/{mission_id}", response_model=MissionResponse)
async def update_mission(
    mission_id: int,
    mission: MissionUpdate,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.OPERATOR])),
):
    cursor = conn.cursor()
    
    # Check exists
    cursor.execute("SELECT 1 FROM MISSIONS WHERE mission_id = :id", {"id": mission_id})
    if not cursor.fetchone():
        cursor.close()
        raise HTTPException(status_code=404, detail="Mission not found")
    
    # Build dynamic update
    updates = []
    params = {"id": mission_id}
    
    if mission.mission_name is not None:
        updates.append("mission_name = :name")
        params["name"] = mission.mission_name
    if mission.launch_date is not None:
        updates.append("launch_date = :launch")
        params["launch"] = mission.launch_date
    if mission.end_date is not None:
        updates.append("end_date = :end")
        params["end"] = mission.end_date
    if mission.status is not None:
        updates.append("status = :status")
        params["status"] = mission.status.value
    if mission.objective is not None:
        updates.append("objective = :obj")
        params["obj"] = mission.objective
    if mission.budget is not None:
        updates.append("budget = :budget")
        params["budget"] = mission.budget
    if mission.lead_agency is not None:
        updates.append("lead_agency = :agency")
        params["agency"] = mission.lead_agency
    
    if not updates:
        cursor.close()
        raise HTTPException(status_code=400, detail="No fields to update")
    
    updates.append("updated_at = CURRENT_TIMESTAMP")
    sql = f"UPDATE MISSIONS SET {', '.join(updates)} WHERE mission_id = :id"
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
    cursor.execute("DELETE FROM MISSIONS WHERE mission_id = :id", {"id": mission_id})
    if cursor.rowcount == 0:
        cursor.close()
        raise HTTPException(status_code=404, detail="Mission not found")
    conn.commit()
    cursor.close()
    return {"message": "Mission deleted successfully"}