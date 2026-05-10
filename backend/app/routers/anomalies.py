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
    resolved: Optional[str] = None,
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
    if resolved:
        conditions.append("a.resolved = :resolved")
        params.append(resolved)
    
    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
    
    count_sql = f"SELECT COUNT(*) FROM ANOMALY_REPORT a {where_clause}"
    cursor.execute(count_sql, params)
    total = cursor.fetchone()[0]
    
    # Oracle 11g pagination with ROWNUM
    offset = (page - 1) * page_size
    end_row = offset + page_size
    
    sql = f"""
        SELECT * FROM (
            SELECT b.*, ROWNUM rn FROM (
                SELECT a.anomaly_id, a.satellite_id, a.reported_by, a.severity,
                       a.description, a.reported_at, a.resolved, a.resolution_note,
                       s.satellite_name
                FROM ANOMALY_REPORT a
                JOIN SATELLITE s ON a.satellite_id = s.satellite_id
                {where_clause}
                ORDER BY 
                    CASE a.severity 
                        WHEN 'CRITICAL' THEN 1 
                        WHEN 'HIGH' THEN 2 
                        WHEN 'MEDIUM' THEN 3 
                        WHEN 'LOW' THEN 4 
                    END,
                    a.reported_at DESC
            ) b WHERE ROWNUM <= :end_row
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


@router.get("/{anomaly_id}", response_model=AnomalyResponse)
async def get_anomaly(
    anomaly_id: int,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(get_current_user),
):
    cursor = conn.cursor()
    cursor.execute("""
        SELECT a.anomaly_id, a.satellite_id, a.reported_by, a.severity,
               a.description, a.reported_at, a.resolved, a.resolution_note,
               s.satellite_name 
        FROM ANOMALY_REPORT a 
        JOIN SATELLITE s ON a.satellite_id = s.satellite_id 
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
    
    # Verify satellite exists
    cursor.execute("SELECT satellite_name FROM SATELLITE WHERE satellite_id = :id", {"id": anomaly.satellite_id})
    sat_row = cursor.fetchone()
    if not sat_row:
        cursor.close()
        raise HTTPException(status_code=404, detail="Satellite not found")
    
    satellite_name = sat_row[0]
    
    # Verify operator exists
    cursor.execute("SELECT 1 FROM OPERATOR WHERE operator_id = :id", {"id": anomaly.reported_by})
    if not cursor.fetchone():
        cursor.close()
        raise HTTPException(status_code=404, detail="Operator not found")
    
    sql = """
        INSERT INTO ANOMALY_REPORT (anomaly_id, satellite_id, reported_by, severity, description, reported_at, resolved, resolution_note)
        VALUES (SEQ_ANOMALY_ID.NEXTVAL, :sid, :rby, :sev, :desc, :rat, :res, :rnote)
        RETURNING anomaly_id, reported_at INTO :aid, :rat_out
    """
    aid_var = cursor.var(oracledb.DB_TYPE_NUMBER)
    rat_var = cursor.var(oracledb.DB_TYPE_TIMESTAMP)
    
    cursor.execute(sql, {
        "sid": anomaly.satellite_id,
        "rby": anomaly.reported_by,
        "sev": anomaly.severity,
        "desc": anomaly.description,
        "rat": anomaly.reported_at,
        "res": anomaly.resolved,
        "rnote": anomaly.resolution_note,
        "aid": aid_var,
        "rat_out": rat_var,
    })
    conn.commit()
    
    anomaly_id = aid_var.getvalue()[0]
    reported_at = rat_var.getvalue()[0]
    cursor.close()
    
    return {
        "anomaly_id": anomaly_id,
        "satellite_id": anomaly.satellite_id,
        "reported_by": anomaly.reported_by,
        "severity": anomaly.severity,
        "description": anomaly.description,
        "reported_at": reported_at,
        "resolved": anomaly.resolved,
        "resolution_note": anomaly.resolution_note,
        "satellite_name": satellite_name,
    }


@router.put("/{anomaly_id}", response_model=AnomalyResponse)
async def update_anomaly(
    anomaly_id: int,
    anomaly: AnomalyUpdate,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.OPERATOR])),
):
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM ANOMALY_REPORT WHERE anomaly_id = :id", {"id": anomaly_id})
    if not cursor.fetchone():
        cursor.close()
        raise HTTPException(status_code=404, detail="Anomaly not found")
    
    updates, params = [], {"id": anomaly_id}
    
    if anomaly.severity is not None:
        updates.append("severity = :sev")
        params["sev"] = anomaly.severity
    if anomaly.description is not None:
        updates.append("description = :desc")
        params["desc"] = anomaly.description
    if anomaly.resolved is not None:
        updates.append("resolved = :res")
        params["res"] = anomaly.resolved
    if anomaly.resolution_note is not None:
        updates.append("resolution_note = :rnote")
        params["rnote"] = anomaly.resolution_note
    
    if not updates:
        cursor.close()
        raise HTTPException(status_code=400, detail="No fields to update")
    
    sql = f"UPDATE ANOMALY_REPORT SET {', '.join(updates)} WHERE anomaly_id = :id"
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
    cursor.execute("DELETE FROM ANOMALY_REPORT WHERE anomaly_id = :id", {"id": anomaly_id})
    if cursor.rowcount == 0:
        cursor.close()
        raise HTTPException(status_code=404, detail="Anomaly not found")
    conn.commit()
    cursor.close()
    return {"message": "Anomaly deleted successfully"}