SET PAGESIZE 100
SET LINESIZE 200

PROMPT ============================================
PROMPT 1. BASIC SELECT QUERIES
PROMPT ============================================

-- Q1: Select all missions
SELECT * FROM MISSION;

-- Q2: Select active satellites with specific columns
SELECT satellite_id, satellite_name, mass_kg, status, frequency_mhz 
FROM SATELLITE 
WHERE status = 'ACTIVE';

-- Q3: Select operators with their roles
SELECT operator_id, full_name, username, role, email, active 
FROM OPERATOR 
WHERE active = 'Y';

PROMPT ============================================
PROMPT 2. JOIN QUERIES
PROMPT ============================================

-- Q4: INNER JOIN - Satellites with their Mission and Orbit details
SELECT 
    s.satellite_name,
    s.mass_kg,
    s.status AS sat_status,
    m.mission_name,
    m.agency_name,
    o.orbit_type,
    o.altitude_km
FROM SATELLITE s
INNER JOIN MISSION m ON s.mission_id = m.mission_id
INNER JOIN ORBIT o ON s.orbit_id = o.orbit_id;

-- Q5: LEFT JOIN - All missions with satellite count (even missions with no satellites)
SELECT 
    m.mission_id,
    m.mission_name,
    m.status,
    COUNT(s.satellite_id) AS satellite_count
FROM MISSION m
LEFT JOIN SATELLITE s ON m.mission_id = s.mission_id
GROUP BY m.mission_id, m.mission_name, m.status;

-- Q6: Multiple JOIN - Contact windows with satellite, station, and center info
SELECT 
    cw.window_id,
    s.satellite_name,
    gs.station_name,
    cc.center_name,
    cw.start_time,
    cw.end_time,
    cw.signal_strength,
    cw.data_received_mb
FROM CONTACT_WINDOW cw
JOIN SATELLITE s ON cw.satellite_id = s.satellite_id
JOIN GROUND_STATION gs ON cw.station_id = gs.station_id
JOIN CONTROL_CENTER cc ON gs.center_id = cc.center_id;

-- Q7: Self JOIN equivalent - Satellites from same mission
SELECT 
    s1.satellite_name AS satellite_1,
    s2.satellite_name AS satellite_2,
    s1.mission_id
FROM SATELLITE s1
JOIN SATELLITE s2 ON s1.mission_id = s2.mission_id AND s1.satellite_id < s2.satellite_id;

PROMPT ============================================
PROMPT 3. SUBQUERY QUERIES
PROMPT ============================================

-- Q8: Single-row subquery - Satellites with above-average mass
SELECT satellite_name, mass_kg
FROM SATELLITE
WHERE mass_kg > (SELECT AVG(mass_kg) FROM SATELLITE);

-- Q9: Multi-row subquery with IN - Satellites in GEO orbits
SELECT satellite_name, frequency_mhz
FROM SATELLITE
WHERE orbit_id IN (SELECT orbit_id FROM ORBIT WHERE orbit_type = 'GEO');

-- Q10: Correlated subquery - Satellites with latest telemetry reading
SELECT s.satellite_name, tl.temperature_c, tl.battery_pct, tl.recorded_at
FROM SATELLITE s
JOIN TELEMETRY_LOG tl ON s.satellite_id = tl.satellite_id
WHERE tl.recorded_at = (
    SELECT MAX(recorded_at) 
    FROM TELEMETRY_LOG 
    WHERE satellite_id = s.satellite_id
);

-- Q11: EXISTS subquery - Missions that have at least one anomaly
SELECT m.mission_name, m.agency_name
FROM MISSION m
WHERE EXISTS (
    SELECT 1 
    FROM SATELLITE s 
    JOIN ANOMALY_REPORT ar ON s.satellite_id = ar.satellite_id
    WHERE s.mission_id = m.mission_id AND ar.resolved = 'N'
);

