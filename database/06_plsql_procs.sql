PROMPT ============================================
PROMPT Creating Stored Procedures
PROMPT ============================================

-- Procedure 1: Add new satellite with validation
CREATE OR REPLACE PROCEDURE proc_add_satellite (
    p_mission_id      IN  NUMBER,
    p_satellite_name  IN  VARCHAR2,
    p_orbit_id        IN  NUMBER,
    p_mass_kg         IN  NUMBER,
    p_frequency_mhz   IN  NUMBER,
    p_status          IN  VARCHAR2 DEFAULT 'ACTIVE',
    p_launch_date     IN  DATE DEFAULT SYSDATE,
    p_new_satellite_id OUT NUMBER
) AS
    v_count NUMBER;
BEGIN
    -- Validate mission exists
    SELECT COUNT(*) INTO v_count FROM MISSION WHERE mission_id = p_mission_id;
    IF v_count = 0 THEN
        RAISE_APPLICATION_ERROR(-20001, 'Mission ID does not exist: ' || p_mission_id);
    END IF;

    -- Validate orbit exists
    SELECT COUNT(*) INTO v_count FROM ORBIT WHERE orbit_id = p_orbit_id;
    IF v_count = 0 THEN
        RAISE_APPLICATION_ERROR(-20002, 'Orbit ID does not exist: ' || p_orbit_id);
    END IF;

    -- Validate frequency uniqueness
    SELECT COUNT(*) INTO v_count FROM SATELLITE WHERE frequency_mhz = p_frequency_mhz;
    IF v_count > 0 THEN
        RAISE_APPLICATION_ERROR(-20003, 'Frequency already in use: ' || p_frequency_mhz);
    END IF;

    -- Insert new satellite
    SELECT SEQ_SATELLITE_ID.NEXTVAL INTO p_new_satellite_id FROM DUAL;

    INSERT INTO SATELLITE (satellite_id, mission_id, orbit_id, satellite_name, mass_kg, frequency_mhz, status, launch_date)
    VALUES (p_new_satellite_id, p_mission_id, p_orbit_id, p_satellite_name, p_mass_kg, p_frequency_mhz, p_status, p_launch_date);

    -- Log audit
    proc_log_audit('SATELLITE', 'INSERT', p_new_satellite_id, 'proc_add_satellite', 'New satellite added: ' || p_satellite_name);

    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Satellite added successfully. ID: ' || p_new_satellite_id);
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
/

-- Procedure 2: Resolve anomaly with nested audit call
CREATE OR REPLACE PROCEDURE proc_resolve_anomaly (
    p_anomaly_id      IN NUMBER,
    p_resolution_note IN VARCHAR2,
    p_operator_id     IN NUMBER
) AS
    v_satellite_id NUMBER;
    v_resolved CHAR(1);
BEGIN
    -- Check if anomaly exists and is not already resolved
    SELECT satellite_id, resolved INTO v_satellite_id, v_resolved
    FROM ANOMALY_REPORT WHERE anomaly_id = p_anomaly_id;

    IF v_resolved = 'Y' THEN
        RAISE_APPLICATION_ERROR(-20004, 'Anomaly already resolved: ' || p_anomaly_id);
    END IF;

    -- Update anomaly
    UPDATE ANOMALY_REPORT 
    SET resolved = 'Y', 
        resolution_note = p_resolution_note,
        reported_by = p_operator_id
    WHERE anomaly_id = p_anomaly_id;

    -- Nested call to audit log
    proc_log_audit('ANOMALY_REPORT', 'UPDATE', p_anomaly_id, 'proc_resolve_anomaly', 
                   'Resolved: ' || p_resolution_note);

    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Anomaly ' || p_anomaly_id || ' resolved successfully.');
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20005, 'Anomaly not found: ' || p_anomaly_id);
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
/

