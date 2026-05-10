PROMPT ============================================
PROMPT Creating Functions
PROMPT ============================================

-- Function 1: Satellite health status based on latest telemetry
CREATE OR REPLACE FUNCTION fn_satellite_health (
    p_satellite_id IN NUMBER
) RETURN VARCHAR2 AS
    v_battery_pct NUMBER(5,2);
    v_signal_dbm  NUMBER(6,2);
    v_temp_c      NUMBER(6,2);
    v_status      VARCHAR2(20);
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
END;
/

-- Function 2: Total contact time for a satellite in minutes
CREATE OR REPLACE FUNCTION fn_total_contact_time (
    p_satellite_id IN NUMBER
) RETURN NUMBER AS
    v_total_minutes NUMBER := 0;
BEGIN
    SELECT NVL(SUM(
        EXTRACT(DAY FROM (end_time - start_time)) * 24 * 60 +
        EXTRACT(HOUR FROM (end_time - start_time)) * 60 +
        EXTRACT(MINUTE FROM (end_time - start_time))
    ), 0)
    INTO v_total_minutes
    FROM CONTACT_WINDOW
    WHERE satellite_id = p_satellite_id;

    RETURN v_total_minutes;
END;
/

-- Function 3: Count active anomalies for a mission
CREATE OR REPLACE FUNCTION fn_mission_anomaly_count (
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
END;
/

-- Function 4: Calculate orbital velocity (km/s) using vis-viva equation
CREATE OR REPLACE FUNCTION fn_orbital_velocity (
    p_orbit_id IN NUMBER
) RETURN NUMBER AS
    v_altitude_km NUMBER(10,2);
    v_period_min  NUMBER(8,2);
    v_velocity    NUMBER(10,4);
    v_earth_radius CONSTANT NUMBER := 6371; -- km
BEGIN
    SELECT altitude_km, period_min INTO v_altitude_km, v_period_min
    FROM ORBIT WHERE orbit_id = p_orbit_id;

    -- v = 2 * pi * r / T (circular orbit approximation)
    v_velocity := (2 * 3.14159265359 * (v_earth_radius + v_altitude_km)) / (v_period_min * 60);

    RETURN ROUND(v_velocity, 2);
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN NULL;
END;
/

-- Function 5: Get operator full name by username
CREATE OR REPLACE FUNCTION fn_get_operator_name (
    p_username IN VARCHAR2
) RETURN VARCHAR2 AS
    v_full_name VARCHAR2(100);
BEGIN
    SELECT full_name INTO v_full_name
    FROM OPERATOR WHERE username = p_username AND active = 'Y';

    RETURN v_full_name;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN 'UNKNOWN_USER';
END;
/

PROMPT ============================================
PROMPT Functions Created Successfully
PROMPT ============================================