-- Q12: NOT EXISTS - Satellites with no contact windows in last 24 hours
SELECT s.satellite_name, s.status
FROM SATELLITE s
WHERE NOT EXISTS (
    SELECT 1 
    FROM CONTACT_WINDOW cw 
    WHERE cw.satellite_id = s.satellite_id 
    AND cw.start_time >= SYSTIMESTAMP - INTERVAL '1' DAY
);

PROMPT ============================================
PROMPT 4. AGGREGATE QUERIES
PROMPT ============================================

-- Q13: Count satellites by orbit type
SELECT 
    o.orbit_type,
    COUNT(s.satellite_id) AS satellite_count,
    AVG(s.mass_kg) AS avg_mass,
    MIN(s.mass_kg) AS min_mass,
    MAX(s.mass_kg) AS max_mass
FROM ORBIT o
LEFT JOIN SATELLITE s ON o.orbit_id = s.orbit_id
GROUP BY o.orbit_type;

-- Q14: Anomalies by severity with count
SELECT 
    severity,
    COUNT(*) AS total_count,
    COUNT(CASE WHEN resolved = 'Y' THEN 1 END) AS resolved_count,
    COUNT(CASE WHEN resolved = 'N' THEN 1 END) AS open_count
FROM ANOMALY_REPORT
GROUP BY severity
ORDER BY 
    CASE severity 
        WHEN 'CRITICAL' THEN 1 
        WHEN 'HIGH' THEN 2 
        WHEN 'MEDIUM' THEN 3 
        WHEN 'LOW' THEN 4 
    END;

-- Q15: HAVING clause - Ground stations with more than 2 contact windows
SELECT 
    gs.station_name,
    COUNT(cw.window_id) AS contact_count,
    SUM(cw.data_received_mb) AS total_data_mb
FROM GROUND_STATION gs
JOIN CONTACT_WINDOW cw ON gs.station_id = cw.station_id
GROUP BY gs.station_id, gs.station_name
HAVING COUNT(cw.window_id) > 2;

-- Q16: Complex aggregate - Monthly telemetry summary
SELECT 
    TO_CHAR(recorded_at, 'YYYY-MM') AS month,
    COUNT(*) AS log_count,
    AVG(temperature_c) AS avg_temp,
    AVG(battery_pct) AS avg_battery,
    MIN(battery_pct) AS min_battery,
    MAX(signal_dbm) AS best_signal
FROM TELEMETRY_LOG
GROUP BY TO_CHAR(recorded_at, 'YYYY-MM')
ORDER BY month;

PROMPT ============================================
PROMPT 5. UPDATE QUERIES
PROMPT ============================================

-- U1: Update satellite status to INACTIVE for decommissioned
UPDATE SATELLITE 
SET status = 'INACTIVE' 
WHERE satellite_name LIKE 'Dragon Ax-3';

-- U2: Update anomaly resolution
UPDATE ANOMALY_REPORT 
SET resolved = 'Y', 
    resolution_note = 'Battery replaced during maintenance window. System nominal.'
WHERE anomaly_id = 9003;

-- U3: Update operator station assignment
UPDATE OPERATOR 
SET station_id = 5002 
WHERE operator_id = 2;

-- U4: Update ground station operational status
UPDATE GROUND_STATION 
SET operational = 'N' 
WHERE station_name = 'SpaceX Boca Chica';

COMMIT;

PROMPT ============================================
PROMPT 6. DELETE QUERIES
PROMPT ============================================

-- D1: Delete a test anomaly (will be archived by trigger)
DELETE FROM ANOMALY_REPORT WHERE anomaly_id = 9020;

-- D2: Delete old telemetry logs (older than 2 years) - CASCADE handles FK
DELETE FROM TELEMETRY_LOG 
WHERE recorded_at < SYSTIMESTAMP - INTERVAL '730' DAY;

COMMIT;

PROMPT ============================================
PROMPT 7. DCL (Data Control Language) - GRANT/REVOKE
PROMPT ============================================

