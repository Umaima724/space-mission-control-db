SET SERVEROUTPUT ON

PROMPT ============================================
PROMPT Cursor Demo 1: Explicit Cursor - Station Contacts
PROMPT ============================================

DECLARE
    CURSOR cur_station_contacts (p_station_id NUMBER) IS
        SELECT cw.window_id, s.satellite_name, cw.start_time, cw.end_time, cw.signal_strength
        FROM CONTACT_WINDOW cw
        JOIN SATELLITE s ON cw.satellite_id = s.satellite_id
        WHERE cw.station_id = p_station_id
        ORDER BY cw.start_time;

    v_window_id       NUMBER;
    v_satellite_name  VARCHAR2(100);
    v_start_time      TIMESTAMP;
    v_end_time        TIMESTAMP;
    v_signal_strength NUMBER(6,2);
BEGIN
    DBMS_OUTPUT.PUT_LINE('--- Contact Windows for Station ID 5001 ---');
    OPEN cur_station_contacts(5001);
    LOOP
        FETCH cur_station_contacts INTO v_window_id, v_satellite_name, v_start_time, v_end_time, v_signal_strength;
        EXIT WHEN cur_station_contacts%NOTFOUND;
        DBMS_OUTPUT.PUT_LINE(
            'Window ' || v_window_id || ': ' || v_satellite_name || 
            ' [' || TO_CHAR(v_start_time, 'HH24:MI') || '-' || TO_CHAR(v_end_time, 'HH24:MI') || 
            '] Signal: ' || v_signal_strength || ' dBm'
        );
    END LOOP;
    CLOSE cur_station_contacts;
    DBMS_OUTPUT.PUT_LINE('Total rows fetched: ' || cur_station_contacts%ROWCOUNT);
END;
/

PROMPT ============================================
PROMPT Cursor Demo 2: Parameterized Cursor - Critical Anomalies
PROMPT ============================================

DECLARE
    CURSOR cur_critical_anomalies (p_mission_id NUMBER) IS
        SELECT ar.anomaly_id, s.satellite_name, ar.severity, ar.description, ar.reported_at
        FROM ANOMALY_REPORT ar
        JOIN SATELLITE s ON ar.satellite_id = s.satellite_id
        WHERE s.mission_id = p_mission_id
        AND ar.severity IN ('HIGH', 'CRITICAL')
        AND ar.resolved = 'N'
        ORDER BY ar.reported_at;

    v_anomaly_id   NUMBER;
    v_sat_name     VARCHAR2(100);
    v_severity     VARCHAR2(10);
    v_description  VARCHAR2(1000);
    v_reported_at  TIMESTAMP;
BEGIN
    DBMS_OUTPUT.PUT_LINE('--- Critical Anomalies for Mission 1003 (Starlink) ---');
    OPEN cur_critical_anomalies(1003);
    LOOP
        FETCH cur_critical_anomalies INTO v_anomaly_id, v_sat_name, v_severity, v_description, v_reported_at;
        EXIT WHEN cur_critical_anomalies%NOTFOUND;
        DBMS_OUTPUT.PUT_LINE(
            '[' || v_severity || '] ' || v_sat_name || ' (Anomaly #' || v_anomaly_id || '): ' ||
            SUBSTR(v_description, 1, 60) || '...'
        );
    END LOOP;
    CLOSE cur_critical_anomalies;
END;
/

PROMPT ============================================
PROMPT Cursor Demo 3: FOR LOOP Cursor - All Active Satellites Health
PROMPT ============================================

DECLARE
    CURSOR cur_satellite_health IS
        SELECT s.satellite_id, s.satellite_name, s.status,
               tl.battery_pct, tl.temperature_c, tl.signal_dbm
        FROM SATELLITE s
        LEFT JOIN TELEMETRY_LOG tl ON s.satellite_id = tl.satellite_id
        WHERE tl.recorded_at = (
            SELECT MAX(recorded_at) FROM TELEMETRY_LOG WHERE satellite_id = s.satellite_id
        )
        AND s.status = 'ACTIVE';
