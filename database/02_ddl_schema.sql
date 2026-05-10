PROMPT ============================================
PROMPT Dropping existing tables if they exist...
PROMPT ============================================

-- Drop tables in reverse dependency order to avoid FK violations
DROP TABLE AUDIT_LOG CASCADE CONSTRAINTS;
DROP TABLE TELEMETRY_LOG CASCADE CONSTRAINTS;
DROP TABLE CONTACT_WINDOW CASCADE CONSTRAINTS;
DROP TABLE ANOMALY_REPORT CASCADE CONSTRAINTS;
DROP TABLE OPERATOR CASCADE CONSTRAINTS;
DROP TABLE GROUND_STATION CASCADE CONSTRAINTS;
DROP TABLE CONTROL_CENTER CASCADE CONSTRAINTS;
DROP TABLE LAUNCH_VEHICLE CASCADE CONSTRAINTS;
DROP TABLE SATELLITE CASCADE CONSTRAINTS;
DROP TABLE ORBIT CASCADE CONSTRAINTS;
DROP TABLE MISSION CASCADE CONSTRAINTS;
DROP TABLE MISSION_ARCHIVE CASCADE CONSTRAINTS;

PROMPT ============================================
PROMPT Creating Tables with Constraints
PROMPT ============================================

-- ============================================================
-- TABLE: MISSION
-- ============================================================
CREATE TABLE MISSION (
    mission_id      NUMBER(10)      PRIMARY KEY,
    mission_name    VARCHAR2(150)   NOT NULL,
    mission_type    VARCHAR2(20)    NOT NULL,
    launch_date     DATE            NOT NULL,
    status          VARCHAR2(20)    NOT NULL,
    objective       VARCHAR2(500)   NOT NULL,
    agency_name     VARCHAR2(100)   NOT NULL,
    created_at      DATE            DEFAULT SYSDATE,
    
    CONSTRAINT CHK_MISSION_TYPE 
        CHECK (mission_type IN ('CREWED', 'UNCREWED')),
    
    CONSTRAINT CHK_MISSION_STATUS 
        CHECK (status IN ('PLANNED', 'ACTIVE', 'COMPLETED', 'ABORTED'))
);

-- ============================================================
-- TABLE: ORBIT
-- ============================================================
CREATE TABLE ORBIT (
    orbit_id        NUMBER(10)      PRIMARY KEY,
    orbit_type      VARCHAR2(10)    NOT NULL,
    altitude_km     NUMBER(10,2)    NOT NULL,
    inclination_deg NUMBER(5,2)     NOT NULL,
    period_min      NUMBER(8,2)     NOT NULL,
    eccentricity    NUMBER(6,4)     DEFAULT 0,
    
    CONSTRAINT CHK_ORBIT_TYPE 
        CHECK (orbit_type IN ('LEO', 'MEO', 'GEO', 'HEO')),
    
    CONSTRAINT CHK_ORBIT_ALTITUDE 
        CHECK (altitude_km > 0),
    
    CONSTRAINT CHK_ORBIT_PERIOD 
        CHECK (period_min > 0)
);

-- ============================================================
-- TABLE: SATELLITE
-- ============================================================
CREATE TABLE SATELLITE (
    satellite_id    NUMBER(10)      PRIMARY KEY,
    mission_id      NUMBER(10)      NOT NULL,
    orbit_id        NUMBER(10)      NOT NULL,
    satellite_name  VARCHAR2(100)   NOT NULL,
    mass_kg         NUMBER(10,2)    NOT NULL,
    frequency_mhz   NUMBER(8,3)     NOT NULL,
    status          VARCHAR2(20)    NOT NULL,
    launch_date     DATE            NOT NULL,
    
    CONSTRAINT CHK_SATELLITE_STATUS 
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'DECOMMISSIONED')),
    
    CONSTRAINT CHK_SATELLITE_MASS 
        CHECK (mass_kg > 0),
    
    CONSTRAINT UNQ_SATELLITE_FREQUENCY 
        UNIQUE (frequency_mhz),
    
    CONSTRAINT FK_SATELLITE_MISSION 
        FOREIGN KEY (mission_id) REFERENCES MISSION(mission_id),
    
    CONSTRAINT FK_SATELLITE_ORBIT 
        FOREIGN KEY (orbit_id) REFERENCES ORBIT(orbit_id) 
        ON DELETE SET NULL
);