-- Create a test user for demonstration (run as SYS or DBA)
-- CREATE USER mission_operator IDENTIFIED BY operator_pass123;
-- CREATE USER mission_admin IDENTIFIED BY admin_pass123;

-- Grant privileges to operator role (read-only on most tables)
-- GRANT SELECT ON MISSION TO mission_operator;
-- GRANT SELECT ON SATELLITE TO mission_operator;
-- GRANT SELECT ON ORBIT TO mission_operator;
-- GRANT SELECT ON TELEMETRY_LOG TO mission_operator;
-- GRANT SELECT ON ANOMALY_REPORT TO mission_operator;
-- GRANT SELECT ON CONTACT_WINDOW TO mission_operator;
-- GRANT SELECT ON GROUND_STATION TO mission_operator;
-- GRANT SELECT ON CONTROL_CENTER TO mission_operator;
-- GRANT SELECT ON LAUNCH_VEHICLE TO mission_operator;

-- Grant privileges to admin role (full CRUD)
-- GRANT ALL ON MISSION TO mission_admin;
-- GRANT ALL ON SATELLITE TO mission_admin;
-- GRANT ALL ON ORBIT TO mission_admin;
-- GRANT ALL ON TELEMETRY_LOG TO mission_admin;
-- GRANT ALL ON ANOMALY_REPORT TO mission_admin;
-- GRANT ALL ON CONTACT_WINDOW TO mission_admin;
-- GRANT ALL ON GROUND_STATION TO mission_admin;
-- GRANT ALL ON CONTROL_CENTER TO mission_admin;
-- GRANT ALL ON LAUNCH_VEHICLE TO mission_admin;
-- GRANT ALL ON OPERATOR TO mission_admin;
-- GRANT ALL ON AUDIT_LOG TO mission_admin;

-- Create roles
-- CREATE ROLE role_operator;
-- CREATE ROLE role_admin;

-- Grant role privileges
-- GRANT SELECT ON SATELLITE TO role_operator;
-- GRANT INSERT ON ANOMALY_REPORT TO role_operator;
-- GRANT UPDATE (resolved, resolution_note) ON ANOMALY_REPORT TO role_operator;

-- Assign roles to users
-- GRANT role_operator TO mission_operator;
-- GRANT role_admin TO mission_admin;

-- Revoke example
-- REVOKE DELETE ON MISSION FROM mission_operator;

PROMPT ============================================
PROMPT 8. ADVANCED QUERIES
PROMPT ============================================

-- Q17: Top 5 heaviest satellites
SELECT satellite_name, mass_kg, mission_id
FROM (
    SELECT satellite_name, mass_kg, mission_id,
           RANK() OVER (ORDER BY mass_kg DESC) AS rnk
    FROM SATELLITE
)
WHERE rnk <= 5;

-- Q18: Satellite contact window ranking per station
SELECT 
    station_id,
    satellite_id,
    data_received_mb,
    RANK() OVER (PARTITION BY station_id ORDER BY data_received_mb DESC) AS rank_within_station
FROM CONTACT_WINDOW;

-- Q19: Recursive-like query - Mission hierarchy with satellite count
SELECT 
    m.mission_name,
    m.mission_type,
    LEVEL AS hierarchy_level,
    SYS_CONNECT_BY_PATH(m.mission_name, ' -> ') AS path
FROM MISSION m
CONNECT BY PRIOR m.mission_id = m.mission_id
START WITH m.mission_id = 1001;

-- Q20: Union query - All space objects (satellites + launch vehicles)
SELECT satellite_name AS object_name, 'SATELLITE' AS object_type, mass_kg AS mass FROM SATELLITE
UNION ALL
SELECT vehicle_name, 'LAUNCH_VEHICLE', payload_cap_kg FROM LAUNCH_VEHICLE;

PROMPT ============================================
PROMPT All Queries Demonstrated Successfully
PROMPT ============================================