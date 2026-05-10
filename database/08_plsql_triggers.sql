PROMPT ============================================
PROMPT Creating Triggers
PROMPT ============================================

-- Trigger 1: BEFORE INSERT on SATELLITE - Auto-assign ID and default status
CREATE OR REPLACE TRIGGER trg_before_satellite_ins
BEFORE INSERT ON SATELLITE
FOR EACH ROW
BEGIN
    IF :NEW.satellite_id IS NULL THEN
        SELECT SEQ_SATELLITE_ID.NEXTVAL INTO :NEW.satellite_id FROM DUAL;
    END IF;

    IF :NEW.status IS NULL THEN
        :NEW.status := 'ACTIVE';
    END IF;

    IF :NEW.launch_date IS NULL THEN
        :NEW.launch_date := SYSDATE;
    END IF;
END;
/

-- Trigger 2: AFTER UPDATE on ANOMALY_REPORT - Log when anomaly is resolved
CREATE OR REPLACE TRIGGER trg_after_anomaly_upd
AFTER UPDATE OF resolved ON ANOMALY_REPORT
FOR EACH ROW
WHEN (NEW.resolved = 'Y' AND OLD.resolved = 'N')
BEGIN
    INSERT INTO AUDIT_LOG (audit_id, table_name, action, record_id, changed_by, changed_at, notes)
    VALUES (
        SEQ_ANOMALY_ID.NEXTVAL,
        'ANOMALY_REPORT',
        'RESOLVED',
        :NEW.anomaly_id,
        NVL(:NEW.reported_by, 0),
        SYSTIMESTAMP,
        'Anomaly resolved. Note: ' || NVL(:NEW.resolution_note, 'No notes')
    );
END;
/

-- Trigger 3: AFTER DELETE on MISSION - Archive before deletion
CREATE OR REPLACE TRIGGER trg_after_mission_del
AFTER DELETE ON MISSION
FOR EACH ROW
BEGIN
    INSERT INTO MISSION_ARCHIVE (
        archive_id, mission_id, mission_name, mission_type, 
        launch_date, status, objective, agency_name, created_at, deleted_at, deleted_by
    )
    VALUES (
        SEQ_MISSION_ID.NEXTVAL,
        :OLD.mission_id,
        :OLD.mission_name,
        :OLD.mission_type,
        :OLD.launch_date,
        :OLD.status,
        :OLD.objective,
        :OLD.agency_name,
        :OLD.created_at,
        SYSTIMESTAMP,
        USER
    );
END;
/

-- Trigger 4: BEFORE INSERT on TELEMETRY_LOG - Validate signal and battery ranges
CREATE OR REPLACE TRIGGER trg_before_telemetry_ins
BEFORE INSERT ON TELEMETRY_LOG
FOR EACH ROW
BEGIN
    IF :NEW.battery_pct IS NOT NULL AND (:NEW.battery_pct < 0 OR :NEW.battery_pct > 100) THEN
        RAISE_APPLICATION_ERROR(-20010, 'Battery percentage must be between 0 and 100');
    END IF;

    IF :NEW.signal_dbm IS NOT NULL AND (:NEW.signal_dbm < -150 OR :NEW.signal_dbm > 0) THEN
        RAISE_APPLICATION_ERROR(-20011, 'Signal strength must be between -150 and 0 dBm');
    END IF;

    IF :NEW.recorded_at IS NULL THEN
        :NEW.recorded_at := SYSTIMESTAMP;
    END IF;
END;
/

-- Trigger 5: AFTER INSERT on TELEMETRY_LOG - Auto-detect critical battery and create anomaly
CREATE OR REPLACE TRIGGER trg_after_telemetry_ins
AFTER INSERT ON TELEMETRY_LOG
FOR EACH ROW
WHEN (NEW.battery_pct < 20)
DECLARE
    v_count NUMBER;
BEGIN
    -- Check if open anomaly already exists for this satellite
    SELECT COUNT(*) INTO v_count 
    FROM ANOMALY_REPORT 
    WHERE satellite_id = :NEW.satellite_id 
    AND severity = 'CRITICAL' 
    AND resolved = 'N'
    AND description LIKE '%battery%';

    IF v_count = 0 THEN
        INSERT INTO ANOMALY_REPORT (
            anomaly_id, satellite_id, reported_by, severity, 
            description, reported_at, resolved
        )
        VALUES (
            SEQ_ANOMALY_ID.NEXTVAL,
            :NEW.satellite_id,
            1, -- System admin
            'CRITICAL',
            'Auto-detected: Battery critically low at ' || :NEW.battery_pct || '%. Immediate attention required.',
            SYSTIMESTAMP,
            'N'
        );
    END IF;
END;
/

-- Trigger 6: BEFORE UPDATE on OPERATOR - Prevent role downgrade of last admin
CREATE OR REPLACE TRIGGER trg_before_operator_upd
BEFORE UPDATE OF role ON OPERATOR
FOR EACH ROW
WHEN (NEW.role = 'OPERATOR' AND OLD.role = 'ADMIN')
DECLARE
    v_admin_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_admin_count FROM OPERATOR WHERE role = 'ADMIN' AND active = 'Y';

    IF v_admin_count <= 1 THEN
        RAISE_APPLICATION_ERROR(-20012, 'Cannot downgrade the last active admin user');
    END IF;
END;
/

PROMPT ============================================
PROMPT Triggers Created Successfully
PROMPT ============================================