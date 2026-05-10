PROMPT ============================================
PROMPT Creating Package Specification
PROMPT ============================================

CREATE OR REPLACE PACKAGE pkg_mission_ops AS
    -- Package-level constant
    MAX_SEVERITY CONSTANT NUMBER := 4;

    -- Type definitions
    TYPE t_satellite_list IS TABLE OF SATELLITE%ROWTYPE;
    TYPE t_anomaly_summary IS RECORD (
        severity VARCHAR2(10),
        count NUMBER,
        oldest TIMESTAMP
    );

    -- Procedure: Add new satellite (wrapper around standalone proc)
    PROCEDURE p_add_satellite (
        p_mission_id      IN  NUMBER,
        p_satellite_name  IN  VARCHAR2,
        p_orbit_id        IN  NUMBER,
        p_mass_kg         IN  NUMBER,
        p_frequency_mhz   IN  NUMBER,
        p_new_satellite_id OUT NUMBER
    );

    -- Procedure: Resolve anomaly
    PROCEDURE p_resolve_anomaly (
        p_anomaly_id      IN NUMBER,
        p_resolution_note IN VARCHAR2,
        p_operator_id     IN NUMBER
    );

    -- Function: Get satellite health
    FUNCTION f_satellite_health (
        p_satellite_id IN NUMBER
    ) RETURN VARCHAR2;

    -- Function: Get mission dashboard KPIs
    FUNCTION f_mission_kpis (
        p_mission_id IN NUMBER
    ) RETURN VARCHAR2;

    -- Function: Count anomalies by severity for a mission
    FUNCTION f_count_anomalies (
        p_mission_id IN NUMBER,
        p_severity   IN VARCHAR2 DEFAULT NULL
    ) RETURN NUMBER;

END pkg_mission_ops;
/

PROMPT ============================================
PROMPT Creating Package Body
PROMPT ============================================