-- Procedure 3: Generic audit logger
CREATE OR REPLACE PROCEDURE proc_log_audit (
    p_table_name  IN VARCHAR2,
    p_action      IN VARCHAR2,
    p_record_id   IN NUMBER,
    p_changed_by  IN VARCHAR2,
    p_notes       IN VARCHAR2 DEFAULT NULL
) AS
BEGIN
    INSERT INTO AUDIT_LOG (audit_id, table_name, action, record_id, changed_by, changed_at, notes)
    VALUES (SEQ_ANOMALY_ID.NEXTVAL, p_table_name, p_action, p_record_id, p_changed_by, SYSTIMESTAMP, p_notes);
    COMMIT;
END;
/

-- Procedure 4: Schedule contact window
CREATE OR REPLACE PROCEDURE proc_schedule_contact (
    p_satellite_id    IN NUMBER,
    p_station_id      IN NUMBER,
    p_start_time      IN TIMESTAMP,
    p_end_time        IN TIMESTAMP,
    p_signal_strength IN NUMBER DEFAULT NULL,
    p_window_id       OUT NUMBER
) AS
    v_count NUMBER;
BEGIN
    -- Validate satellite exists and is active
    SELECT COUNT(*) INTO v_count FROM SATELLITE 
    WHERE satellite_id = p_satellite_id AND status = 'ACTIVE';
    IF v_count = 0 THEN
        RAISE_APPLICATION_ERROR(-20006, 'Satellite not found or not active: ' || p_satellite_id);
    END IF;

    -- Validate station is operational
    SELECT COUNT(*) INTO v_count FROM GROUND_STATION 
    WHERE station_id = p_station_id AND operational = 'Y';
    IF v_count = 0 THEN
        RAISE_APPLICATION_ERROR(-20007, 'Ground station not found or not operational: ' || p_station_id);
    END IF;

    -- Check time conflict
    SELECT COUNT(*) INTO v_count FROM CONTACT_WINDOW
    WHERE station_id = p_station_id 
    AND ((p_start_time BETWEEN start_time AND end_time) 
         OR (p_end_time BETWEEN start_time AND end_time)
         OR (start_time BETWEEN p_start_time AND p_end_time));
    IF v_count > 0 THEN
        RAISE_APPLICATION_ERROR(-20008, 'Time conflict at ground station: ' || p_station_id);
    END IF;

    SELECT SEQ_WINDOW_ID.NEXTVAL INTO p_window_id FROM DUAL;

    INSERT INTO CONTACT_WINDOW (window_id, satellite_id, station_id, start_time, end_time, signal_strength)
    VALUES (p_window_id, p_satellite_id, p_station_id, p_start_time, p_end_time, p_signal_strength);

    proc_log_audit('CONTACT_WINDOW', 'INSERT', p_window_id, 'proc_schedule_contact', 'Contact scheduled');
    COMMIT;
END;
/

-- Procedure 5: Generate mission report
CREATE OR REPLACE PROCEDURE proc_generate_mission_report (
    p_mission_id IN NUMBER,
    p_report     OUT CLOB
) AS
    v_mission_name VARCHAR2(150);
    v_status VARCHAR2(20);
    v_sat_count NUMBER;
    v_anomaly_count NUMBER;
BEGIN
    SELECT mission_name, status INTO v_mission_name, v_status
    FROM MISSION WHERE mission_id = p_mission_id;

    SELECT COUNT(*) INTO v_sat_count FROM SATELLITE WHERE mission_id = p_mission_id;
    SELECT COUNT(*) INTO v_anomaly_count 
    FROM ANOMALY_REPORT ar JOIN SATELLITE s ON ar.satellite_id = s.satellite_id
    WHERE s.mission_id = p_mission_id AND ar.resolved = 'N';

    p_report := 'MISSION REPORT' || CHR(10) ||
                '===============' || CHR(10) ||
                'Mission: ' || v_mission_name || CHR(10) ||
                'Status: ' || v_status || CHR(10) ||
                'Satellites: ' || v_sat_count || CHR(10) ||
                'Open Anomalies: ' || v_anomaly_count || CHR(10) ||
                'Generated: ' || TO_CHAR(SYSDATE, 'YYYY-MM-DD HH24:MI:SS');
END;
/

PROMPT ============================================
PROMPT Stored Procedures Created Successfully
PROMPT ============================================