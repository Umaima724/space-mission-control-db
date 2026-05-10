PROMPT ============================================
PROMPT Creating Indexes
PROMPT ============================================

-- Index 1: Frequent JOIN on mission_id when listing satellites per mission
CREATE INDEX IDX_SATELLITE_MISSION ON SATELLITE(mission_id);

-- Index 2: Supports time-range telemetry queries per satellite
CREATE INDEX IDX_TELEMETRY_SAT_TIME ON TELEMETRY_LOG(satellite_id, recorded_at);

-- Index 3: Dashboard filter - open anomalies by severity
CREATE INDEX IDX_ANOMALY_SEVERITY ON ANOMALY_REPORT(severity, resolved);

-- Index 4: Contact schedule lookups per satellite
CREATE INDEX IDX_CONTACT_SATELLITE ON CONTACT_WINDOW(satellite_id);

-- Additional useful indexes
CREATE INDEX IDX_ANOMALY_SATELLITE ON ANOMALY_REPORT(satellite_id);
CREATE INDEX IDX_CONTACT_STATION ON CONTACT_WINDOW(station_id);
CREATE INDEX IDX_OPERATOR_STATION ON OPERATOR(station_id);
CREATE INDEX IDX_GROUND_CENTER ON GROUND_STATION(center_id);
CREATE INDEX IDX_MISSION_STATUS ON MISSION(status);
CREATE INDEX IDX_SATELLITE_STATUS ON SATELLITE(status);

PROMPT ============================================
PROMPT Creating Views
PROMPT ============================================

-- View 1: Active Satellites Dashboard
CREATE OR REPLACE VIEW VW_ACTIVE_SATELLITES AS
SELECT 
    s.satellite_id,
    s.satellite_name,
    s.mass_kg,
    s.frequency_mhz,
    s.status AS satellite_status,
    m.mission_id,
    m.mission_name,
    m.mission_type,
    m.status AS mission_status,
    o.orbit_id,
    o.orbit_type,
    o.altitude_km,
    o.inclination_deg,
    o.period_min
FROM SATELLITE s
JOIN MISSION m ON s.mission_id = m.mission_id
JOIN ORBIT o ON s.orbit_id = o.orbit_id
WHERE s.status = 'ACTIVE';

-- View 2: Open Anomalies for Monitoring
CREATE OR REPLACE VIEW VW_OPEN_ANOMALIES AS
SELECT 
    a.anomaly_id,
    a.severity,
    a.description,
    a.reported_at,
    a.resolved,
    s.satellite_id,
    s.satellite_name,
    o.operator_id,
    o.full_name AS reported_by_name
FROM ANOMALY_REPORT a
JOIN SATELLITE s ON a.satellite_id = s.satellite_id
JOIN OPERATOR o ON a.reported_by = o.operator_id
WHERE a.resolved = 'N'
ORDER BY 
    CASE a.severity 
        WHEN 'CRITICAL' THEN 1 
        WHEN 'HIGH' THEN 2 
        WHEN 'MEDIUM' THEN 3 
        WHEN 'LOW' THEN 4 
    END,
    a.reported_at;

-- View 3: Station Contact Statistics
CREATE OR REPLACE VIEW VW_STATION_CONTACT_STATS AS
SELECT 
    gs.station_id,
    gs.station_name,
    cc.center_name,
    COUNT(cw.window_id) AS total_contacts,
    SUM(EXTRACT(MINUTE FROM (cw.end_time - cw.start_time)) + 
        EXTRACT(HOUR FROM (cw.end_time - cw.start_time)) * 60) AS total_contact_minutes,
    SUM(cw.data_received_mb) AS total_data_received_mb,
    AVG(cw.signal_strength) AS avg_signal_strength
FROM GROUND_STATION gs
JOIN CONTROL_CENTER cc ON gs.center_id = cc.center_id
LEFT JOIN CONTACT_WINDOW cw ON gs.station_id = cw.station_id
GROUP BY gs.station_id, gs.station_name, cc.center_name;

-- View 4: Mission Status Summary (for Reports)
CREATE OR REPLACE VIEW VW_MISSION_STATUS_SUMMARY AS
SELECT 
    m.mission_id,
    m.mission_name,
    m.mission_type,
    m.status,
    m.agency_name,
    COUNT(DISTINCT s.satellite_id) AS satellite_count,
    COUNT(DISTINCT CASE WHEN s.status = 'ACTIVE' THEN s.satellite_id END) AS active_satellites,
    COUNT(DISTINCT CASE WHEN ar.resolved = 'N' THEN ar.anomaly_id END) AS open_anomalies,
    MAX(tl.recorded_at) AS last_telemetry_time,
    AVG(tl.battery_pct) AS avg_battery_pct
FROM MISSION m
LEFT JOIN SATELLITE s ON m.mission_id = s.mission_id
LEFT JOIN ANOMALY_REPORT ar ON s.satellite_id = ar.satellite_id
LEFT JOIN TELEMETRY_LOG tl ON s.satellite_id = tl.satellite_id
GROUP BY m.mission_id, m.mission_name, m.mission_type, m.status, m.agency_name;

-- View 5: Satellite Health Dashboard
CREATE OR REPLACE VIEW VW_SATELLITE_HEALTH AS
SELECT 
    s.satellite_id,
    s.satellite_name,
    s.status,
    tl.temperature_c,
    tl.battery_pct,
    tl.signal_dbm,
    tl.altitude_km,
    tl.recorded_at,
    CASE 
        WHEN tl.battery_pct >= 80 THEN 'HEALTHY'
        WHEN tl.battery_pct >= 50 THEN 'WARNING'
        ELSE 'CRITICAL'
    END AS health_status
FROM SATELLITE s
LEFT JOIN (
    SELECT satellite_id, MAX(recorded_at) AS max_recorded_at
    FROM TELEMETRY_LOG
    GROUP BY satellite_id
) latest ON s.satellite_id = latest.satellite_id
LEFT JOIN TELEMETRY_LOG tl ON s.satellite_id = tl.satellite_id 
    AND tl.recorded_at = latest.max_recorded_at;

PROMPT ============================================
PROMPT Views and Indexes Created Successfully
PROMPT ============================================