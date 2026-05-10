"""Anomaly CRUD router."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
import oracledb
from ..database import get_db_dependency
from ..models import AnomalyCreate, AnomalyUpdate, AnomalyResponse, PaginatedResponse
from ..routers.auth import get_current_user, require_role, UserRole

router = APIRouter(prefix="/anomalies", tags=["Anomalies"])

@router.get("", response_model=PaginatedResponse)
async def list_anomalies(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    satellite_id: Optional[int] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(get_current_user),
):
    cursor = conn.cursor()
    
    conditions = []
    params = []
    if satellite_id:
        conditions.append("a.satellite_id = :sid")
        params.append(satellite_id)
    if severity:
        conditions.append("a.severity = :sev")
        params.append(severity)
    if status:
        conditions.append("a.status = :status")
        params.append(status)
    
    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
    
    count_sql = f"SELECT COUNT(*) FROM ANOMALIES a {where_clause}"
    cursor.execute(count_sql, params)
    total = cursor.fetchone()[0]
    
    offset = (page - 1) * page_size
    sql = f"""
        SELECT a.*, s.satellite_name
        FROM ANOMALIES a
        JOIN SATELLITES s ON a.satellite_id = s.satellite_id
        {where_clause}
        ORDER BY 
            CASE a.severity 
                WHEN 'CRITICAL' THEN 1 
                WHEN 'HIGH' THEN 2 
                WHEN 'MEDIUM' THEN 3 
                WHEN 'LOW' THEN 4 
            END,
            a.detected_at DESC
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

@router.get("/{anomaly_id}", response_model=AnomalyResponse)
async def get_anomaly(
    anomaly_id: int,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(get_current_user),
):
    cursor = conn.cursor()
    cursor.execute("""
        SELECT a.*, s.satellite_name 
        FROM ANOMALIES a 
        JOIN SATELLITES s ON a.satellite_id = s.satellite_id 
        WHERE a.anomaly_id = :id
    """, {"id": anomaly_id})
    row = cursor.fetchone()
    if not row:
        cursor.close()
        raise HTTPException(status_code=404, detail="Anomaly not found")
    columns = [col[0].lower() for col in cursor.description]
    result = dict(zip(columns, row))
    cursor.close()
    return result

@router.post("", response_model=AnomalyResponse, status_code=201)
async def create_anomaly(
    anomaly: AnomalyCreate,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.OPERATOR])),
):
    cursor = conn.cursor()
    
    cursor.execute("SELECT 1 FROM SATELLITES WHERE satellite_id = :id", {"id": anomaly.satellite_id})
    if not cursor.fetchone():
        cursor.close()
        raise HTTPException(status_code=404, detail="Satellite not found")
    
    sql = """
        INSERT INTO ANOMALIES (anomaly_id, satellite_id, detected_at, severity, description, status, resolved_at, resolved_by)
        VALUES (ANOMALY_SEQ.NEXTVAL, :sid, :detected, :severity, :desc, :status, :resolved, :resolved_by)
        RETURNING anomaly_id, created_at INTO :aid, :cat
    """
    aid_var = cursor.var(oracledb.DB_TYPE_NUMBER)
    cat_var = cursor.var(oracledb.DB_TYPE_TIMESTAMP)
    
    cursor.execute(sql, {
        "sid": anomaly.satellite_id,
        "detected": anomaly.detected_at,
        "severity": anomaly.severity.value,
        "desc": anomaly.description,
        "status": anomaly.status.value,
        "resolved": anomaly.resolved_at,
        "resolved_by": anomaly.resolved_by,
        "aid": aid_var,
        "cat": cat_var,
    })
    conn.commit()
    
    anomaly_id = aid_var.getvalue()[0]
    created_at = cat_var.getvalue()[0]
    cursor.close()
    
    return {
        "anomaly_id": anomaly_id,
        "satellite_id": anomaly.satellite_id,
        "detected_at": anomaly.detected_at,
        "severity": anomaly.severity.value,
        "description": anomaly.description,
        "status": anomaly.status.value,
        "resolved_at": anomaly.resolved_at,
        "resolved_by": anomaly.resolved_by,
        "created_at": created_at,
        "satellite_name": None,
    }

@router.put("/{anomaly_id}", response_model=AnomalyResponse)
async def update_anomaly(
    anomaly_id: int,
    anomaly: AnomalyUpdate,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.OPERATOR])),
):
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM ANOMALIES WHERE anomaly_id = :id", {"id": anomaly_id})
    if not cursor.fetchone():
        cursor.close()
        raise HTTPException(status_code=404, detail="Anomaly not found")
    
    updates, params = [], {"id": anomaly_id}
    
    if anomaly.severity is not None:
        updates.append("severity = :sev"); params["sev"] = anomaly.severity.value
    if anomaly.description is not None:
        updates.append("description = :desc"); params["desc"] = anomaly.description
    if anomaly.status is not None:
        updates.append("status = :status"); params["status"] = anomaly.status.value
    if anomaly.resolved_at is not None:
        updates.append("resolved_at = :resolved"); params["resolved"] = anomaly.resolved_at
    if anomaly.resolved_by is not None:
        updates.append("resolved_by = :resolved_by"); params["resolved_by"] = anomaly.resolved_by
    
    if not updates:
        cursor.close()
        raise HTTPException(status_code=400, detail="No fields to update")
    
    updates.append("updated_at = CURRENT_TIMESTAMP")
    sql = f"UPDATE ANOMALIES SET {', '.join(updates)} WHERE anomaly_id = :id"
    cursor.execute(sql, params)
    conn.commit()
    cursor.close()
    return await get_anomaly(anomaly_id, conn, current_user)

@router.delete("/{anomaly_id}")
async def delete_anomaly(
    anomaly_id: int,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(require_role([UserRole.ADMIN])),
):
    cursor = conn.cursor()
    cursor.execute("DELETE FROM ANOMALIES WHERE anomaly_id = :id", {"id": anomaly_id})
    if cursor.rowcount == 0:
        cursor.close()
        raise HTTPException(status_code=404, detail="Anomaly not found")
    conn.commit()
    cursor.close()
    return {"message": "Anomaly deleted successfully"}