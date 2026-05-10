"""PDF/CSV export router."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import oracledb
import io
import csv
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from ..database import get_db_dependency
from ..models import ReportRequest
from ..routers.auth import get_current_user, require_role, UserRole

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.post("/generate")
async def generate_report(
    request: ReportRequest,
    conn: oracledb.Connection = Depends(get_db_dependency),
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.OPERATOR])),
):
    cursor = conn.cursor()
    
    # Determine query based on report type
    if request.report_type == "MISSIONS":
        sql = """
            SELECT mission_id, mission_name, mission_type, launch_date, status, 
                   objective, agency_name
            FROM MISSION 
            ORDER BY launch_date DESC
        """
        headers = ["ID", "Name", "Type", "Launch Date", "Status", "Objective", "Agency"]
        
    elif request.report_type == "SATELLITES":
        sql = """
            SELECT s.satellite_id, s.satellite_name, s.mass_kg, s.frequency_mhz,
                   s.status, s.launch_date, m.mission_name 
            FROM SATELLITE s 
            LEFT JOIN MISSION m ON s.mission_id = m.mission_id 
            ORDER BY s.launch_date DESC
        """
        headers = ["ID", "Name", "Mass (kg)", "Frequency (MHz)", "Status", "Launch Date", "Mission"]
        
    elif request.report_type == "TELEMETRY":
        sql = """
            SELECT t.log_id, s.satellite_name, t.recorded_at, t.temperature_c,
                   t.battery_pct, t.signal_dbm, t.altitude_km
            FROM TELEMETRY_LOG t 
            JOIN SATELLITE s ON t.satellite_id = s.satellite_id 
            ORDER BY t.recorded_at DESC
        """
        headers = ["Log ID", "Satellite", "Recorded At", "Temp (°C)", "Battery (%)", "Signal (dBm)", "Altitude (km)"]
        
    elif request.report_type == "ANOMALY_REPORT":
        sql = """
            SELECT a.anomaly_id, s.satellite_name, a.reported_at, a.severity,
                   a.description, a.resolved, a.resolution_note, o.full_name as reported_by
            FROM ANOMALY_REPORT a 
            JOIN SATELLITE s ON a.satellite_id = s.satellite_id 
            LEFT JOIN OPERATOR o ON a.reported_by = o.operator_id
            ORDER BY a.reported_at DESC
        """
        headers = ["ID", "Satellite", "Reported At", "Severity", "Description", "Resolved", "Resolution Note", "Reported By"]
        
    else:
        raise HTTPException(status_code=400, detail="Invalid report type")
    
    cursor.execute(sql)
    rows = cursor.fetchall()
    cursor.close()
    
    if request.format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        for row in rows:
            writer.writerow([str(cell) if cell is not None else "" for cell in row])
        
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={request.report_type.lower()}_report.csv"}
        )
    
    elif request.format == "pdf":
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=landscape(letter), 
            topMargin=0.5*inch, 
            bottomMargin=0.5*inch
        )
        elements = []
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "CustomTitle",
            parent=styles["Heading1"],
            fontSize=18,
            textColor=colors.HexColor("#1e3a5f"),
            spaceAfter=20,
        )
        
        elements.append(Paragraph(f"Space Mission Control - {request.report_type} Report", title_style))
        elements.append(Spacer(1, 12))
        
        # Prepare table data
        table_data = [headers]
        for row in rows:
            table_data.append([str(cell) if cell is not None else "N/A" for cell in row])
        
        table = Table(table_data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 10),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
            ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
            ("GRID", (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
        ]))
        
        elements.append(table)
        doc.build(elements)
        
        buffer.seek(0)
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={request.report_type.lower()}_report.pdf"}
        )
    
    else:
        raise HTTPException(status_code=400, detail="Format must be 'pdf' or 'csv'")