CREATE OR REPLACE PACKAGE BODY pkg_mission_ops AS

    -- Implementation of p_add_satellite
    PROCEDURE p_add_satellite (
        p_mission_id      IN  NUMBER,
        p_satellite_name  IN  VARCHAR2,
        p_orbit_id        IN  NUMBER,
        p_mass_kg         IN  NUMBER,
        p_frequency_mhz   IN  NUMBER,
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

        SELECT SEQ_SATELLITE_ID.NEXTVAL INTO p_new_satellite_id FROM DUAL;

        INSERT INTO SATELLITE (satellite_id, mission_id, orbit_id, satellite_name, mass_kg, frequency_mhz, status, launch_date)
        VALUES (p_new_satellite_id, p_mission_id, p_orbit_id, p_satellite_name, p_mass_kg, p_frequency_mhz, 'ACTIVE', SYSDATE);

        -- Log via standalone procedure
        proc_log_audit('SATELLITE', 'INSERT', p_new_satellite_id, 'pkg_mission_ops.p_add_satellite', 
                       'Package-based insert: ' || p_satellite_name);
        COMMIT;
    END p_add_satellite;

    -- Implementation of p_resolve_anomaly
    PROCEDURE p_resolve_anomaly (
        p_anomaly_id      IN NUMBER,
        p_resolution_note IN VARCHAR2,
        p_operator_id     IN NUMBER
    ) AS
        v_satellite_id NUMBER;
        v_resolved CHAR(1);
    BEGIN
        SELECT satellite_id, resolved INTO v_satellite_id, v_resolved
        FROM ANOMALY_REPORT WHERE anomaly_id = p_anomaly_id;

        IF v_resolved = 'Y' THEN
            RAISE_APPLICATION_ERROR(-20004, 'Anomaly already resolved: ' || p_anomaly_id);
        END IF;

        UPDATE ANOMALY_REPORT 
        SET resolved = 'Y', 
            resolution_note = p_resolution_note,
            reported_by = p_operator_id
        WHERE anomaly_id = p_anomaly_id;

        proc_log_audit('ANOMALY_REPORT', 'UPDATE', p_anomaly_id, 'pkg_mission_ops.p_resolve_anomaly', 
                       'Package-based resolution: ' || p_resolution_note);
        COMMIT;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(-20005, 'Anomaly not found: ' || p_anomaly_id);
    END p_resolve_anomaly;

    -- Implementation of f_satellite_health
    FUNCTION f_satellite_health (
        p_satellite_id IN NUMBER
    ) RETURN VARCHAR2 AS
        v_battery_pct NUMBER(5,2);
        v_signal_dbm  NUMBER(6,2);
        v_temp_c      NUMBER(6,2);
    BEGIN
        SELECT battery_pct, signal_dbm, temperature_c
        INTO v_battery_pct, v_signal_dbm, v_temp_c
        FROM TELEMETRY_LOG
        WHERE satellite_id = p_satellite_id
        AND recorded_at = (SELECT MAX(recorded_at) FROM TELEMETRY_LOG WHERE satellite_id = p_satellite_id);

        IF v_battery_pct IS NULL THEN
            RETURN 'NO_DATA';
        END IF;

        IF v_battery_pct < 20 OR v_signal_dbm < -110 OR v_temp_c > 50 THEN
            RETURN 'CRITICAL';
        ELSIF v_battery_pct < 50 OR v_signal_dbm < -90 OR v_temp_c > 40 THEN
            RETURN 'WARNING';
        ELSE
            RETURN 'HEALTHY';
        END IF;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RETURN 'NO_DATA';
    END f_satellite_health;

    -- Implementation of f_mission_kpis
    FUNCTION f_mission_kpis (
        p_mission_id IN NUMBER
    ) RETURN VARCHAR2 AS
        v_sat_count NUMBER;
        v_active_count NUMBER;
        v_anomaly_count NUMBER;
        v_avg_battery NUMBER;
        v_result VARCHAR2(500);
    BEGIN
        SELECT COUNT(*) INTO v_sat_count FROM SATELLITE WHERE mission_id = p_mission_id;
        SELECT COUNT(*) INTO v_active_count FROM SATELLITE WHERE mission_id = p_mission_id AND status = 'ACTIVE';
        SELECT COUNT(*) INTO v_anomaly_count 
        FROM ANOMALY_REPORT ar JOIN SATELLITE s ON ar.satellite_id = s.satellite_id
        WHERE s.mission_id = p_mission_id AND ar.resolved = 'N';

        SELECT AVG(battery_pct) INTO v_avg_battery
        FROM TELEMETRY_LOG tl
        JOIN SATELLITE s ON tl.satellite_id = s.satellite_id
        WHERE s.mission_id = p_mission_id
        AND tl.recorded_at = (SELECT MAX(recorded_at) FROM TELEMETRY_LOG WHERE satellite_id = s.satellite_id);

        v_result := 'Sats: ' || v_sat_count || 
                    ' | Active: ' || v_active_count ||
                    ' | Anomalies: ' || v_anomaly_count ||
                    ' | Avg Battery: ' || ROUND(NVL(v_avg_battery, 0), 2) || '%';
        RETURN v_result;
    END f_mission_kpis;

    -- Implementation of f_count_anomalies
    FUNCTION f_count_anomalies (
        p_mission_id IN NUMBER,
        p_severity   IN VARCHAR2 DEFAULT NULL
    ) RETURN NUMBER AS
        v_count NUMBER;
    BEGIN
        IF p_severity IS NULL THEN
            SELECT COUNT(*) INTO v_count
            FROM ANOMALY_REPORT ar
            JOIN SATELLITE s ON ar.satellite_id = s.satellite_id
            WHERE s.mission_id = p_mission_id AND ar.resolved = 'N';
        ELSE
            SELECT COUNT(*) INTO v_count
            FROM ANOMALY_REPORT ar
            JOIN SATELLITE s ON ar.satellite_id = s.satellite_id
            WHERE s.mission_id = p_mission_id 
            AND ar.resolved = 'N' 
            AND ar.severity = p_severity;
        END IF;
        RETURN v_count;
    END f_count_anomalies;

END pkg_mission_ops;
/

PROMPT ============================================
PROMPT Package Test Anonymous Block
PROMPT ============================================

SET SERVEROUTPUT ON

DECLARE
    v_new_sat_id NUMBER;
    v_health VARCHAR2(20);
    v_kpis VARCHAR2(500);
    v_anomaly_count NUMBER;
BEGIN
    -- Test 1: Add satellite via package
    DBMS_OUTPUT.PUT_LINE('--- Test 1: Adding satellite via package ---');
    pkg_mission_ops.p_add_satellite(
        p_mission_id => 1003,
        p_satellite_name => 'Starlink-Package-Test',
        p_orbit_id => 3002,
        p_mass_kg => 300.00,
        p_frequency_mhz => 99999.999,
        p_new_satellite_id => v_new_sat_id
    );
    DBMS_OUTPUT.PUT_LINE('New satellite ID: ' || v_new_sat_id);

    -- Test 2: Check health
    DBMS_OUTPUT.PUT_LINE('--- Test 2: Satellite Health ---');
    v_health := pkg_mission_ops.f_satellite_health(2001);
    DBMS_OUTPUT.PUT_LINE('Satellite 2001 health: ' || v_health);

    -- Test 3: Mission KPIs
    DBMS_OUTPUT.PUT_LINE('--- Test 3: Mission KPIs ---');
    v_kpis := pkg_mission_ops.f_mission_kpis(1003);
    DBMS_OUTPUT.PUT_LINE('Mission 1003 KPIs: ' || v_kpis);

    -- Test 4: Anomaly count
    DBMS_OUTPUT.PUT_LINE('--- Test 4: Anomaly Counts ---');
    v_anomaly_count := pkg_mission_ops.f_count_anomalies(1003);
    DBMS_OUTPUT.PUT_LINE('Total open anomalies for Mission 1003: ' || v_anomaly_count);
    v_anomaly_count := pkg_mission_ops.f_count_anomalies(1003, 'CRITICAL');
    DBMS_OUTPUT.PUT_LINE('Critical anomalies for Mission 1003: ' || v_anomaly_count);

    -- Clean up test data
    DELETE FROM SATELLITE WHERE satellite_id = v_new_sat_id;
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Test satellite cleaned up.');
END;
/

PROMPT ============================================
PROMPT Package Created and Tested Successfully
PROMPT ============================================