BEGIN
    DBMS_OUTPUT.PUT_LINE('--- Active Satellite Health Status ---');
    DBMS_OUTPUT.PUT_LINE(RPAD('Satellite', 25) || RPAD('Battery%', 10) || RPAD('Temp(C)', 10) || 'Signal(dBm)');
    DBMS_OUTPUT.PUT_LINE('----------------------------------------------------------');

    FOR rec IN cur_satellite_health LOOP
        DBMS_OUTPUT.PUT_LINE(
            RPAD(rec.satellite_name, 25) || 
            RPAD(NVL(TO_CHAR(rec.battery_pct), 'N/A'), 10) ||
            RPAD(NVL(TO_CHAR(rec.temperature_c), 'N/A'), 10) ||
            NVL(TO_CHAR(rec.signal_dbm), 'N/A')
        );
    END LOOP;
END;
/

PROMPT ============================================
PROMPT Cursor Demo 4: REF CURSOR - Dynamic Mission Query
PROMPT ============================================

DECLARE
    TYPE ref_cursor IS REF CURSOR;
    v_cursor ref_cursor;
    v_mission_id     NUMBER;
    v_mission_name   VARCHAR2(150);
    v_status         VARCHAR2(20);
    v_satellite_count NUMBER;
    v_query          VARCHAR2(500);
BEGIN
    v_query := 'SELECT m.mission_id, m.mission_name, m.status, COUNT(s.satellite_id) ' ||
               'FROM MISSION m LEFT JOIN SATELLITE s ON m.mission_id = s.mission_id ' ||
               'WHERE m.status = :1 ' ||
               'GROUP BY m.mission_id, m.mission_name, m.status';

    DBMS_OUTPUT.PUT_LINE('--- Active Missions with Satellite Count ---');
    OPEN v_cursor FOR v_query USING 'ACTIVE';
    LOOP
        FETCH v_cursor INTO v_mission_id, v_mission_name, v_status, v_satellite_count;
        EXIT WHEN v_cursor%NOTFOUND;
        DBMS_OUTPUT.PUT_LINE(
            'Mission ' || v_mission_id || ': ' || RPAD(v_mission_name, 30) ||
            ' Status: ' || v_status || ' | Satellites: ' || v_satellite_count
        );
    END LOOP;
    CLOSE v_cursor;
END;
/

PROMPT ============================================
PROMPT Cursor Demo 5: BULK COLLECT - Fetch all telemetry into collection
PROMPT ============================================

DECLARE
    TYPE t_telemetry IS TABLE OF TELEMETRY_LOG%ROWTYPE;
    v_telemetry t_telemetry;
BEGIN
    SELECT * BULK COLLECT INTO v_telemetry
    FROM TELEMETRY_LOG
    WHERE battery_pct < 50
    ORDER BY recorded_at DESC;

    DBMS_OUTPUT.PUT_LINE('--- Low Battery Telemetry Records (Bulk Collect) ---');
    DBMS_OUTPUT.PUT_LINE('Total records with battery < 50%: ' || v_telemetry.COUNT);

    FOR i IN 1..LEAST(v_telemetry.COUNT, 5) LOOP
        DBMS_OUTPUT.PUT_LINE(
            'Log #' || v_telemetry(i).log_id || 
            ' | Sat: ' || v_telemetry(i).satellite_id ||
            ' | Battery: ' || v_telemetry(i).battery_pct || '%' ||
            ' | Time: ' || TO_CHAR(v_telemetry(i).recorded_at, 'YYYY-MM-DD HH24:MI:SS')
        );
    END LOOP;
END;
/

PROMPT ============================================
PROMPT Cursor Demo 6: Update using WHERE CURRENT OF
PROMPT ============================================

DECLARE
    CURSOR cur_old_telemetry IS
        SELECT log_id, satellite_id, battery_pct
        FROM TELEMETRY_LOG
        WHERE recorded_at < SYSTIMESTAMP - INTERVAL '30' DAY
        AND battery_pct > 95
        FOR UPDATE;
BEGIN
    DBMS_OUTPUT.PUT_LINE('--- Marking old high-battery telemetry as archived ---');
    FOR rec IN cur_old_telemetry LOOP
        -- In real scenario, you might move to archive table
        DBMS_OUTPUT.PUT_LINE('Would archive Log #' || rec.log_id || ' (Satellite ' || rec.satellite_id || ')');
    END LOOP;
END;
/

PROMPT ============================================
PROMPT All Cursor Demonstrations Completed
PROMPT ============================================