-- ============================================================
-- TABLE: LAUNCH_VEHICLE
-- ============================================================
CREATE TABLE LAUNCH_VEHICLE (
    vehicle_id      NUMBER(10)      PRIMARY KEY,
    mission_id      NUMBER(10)      NOT NULL,
    vehicle_name    VARCHAR2(100)   NOT NULL,
    manufacturer    VARCHAR2(100)   NOT NULL,
    payload_cap_kg  NUMBER(10,2)    NOT NULL,
    reusable        CHAR(1)         DEFAULT 'N',
    launch_site     VARCHAR2(150)   NOT NULL,
    
    CONSTRAINT CHK_VEHICLE_REUSABLE 
        CHECK (reusable IN ('Y', 'N')),
    
    CONSTRAINT CHK_VEHICLE_PAYLOAD 
        CHECK (payload_cap_kg > 0),
    
    CONSTRAINT FK_VEHICLE_MISSION 
        FOREIGN KEY (mission_id) REFERENCES MISSION(mission_id)
);

-- ============================================================
-- TABLE: CONTROL_CENTER
-- ============================================================
CREATE TABLE CONTROL_CENTER (
    center_id       NUMBER(10)      PRIMARY KEY,
    center_name     VARCHAR2(150)   NOT NULL,
    country         VARCHAR2(100)   NOT NULL,
    established_yr  NUMBER(4)       NOT NULL,
    director_name   VARCHAR2(100)   NOT NULL,
    contact_email   VARCHAR2(150)   NOT NULL,
    
    CONSTRAINT CHK_CENTER_YEAR 
        CHECK (established_yr > 1950),
    
    CONSTRAINT UNQ_CENTER_EMAIL 
        UNIQUE (contact_email)
);

-- ============================================================
-- TABLE: GROUND_STATION
-- ============================================================
CREATE TABLE GROUND_STATION (
    station_id      NUMBER(10)      PRIMARY KEY,
    center_id       NUMBER(10),
    station_name    VARCHAR2(100)   NOT NULL,
    location        VARCHAR2(150)   NOT NULL,
    latitude        NUMBER(8,5)     NOT NULL,
    longitude       NUMBER(8,5)     NOT NULL,
    operational     CHAR(1)         DEFAULT 'Y',
    frequency_range VARCHAR2(50)    NOT NULL,
    
    CONSTRAINT CHK_STATION_OP 
        CHECK (operational IN ('Y', 'N')),
    
    CONSTRAINT FK_STATION_CENTER 
        FOREIGN KEY (center_id) REFERENCES CONTROL_CENTER(center_id) 
        ON DELETE CASCADE
);

-- ============================================================
-- TABLE: OPERATOR
-- ============================================================
CREATE TABLE OPERATOR (
    operator_id     NUMBER(10)      PRIMARY KEY,
    station_id      NUMBER(10),
    full_name       VARCHAR2(100)   NOT NULL,
    username        VARCHAR2(50)    NOT NULL,
    password_hash   VARCHAR2(255)   NOT NULL,
    role            VARCHAR2(20)    NOT NULL,
    email           VARCHAR2(150)   NOT NULL,
    active          CHAR(1)         DEFAULT 'Y',
    
    CONSTRAINT CHK_OPERATOR_ROLE 
        CHECK (role IN ('ADMIN', 'OPERATOR')),
    
    CONSTRAINT CHK_OPERATOR_ACTIVE 
        CHECK (active IN ('Y', 'N')),
    
    CONSTRAINT UNQ_OPERATOR_USERNAME 
        UNIQUE (username),
    
    CONSTRAINT UNQ_OPERATOR_EMAIL 
        UNIQUE (email),
    
    CONSTRAINT FK_OPERATOR_STATION 
        FOREIGN KEY (station_id) REFERENCES GROUND_STATION(station_id) 
        ON DELETE SET NULL
);

-- ============================================================
-- TABLE: CONTACT_WINDOW (M:M Bridge)
-- ============================================================
CREATE TABLE CONTACT_WINDOW (
    window_id       NUMBER(10)      PRIMARY KEY,
    satellite_id    NUMBER(10)      NOT NULL,
    station_id      NUMBER(10)      NOT NULL,
    start_time      TIMESTAMP       NOT NULL,
    end_time        TIMESTAMP       NOT NULL,
    signal_strength NUMBER(6,2),
    data_received_mb NUMBER(10,2)   DEFAULT 0,
    
    CONSTRAINT CHK_WINDOW_TIME 
        CHECK (end_time > start_time),
    
    CONSTRAINT CHK_WINDOW_SIGNAL 
        CHECK (signal_strength BETWEEN -120 AND 0),
    
    CONSTRAINT FK_WINDOW_SATELLITE 
        FOREIGN KEY (satellite_id) REFERENCES SATELLITE(satellite_id),
    
    CONSTRAINT FK_WINDOW_STATION 
        FOREIGN KEY (station_id) REFERENCES GROUND_STATION(station_id)
);

-- ============================================================
-- TABLE: TELEMETRY_LOG (Weak Entity)
-- ============================================================
CREATE TABLE TELEMETRY_LOG (
    log_id          NUMBER(10)      PRIMARY KEY,
    satellite_id    NUMBER(10)      NOT NULL,
    recorded_at     TIMESTAMP       NOT NULL,
    temperature_c   NUMBER(6,2)     NOT NULL,
    battery_pct     NUMBER(5,2),
    signal_dbm      NUMBER(6,2),
    altitude_km     NUMBER(10,2)    NOT NULL,
    
    CONSTRAINT CHK_TELEM_BATTERY 
        CHECK (battery_pct BETWEEN 0 AND 100),
    
    CONSTRAINT CHK_TELEM_SIGNAL 
        CHECK (signal_dbm BETWEEN -150 AND 0),
    
    CONSTRAINT FK_TELEM_SATELLITE 
        FOREIGN KEY (satellite_id) REFERENCES SATELLITE(satellite_id) 
        ON DELETE CASCADE
);

-- ============================================================
-- TABLE: ANOMALY_REPORT
-- ============================================================
CREATE TABLE ANOMALY_REPORT (
    anomaly_id      NUMBER(10)      PRIMARY KEY,
    satellite_id    NUMBER(10)      NOT NULL,
    reported_by     NUMBER(10)      NOT NULL,
    severity        VARCHAR2(10)    NOT NULL,
    description     VARCHAR2(1000)  NOT NULL,
    reported_at     TIMESTAMP       DEFAULT SYSTIMESTAMP,
    resolved        CHAR(1)         DEFAULT 'N',
    resolution_note VARCHAR2(500),
    
    CONSTRAINT CHK_ANOMALY_SEVERITY 
        CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    
    CONSTRAINT CHK_ANOMALY_RESOLVED 
        CHECK (resolved IN ('Y', 'N')),
    
    CONSTRAINT FK_ANOMALY_SATELLITE 
        FOREIGN KEY (satellite_id) REFERENCES SATELLITE(satellite_id),
    
    CONSTRAINT FK_ANOMALY_OPERATOR 
        FOREIGN KEY (reported_by) REFERENCES OPERATOR(operator_id)
);

-- ============================================================
-- TABLE: AUDIT_LOG (For Triggers)
-- ============================================================
CREATE TABLE AUDIT_LOG (
    audit_id        NUMBER(10)      PRIMARY KEY,
    table_name      VARCHAR2(50)    NOT NULL,
    action          VARCHAR2(20)    NOT NULL,
    record_id       NUMBER(10)      NOT NULL,
    changed_by      VARCHAR2(50)    NOT NULL,
    changed_at      TIMESTAMP       DEFAULT SYSTIMESTAMP,
    notes           VARCHAR2(500)
);

-- ============================================================
-- TABLE: MISSION_ARCHIVE (For Delete Trigger)
-- ============================================================
CREATE TABLE MISSION_ARCHIVE (
    archive_id      NUMBER(10)      PRIMARY KEY,
    mission_id      NUMBER(10)      NOT NULL,
    mission_name    VARCHAR2(150)   NOT NULL,
    mission_type    VARCHAR2(20)    NOT NULL,
    launch_date     DATE            NOT NULL,
    status          VARCHAR2(20)    NOT NULL,
    objective       VARCHAR2(500)   NOT NULL,
    agency_name     VARCHAR2(100)   NOT NULL,
    created_at      DATE,
    deleted_at      TIMESTAMP       DEFAULT SYSTIMESTAMP,
    deleted_by      VARCHAR2(50)
);

PROMPT ============================================
PROMPT Schema Created Successfully - 12 Tables
PROMPT ============================================