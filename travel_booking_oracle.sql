SET SERVEROUTPUT ON;
SET DEFINE OFF;

BEGIN
    FOR t IN (
        SELECT table_name FROM user_tables
        WHERE table_name IN (
            'CANCELLATION','PAYMENT','BOOKING_PASSENGER','BOOKING',
            'SCHEDULE','ROUTE_STOP','ROUTE','VEHICLE',
            'PASSENGER','LOCATION','OPERATOR','TRAVEL_MODE','USERS'
        )
    ) LOOP
        EXECUTE IMMEDIATE 'DROP TABLE ' || t.table_name || ' CASCADE CONSTRAINTS PURGE';
    END LOOP;
END;
/

BEGIN
    FOR s IN (
        SELECT sequence_name FROM user_sequences
        WHERE sequence_name IN (
            'SEQ_USER_ID','SEQ_MODE_ID','SEQ_OPERATOR_ID','SEQ_LOCATION_ID',
            'SEQ_PASSENGER_ID','SEQ_VEHICLE_ID','SEQ_ROUTE_ID','SEQ_ROUTE_STOP_ID',
            'SEQ_SCHEDULE_ID','SEQ_BOOKING_ID','SEQ_BOOKING_PASSENGER_ID',
            'SEQ_PAYMENT_ID','SEQ_CANCELLATION_ID'
        )
    ) LOOP
        EXECUTE IMMEDIATE 'DROP SEQUENCE ' || s.sequence_name;
    END LOOP;
END;
/

CREATE SEQUENCE SEQ_USER_ID             START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_MODE_ID             START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_OPERATOR_ID         START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_LOCATION_ID         START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_PASSENGER_ID        START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_VEHICLE_ID          START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_ROUTE_ID            START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_ROUTE_STOP_ID       START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_SCHEDULE_ID         START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_BOOKING_ID          START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_BOOKING_PASSENGER_ID START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_PAYMENT_ID          START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_CANCELLATION_ID     START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;

CREATE TABLE USERS (
    user_id         NUMBER          CONSTRAINT pk_users PRIMARY KEY,
    full_name       VARCHAR2(100)   CONSTRAINT nn_users_name    NOT NULL,
    email           VARCHAR2(100)   CONSTRAINT nn_users_email   NOT NULL,
    phone           VARCHAR2(15),
    password_hash   VARCHAR2(255)   CONSTRAINT nn_users_pass    NOT NULL,
    role            VARCHAR2(10)    DEFAULT 'user'              NOT NULL,
    created_at      TIMESTAMP       DEFAULT SYSTIMESTAMP        NOT NULL,
    status          VARCHAR2(10)    DEFAULT 'active'            NOT NULL,
    CONSTRAINT uq_users_email   UNIQUE (email),
    CONSTRAINT uq_users_phone   UNIQUE (phone),
    CONSTRAINT chk_users_role   CHECK (role   IN ('admin', 'user')),
    CONSTRAINT chk_users_status CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE TRAVEL_MODE (
    mode_id     NUMBER          CONSTRAINT pk_travel_mode PRIMARY KEY,
    mode_name   VARCHAR2(50)    CONSTRAINT nn_mode_name NOT NULL,
    CONSTRAINT uq_mode_name UNIQUE (mode_name)
);

CREATE TABLE OPERATOR (
    operator_id     NUMBER          CONSTRAINT pk_operator PRIMARY KEY,
    operator_name   VARCHAR2(100)   CONSTRAINT nn_op_name NOT NULL,
    mode_id         NUMBER          CONSTRAINT nn_op_mode NOT NULL,
    contact_email   VARCHAR2(100),
    contact_phone   VARCHAR2(15),
    CONSTRAINT fk_operator_mode FOREIGN KEY (mode_id)
        REFERENCES TRAVEL_MODE (mode_id)
);

CREATE TABLE LOCATION (
    location_id     NUMBER          CONSTRAINT pk_location PRIMARY KEY,
    location_name   VARCHAR2(100)   CONSTRAINT nn_loc_name NOT NULL,
    city            VARCHAR2(100)   CONSTRAINT nn_loc_city NOT NULL,
    state           VARCHAR2(100)   CONSTRAINT nn_loc_state NOT NULL,
    location_type   VARCHAR2(20)    CONSTRAINT nn_loc_type NOT NULL,
    CONSTRAINT chk_loc_type CHECK (location_type IN ('station', 'airport', 'bus_stop'))
);

CREATE TABLE PASSENGER (
    passenger_id    NUMBER          CONSTRAINT pk_passenger PRIMARY KEY,
    user_id         NUMBER          CONSTRAINT nn_pass_user NOT NULL,
    passenger_name  VARCHAR2(100)   CONSTRAINT nn_pass_name NOT NULL,
    age             NUMBER(3)       CONSTRAINT nn_pass_age  NOT NULL,
    gender          VARCHAR2(10)    CONSTRAINT nn_pass_gender NOT NULL,
    id_proof_type   VARCHAR2(50),
    id_proof_number VARCHAR2(100),
    CONSTRAINT fk_passenger_user FOREIGN KEY (user_id)
        REFERENCES USERS (user_id) ON DELETE CASCADE,
    CONSTRAINT chk_pass_gender CHECK (gender IN ('male', 'female', 'other')),
    CONSTRAINT chk_pass_age    CHECK (age > 0 AND age < 130)
);

CREATE TABLE VEHICLE (
    vehicle_id      NUMBER          CONSTRAINT pk_vehicle PRIMARY KEY,
    mode_id         NUMBER          CONSTRAINT nn_veh_mode NOT NULL,
    operator_id     NUMBER          CONSTRAINT nn_veh_op   NOT NULL,
    vehicle_number  VARCHAR2(50)    CONSTRAINT nn_veh_num  NOT NULL,
    vehicle_name    VARCHAR2(100)   CONSTRAINT nn_veh_name NOT NULL,
    total_seats     NUMBER(4)       CONSTRAINT nn_veh_seats NOT NULL,
    status          VARCHAR2(10)    DEFAULT 'active' NOT NULL,
    CONSTRAINT uq_vehicle_number UNIQUE (vehicle_number),
    CONSTRAINT fk_vehicle_mode FOREIGN KEY (mode_id)
        REFERENCES TRAVEL_MODE (mode_id),
    CONSTRAINT fk_vehicle_op FOREIGN KEY (operator_id)
        REFERENCES OPERATOR (operator_id),
    CONSTRAINT chk_veh_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT chk_veh_seats  CHECK (total_seats > 0)
);

CREATE TABLE ROUTE (
    route_id            NUMBER          CONSTRAINT pk_route PRIMARY KEY,
    route_name          VARCHAR2(100)   CONSTRAINT nn_route_name NOT NULL,
    mode_id             NUMBER          CONSTRAINT nn_route_mode NOT NULL,
    operator_id         NUMBER          CONSTRAINT nn_route_op   NOT NULL,
    start_location_id   NUMBER          CONSTRAINT nn_route_start NOT NULL,
    end_location_id     NUMBER          CONSTRAINT nn_route_end   NOT NULL,
    total_distance_km   NUMBER(10,2),
    total_duration_min  NUMBER(6),
    CONSTRAINT fk_route_mode    FOREIGN KEY (mode_id)           REFERENCES TRAVEL_MODE (mode_id),
    CONSTRAINT fk_route_op      FOREIGN KEY (operator_id)       REFERENCES OPERATOR (operator_id),
    CONSTRAINT fk_route_start   FOREIGN KEY (start_location_id) REFERENCES LOCATION (location_id),
    CONSTRAINT fk_route_end     FOREIGN KEY (end_location_id)   REFERENCES LOCATION (location_id),
    CONSTRAINT chk_route_dist   CHECK (total_distance_km > 0),
    CONSTRAINT chk_route_dur    CHECK (total_duration_min > 0)
);

CREATE TABLE ROUTE_STOP (
    route_stop_id           NUMBER  CONSTRAINT pk_route_stop PRIMARY KEY,
    route_id                NUMBER  CONSTRAINT nn_rs_route NOT NULL,
    location_id             NUMBER  CONSTRAINT nn_rs_loc   NOT NULL,
    stop_sequence           NUMBER  CONSTRAINT nn_rs_seq   NOT NULL,
    arrival_offset_min      NUMBER  DEFAULT 0,
    departure_offset_min    NUMBER  DEFAULT 0,
    halt_minutes            NUMBER  DEFAULT 0,
    CONSTRAINT fk_rs_route    FOREIGN KEY (route_id)    REFERENCES ROUTE (route_id) ON DELETE CASCADE,
    CONSTRAINT fk_rs_location FOREIGN KEY (location_id) REFERENCES LOCATION (location_id),
    CONSTRAINT chk_rs_seq     CHECK (stop_sequence >= 0)
);

CREATE TABLE SCHEDULE (
    schedule_id         NUMBER          CONSTRAINT pk_schedule PRIMARY KEY,
    vehicle_id          NUMBER          CONSTRAINT nn_sched_veh NOT NULL,
    route_id            NUMBER          CONSTRAINT nn_sched_route NOT NULL,
    departure_datetime  TIMESTAMP       CONSTRAINT nn_sched_dep NOT NULL,
    arrival_datetime    TIMESTAMP       CONSTRAINT nn_sched_arr NOT NULL,
    base_fare           NUMBER(10,2)    CONSTRAINT nn_sched_fare NOT NULL,
    seats_remaining     NUMBER(4)       CONSTRAINT nn_sched_seats NOT NULL,
    status              VARCHAR2(20)    DEFAULT 'scheduled' NOT NULL,
    CONSTRAINT fk_sched_vehicle FOREIGN KEY (vehicle_id) REFERENCES VEHICLE (vehicle_id) ON DELETE CASCADE,
    CONSTRAINT fk_sched_route   FOREIGN KEY (route_id)   REFERENCES ROUTE (route_id) ON DELETE CASCADE,
    CONSTRAINT chk_sched_status CHECK (status IN ('scheduled','cancelled','completed','full')),
    CONSTRAINT chk_sched_fare   CHECK (base_fare >= 0),
    CONSTRAINT chk_sched_seats  CHECK (seats_remaining >= 0),
    CONSTRAINT chk_sched_dates  CHECK (arrival_datetime > departure_datetime)
);

CREATE TABLE BOOKING (
    booking_id          NUMBER          CONSTRAINT pk_booking PRIMARY KEY,
    user_id             NUMBER          CONSTRAINT nn_book_user NOT NULL,
    schedule_id         NUMBER          CONSTRAINT nn_book_sched NOT NULL,
    boarding_location_id NUMBER         CONSTRAINT nn_book_board NOT NULL,
    dropping_location_id NUMBER         CONSTRAINT nn_book_drop  NOT NULL,
    booking_date        TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
    pnr_number          VARCHAR2(20)    CONSTRAINT nn_book_pnr NOT NULL,
    total_amount        NUMBER(10,2)    DEFAULT 0 NOT NULL,
    booking_status      VARCHAR2(20)    DEFAULT 'pending' NOT NULL,
    CONSTRAINT uq_booking_pnr    UNIQUE (pnr_number),
    CONSTRAINT fk_book_user      FOREIGN KEY (user_id)              REFERENCES USERS (user_id),
    CONSTRAINT fk_book_schedule  FOREIGN KEY (schedule_id)          REFERENCES SCHEDULE (schedule_id) ON DELETE CASCADE,
    CONSTRAINT fk_book_boarding  FOREIGN KEY (boarding_location_id) REFERENCES LOCATION (location_id),
    CONSTRAINT fk_book_dropping  FOREIGN KEY (dropping_location_id) REFERENCES LOCATION (location_id),
    CONSTRAINT chk_book_status   CHECK (booking_status IN ('confirmed','cancelled','pending')),
    CONSTRAINT chk_book_amount   CHECK (total_amount >= 0)
);

CREATE TABLE BOOKING_PASSENGER (
    booking_passenger_id NUMBER      CONSTRAINT pk_booking_pass PRIMARY KEY,
    booking_id          NUMBER       CONSTRAINT nn_bp_booking NOT NULL,
    passenger_id        NUMBER       CONSTRAINT nn_bp_pass    NOT NULL,
    seat_number         VARCHAR2(10) CONSTRAINT nn_bp_seat    NOT NULL,
    fare                NUMBER(10,2) CONSTRAINT nn_bp_fare    NOT NULL,
    CONSTRAINT fk_bp_booking   FOREIGN KEY (booking_id)   REFERENCES BOOKING (booking_id) ON DELETE CASCADE,
    CONSTRAINT fk_bp_passenger FOREIGN KEY (passenger_id) REFERENCES PASSENGER (passenger_id),
    CONSTRAINT chk_bp_fare     CHECK (fare >= 0)
);

CREATE TABLE PAYMENT (
    payment_id      NUMBER          CONSTRAINT pk_payment PRIMARY KEY,
    booking_id      NUMBER          CONSTRAINT nn_pay_booking NOT NULL,
    payment_date    TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
    payment_method  VARCHAR2(50)    CONSTRAINT nn_pay_method NOT NULL,
    amount_paid     NUMBER(10,2)    CONSTRAINT nn_pay_amount NOT NULL,
    payment_status  VARCHAR2(20)    DEFAULT 'pending' NOT NULL,
    transaction_ref VARCHAR2(100),
    CONSTRAINT fk_payment_booking FOREIGN KEY (booking_id) REFERENCES BOOKING (booking_id) ON DELETE CASCADE,
    CONSTRAINT chk_pay_status     CHECK (payment_status IN ('success','failed','pending')),
    CONSTRAINT chk_pay_amount     CHECK (amount_paid >= 0)
);

CREATE TABLE CANCELLATION (
    cancellation_id     NUMBER          CONSTRAINT pk_cancellation PRIMARY KEY,
    booking_id          NUMBER          CONSTRAINT nn_cancel_booking NOT NULL,
    cancellation_date   TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
    refund_amount       NUMBER(10,2)    DEFAULT 0,
    cancellation_reason VARCHAR2(500),
    refund_status       VARCHAR2(20)    DEFAULT 'pending' NOT NULL,
    CONSTRAINT fk_cancel_booking FOREIGN KEY (booking_id) REFERENCES BOOKING (booking_id) ON DELETE CASCADE,
    CONSTRAINT chk_cancel_refund CHECK (refund_amount >= 0),
    CONSTRAINT chk_cancel_status CHECK (refund_status IN ('processed','pending'))
);

-- sequence auto-increment triggers
CREATE OR REPLACE TRIGGER trg_users_id
    BEFORE INSERT ON USERS FOR EACH ROW
BEGIN
    IF :NEW.user_id IS NULL THEN
        SELECT SEQ_USER_ID.NEXTVAL INTO :NEW.user_id FROM DUAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_mode_id
    BEFORE INSERT ON TRAVEL_MODE FOR EACH ROW
BEGIN
    IF :NEW.mode_id IS NULL THEN
        SELECT SEQ_MODE_ID.NEXTVAL INTO :NEW.mode_id FROM DUAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_operator_id
    BEFORE INSERT ON OPERATOR FOR EACH ROW
BEGIN
    IF :NEW.operator_id IS NULL THEN
        SELECT SEQ_OPERATOR_ID.NEXTVAL INTO :NEW.operator_id FROM DUAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_location_id
    BEFORE INSERT ON LOCATION FOR EACH ROW
BEGIN
    IF :NEW.location_id IS NULL THEN
        SELECT SEQ_LOCATION_ID.NEXTVAL INTO :NEW.location_id FROM DUAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_passenger_id
    BEFORE INSERT ON PASSENGER FOR EACH ROW
BEGIN
    IF :NEW.passenger_id IS NULL THEN
        SELECT SEQ_PASSENGER_ID.NEXTVAL INTO :NEW.passenger_id FROM DUAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_vehicle_id
    BEFORE INSERT ON VEHICLE FOR EACH ROW
BEGIN
    IF :NEW.vehicle_id IS NULL THEN
        SELECT SEQ_VEHICLE_ID.NEXTVAL INTO :NEW.vehicle_id FROM DUAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_route_id
    BEFORE INSERT ON ROUTE FOR EACH ROW
BEGIN
    IF :NEW.route_id IS NULL THEN
        SELECT SEQ_ROUTE_ID.NEXTVAL INTO :NEW.route_id FROM DUAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_route_stop_id
    BEFORE INSERT ON ROUTE_STOP FOR EACH ROW
BEGIN
    IF :NEW.route_stop_id IS NULL THEN
        SELECT SEQ_ROUTE_STOP_ID.NEXTVAL INTO :NEW.route_stop_id FROM DUAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_schedule_id
    BEFORE INSERT ON SCHEDULE FOR EACH ROW
BEGIN
    IF :NEW.schedule_id IS NULL THEN
        SELECT SEQ_SCHEDULE_ID.NEXTVAL INTO :NEW.schedule_id FROM DUAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_booking_id
    BEFORE INSERT ON BOOKING FOR EACH ROW
BEGIN
    IF :NEW.booking_id IS NULL THEN
        SELECT SEQ_BOOKING_ID.NEXTVAL INTO :NEW.booking_id FROM DUAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_booking_passenger_id
    BEFORE INSERT ON BOOKING_PASSENGER FOR EACH ROW
BEGIN
    IF :NEW.booking_passenger_id IS NULL THEN
        SELECT SEQ_BOOKING_PASSENGER_ID.NEXTVAL INTO :NEW.booking_passenger_id FROM DUAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_payment_id
    BEFORE INSERT ON PAYMENT FOR EACH ROW
BEGIN
    IF :NEW.payment_id IS NULL THEN
        SELECT SEQ_PAYMENT_ID.NEXTVAL INTO :NEW.payment_id FROM DUAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_cancellation_id
    BEFORE INSERT ON CANCELLATION FOR EACH ROW
BEGIN
    IF :NEW.cancellation_id IS NULL THEN
        SELECT SEQ_CANCELLATION_ID.NEXTVAL INTO :NEW.cancellation_id FROM DUAL;
    END IF;
END;
/

-- logical triggers
CREATE OR REPLACE TRIGGER trg_booking_pnr
    BEFORE INSERT ON BOOKING FOR EACH ROW
BEGIN
    IF :NEW.pnr_number IS NULL THEN
        :NEW.pnr_number := 'PNR' || TO_CHAR(SYSTIMESTAMP, 'YYYYMMDDHH24MISS') ||
                           LPAD(SEQ_BOOKING_ID.CURRVAL, 4, '0');
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_schedule_full_check
    AFTER UPDATE OF seats_remaining ON SCHEDULE FOR EACH ROW
BEGIN
    IF :NEW.seats_remaining = 0 AND :NEW.status = 'scheduled' THEN
        UPDATE SCHEDULE SET status = 'full'
        WHERE schedule_id = :NEW.schedule_id;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_booking_amount_check
    BEFORE INSERT OR UPDATE ON BOOKING FOR EACH ROW
BEGIN
    IF :NEW.total_amount < 0 THEN
        RAISE_APPLICATION_ERROR(-20101, 'Booking total_amount cannot be negative.');
    END IF;
END;
/

CREATE TABLE BOOKING_AUDIT_LOG (
    log_id          NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id      NUMBER,
    old_status      VARCHAR2(20),
    new_status      VARCHAR2(20),
    changed_at      TIMESTAMP DEFAULT SYSTIMESTAMP,
    changed_by      VARCHAR2(100)
);

CREATE OR REPLACE TRIGGER trg_booking_status_audit
    AFTER UPDATE OF booking_status ON BOOKING FOR EACH ROW
BEGIN
    INSERT INTO BOOKING_AUDIT_LOG (booking_id, old_status, new_status, changed_at)
    VALUES (:OLD.booking_id, :OLD.booking_status, :NEW.booking_status, SYSTIMESTAMP);
END;
/

CREATE OR REPLACE TRIGGER trg_prevent_invalid_booking
    BEFORE INSERT ON BOOKING FOR EACH ROW
DECLARE
    v_status SCHEDULE.status%TYPE;
BEGIN
    SELECT status INTO v_status FROM SCHEDULE WHERE schedule_id = :NEW.schedule_id;
    IF v_status IN ('cancelled', 'completed', 'full') THEN
        RAISE_APPLICATION_ERROR(-20102,
            'Cannot book on a schedule with status: ' || v_status);
    END IF;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20103, 'Schedule not found.');
END;
/

CREATE OR REPLACE TRIGGER trg_passenger_validate
    BEFORE INSERT OR UPDATE ON PASSENGER FOR EACH ROW
BEGIN
    IF TRIM(:NEW.passenger_name) IS NULL THEN
        RAISE_APPLICATION_ERROR(-20104, 'Passenger name cannot be blank.');
    END IF;
    IF :NEW.age <= 0 OR :NEW.age > 120 THEN
        RAISE_APPLICATION_ERROR(-20105, 'Passenger age must be between 1 and 120.');
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_booking_cancel_restore_seats
    AFTER UPDATE OF booking_status ON BOOKING FOR EACH ROW
DECLARE
    v_seat_count NUMBER;
BEGIN
    IF :NEW.booking_status = 'cancelled' AND :OLD.booking_status != 'cancelled' THEN
        SELECT COUNT(*) INTO v_seat_count
        FROM BOOKING_PASSENGER
        WHERE booking_id = :NEW.booking_id;

        UPDATE SCHEDULE
        SET seats_remaining = seats_remaining + v_seat_count,
            status = CASE
                         WHEN status = 'full' THEN 'scheduled'
                         ELSE status
                     END
        WHERE schedule_id = :NEW.schedule_id;
    END IF;
END;
/

-- pl/sql procedures
CREATE OR REPLACE PROCEDURE proc_create_booking (
    p_user_id               IN  BOOKING.user_id%TYPE,
    p_schedule_id           IN  BOOKING.schedule_id%TYPE,
    p_boarding_location_id  IN  BOOKING.boarding_location_id%TYPE,
    p_dropping_location_id  IN  BOOKING.dropping_location_id%TYPE,
    p_booking_id            OUT BOOKING.booking_id%TYPE
) AS
    v_pnr   VARCHAR2(20);
    v_seats NUMBER;
BEGIN
    SELECT seats_remaining INTO v_seats
    FROM SCHEDULE WHERE schedule_id = p_schedule_id;

    IF v_seats <= 0 THEN
        RAISE_APPLICATION_ERROR(-20110, 'No seats remaining on this schedule.');
    END IF;

    v_pnr := 'PNR' || TO_CHAR(SYSTIMESTAMP, 'YYYYMMDDHH24MISS') ||
              LPAD(SEQ_BOOKING_ID.NEXTVAL, 4, '0');

    INSERT INTO BOOKING (
        user_id, schedule_id, boarding_location_id, dropping_location_id,
        pnr_number, booking_status, total_amount
    ) VALUES (
        p_user_id, p_schedule_id, p_boarding_location_id, p_dropping_location_id,
        v_pnr, 'pending', 0
    ) RETURNING booking_id INTO p_booking_id;

    COMMIT;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20111, 'Schedule not found.');
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END proc_create_booking;
/

CREATE OR REPLACE PROCEDURE proc_add_passenger (
    p_booking_id    IN BOOKING_PASSENGER.booking_id%TYPE,
    p_passenger_id  IN BOOKING_PASSENGER.passenger_id%TYPE,
    p_seat_number   IN BOOKING_PASSENGER.seat_number%TYPE,
    p_fare          IN BOOKING_PASSENGER.fare%TYPE
) AS
    v_schedule_id   SCHEDULE.schedule_id%TYPE;
    v_seat_taken    NUMBER;
    v_remaining     NUMBER;
BEGIN
    SELECT schedule_id INTO v_schedule_id
    FROM BOOKING WHERE booking_id = p_booking_id;

    SELECT seats_remaining INTO v_remaining
    FROM SCHEDULE WHERE schedule_id = v_schedule_id;

    IF v_remaining <= 0 THEN
        RAISE_APPLICATION_ERROR(-20112, 'No seats remaining.');
    END IF;

    SELECT COUNT(*) INTO v_seat_taken
    FROM BOOKING_PASSENGER bp
    JOIN BOOKING b ON bp.booking_id = b.booking_id
    WHERE b.schedule_id = v_schedule_id
      AND bp.seat_number = p_seat_number
      AND b.booking_status != 'cancelled';

    IF v_seat_taken > 0 THEN
        RAISE_APPLICATION_ERROR(-20113, 'Seat ' || p_seat_number || ' already booked.');
    END IF;

    INSERT INTO BOOKING_PASSENGER (booking_id, passenger_id, seat_number, fare)
    VALUES (p_booking_id, p_passenger_id, p_seat_number, p_fare);

    UPDATE SCHEDULE SET seats_remaining = seats_remaining - 1
    WHERE schedule_id = v_schedule_id;

    UPDATE BOOKING
    SET total_amount = (
        SELECT NVL(SUM(fare), 0) FROM BOOKING_PASSENGER WHERE booking_id = p_booking_id
    )
    WHERE booking_id = p_booking_id;

    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END proc_add_passenger;
/

CREATE OR REPLACE PROCEDURE proc_confirm_booking (
    p_booking_id IN BOOKING.booking_id%TYPE
) AS
BEGIN
    UPDATE BOOKING SET booking_status = 'confirmed'
    WHERE booking_id = p_booking_id;

    IF SQL%ROWCOUNT = 0 THEN
        RAISE_APPLICATION_ERROR(-20114, 'Booking not found: ' || p_booking_id);
    END IF;
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN ROLLBACK; RAISE;
END proc_confirm_booking;
/

CREATE OR REPLACE PROCEDURE proc_cancel_booking (
    p_booking_id        IN BOOKING.booking_id%TYPE,
    p_reason            IN VARCHAR2,
    p_refund_amount     OUT NUMBER
) AS
    v_total     BOOKING.total_amount%TYPE;
    v_status    BOOKING.booking_status%TYPE;
    v_paid      NUMBER;
BEGIN
    SELECT total_amount, booking_status INTO v_total, v_status
    FROM BOOKING WHERE booking_id = p_booking_id;

    IF v_status = 'cancelled' THEN
        RAISE_APPLICATION_ERROR(-20115, 'Booking already cancelled.');
    END IF;

    SAVEPOINT before_cancel;

    UPDATE BOOKING SET booking_status = 'cancelled'
    WHERE booking_id = p_booking_id;

    SELECT NVL(SUM(amount_paid), 0) INTO v_paid
    FROM PAYMENT WHERE booking_id = p_booking_id AND payment_status = 'success';

    p_refund_amount := CASE WHEN v_paid > 0 THEN ROUND(v_total * 0.8, 2) ELSE 0 END;

    INSERT INTO CANCELLATION (
        booking_id, cancellation_date, refund_amount,
        cancellation_reason, refund_status
    ) VALUES (
        p_booking_id, SYSTIMESTAMP, p_refund_amount,
        NVL(p_reason, 'User requested'),
        CASE WHEN v_paid > 0 THEN 'processed' ELSE 'pending' END
    );

    COMMIT;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        ROLLBACK TO before_cancel;
        RAISE_APPLICATION_ERROR(-20116, 'Booking not found.');
    WHEN OTHERS THEN
        ROLLBACK TO before_cancel;
        RAISE;
END proc_cancel_booking;
/

CREATE OR REPLACE PROCEDURE proc_process_payment (
    p_booking_id        IN  BOOKING.booking_id%TYPE,
    p_payment_method    IN  VARCHAR2,
    p_transaction_ref   OUT VARCHAR2
) AS
    v_amount    BOOKING.total_amount%TYPE;
    v_status    BOOKING.booking_status%TYPE;
BEGIN
    SELECT total_amount, booking_status INTO v_amount, v_status
    FROM BOOKING WHERE booking_id = p_booking_id;

    IF v_status != 'pending' THEN
        RAISE_APPLICATION_ERROR(-20120, 'Booking is not in pending state: ' || v_status);
    END IF;

    SAVEPOINT before_payment;

    p_transaction_ref := 'TXN' || TO_CHAR(SYSTIMESTAMP, 'YYYYMMDDHH24MISS') ||
                         LPAD(p_booking_id, 6, '0');

    INSERT INTO PAYMENT (
        booking_id, payment_date, payment_method,
        amount_paid, payment_status, transaction_ref
    ) VALUES (
        p_booking_id, SYSTIMESTAMP, p_payment_method,
        v_amount, 'success', p_transaction_ref
    );

    UPDATE BOOKING SET booking_status = 'confirmed'
    WHERE booking_id = p_booking_id;

    COMMIT;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        ROLLBACK TO before_payment;
        RAISE_APPLICATION_ERROR(-20121, 'Booking not found.');
    WHEN OTHERS THEN
        ROLLBACK TO before_payment;
        RAISE;
END proc_process_payment;
/

CREATE OR REPLACE PROCEDURE proc_search_schedules (
    p_start_loc_id  IN  NUMBER,
    p_end_loc_id    IN  NUMBER,
    p_date          IN  DATE,
    p_cursor        OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cursor FOR
        SELECT s.schedule_id,
               s.departure_datetime,
               s.arrival_datetime,
               s.base_fare,
               s.seats_remaining,
               s.status,
               r.route_name,
               v.vehicle_name,
               v.vehicle_number,
               tm.mode_name,
               op.operator_name,
               l1.location_name AS start_location,
               l2.location_name AS end_location
        FROM   SCHEDULE s
        JOIN   ROUTE r    ON s.route_id    = r.route_id
        JOIN   VEHICLE v  ON s.vehicle_id  = v.vehicle_id
        JOIN   TRAVEL_MODE tm ON v.mode_id = tm.mode_id
        JOIN   OPERATOR op    ON v.operator_id = op.operator_id
        JOIN   LOCATION l1    ON r.start_location_id = l1.location_id
        JOIN   LOCATION l2    ON r.end_location_id   = l2.location_id
        JOIN   ROUTE_STOP rs1 ON r.route_id = rs1.route_id AND rs1.location_id = p_start_loc_id
        JOIN   ROUTE_STOP rs2 ON r.route_id = rs2.route_id AND rs2.location_id = p_end_loc_id
        WHERE  rs1.stop_sequence < rs2.stop_sequence
          AND  TRUNC(s.departure_datetime) = TRUNC(p_date)
          AND  s.status IN ('scheduled', 'full');
END proc_search_schedules;
/

CREATE OR REPLACE PROCEDURE proc_get_user_bookings (
    p_user_id   IN  NUMBER,
    p_cursor    OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cursor FOR
        SELECT b.booking_id,
               b.pnr_number,
               b.booking_status,
               b.total_amount,
               b.booking_date,
               s.departure_datetime,
               s.arrival_datetime,
               r.route_name,
               tm.mode_name,
               l1.location_name AS boarding_location,
               l2.location_name AS dropping_location
        FROM   BOOKING b
        JOIN   SCHEDULE s ON b.schedule_id = s.schedule_id
        JOIN   ROUTE r    ON s.route_id    = r.route_id
        JOIN   TRAVEL_MODE tm ON r.mode_id = tm.mode_id
        JOIN   LOCATION l1 ON b.boarding_location_id = l1.location_id
        JOIN   LOCATION l2 ON b.dropping_location_id = l2.location_id
        WHERE  b.user_id = p_user_id
        ORDER BY b.booking_date DESC;
END proc_get_user_bookings;
/

CREATE OR REPLACE PROCEDURE proc_admin_dashboard (
    p_total_users       OUT NUMBER,
    p_total_bookings    OUT NUMBER,
    p_confirmed         OUT NUMBER,
    p_cancelled         OUT NUMBER,
    p_total_revenue     OUT NUMBER,
    p_active_schedules  OUT NUMBER
) AS
BEGIN
    SELECT COUNT(*) INTO p_total_users
    FROM USERS WHERE role = 'user';

    SELECT COUNT(*) INTO p_total_bookings FROM BOOKING;

    SELECT COUNT(*) INTO p_confirmed
    FROM BOOKING WHERE booking_status = 'confirmed';

    SELECT COUNT(*) INTO p_cancelled
    FROM BOOKING WHERE booking_status = 'cancelled';

    SELECT NVL(SUM(amount_paid), 0) INTO p_total_revenue
    FROM PAYMENT WHERE payment_status = 'success';

    SELECT COUNT(*) INTO p_active_schedules
    FROM SCHEDULE WHERE status = 'scheduled';
END proc_admin_dashboard;
/

CREATE OR REPLACE PROCEDURE proc_remove_passenger (
    p_booking_passenger_id IN NUMBER
) AS
    v_booking_id    NUMBER;
    v_schedule_id   NUMBER;
BEGIN
    SELECT bp.booking_id INTO v_booking_id
    FROM BOOKING_PASSENGER bp WHERE bp.booking_passenger_id = p_booking_passenger_id;

    SELECT schedule_id INTO v_schedule_id
    FROM BOOKING WHERE booking_id = v_booking_id;

    DELETE FROM BOOKING_PASSENGER
    WHERE booking_passenger_id = p_booking_passenger_id;

    UPDATE SCHEDULE SET seats_remaining = seats_remaining + 1
    WHERE schedule_id = v_schedule_id;

    UPDATE BOOKING
    SET total_amount = NVL((
        SELECT SUM(fare) FROM BOOKING_PASSENGER WHERE booking_id = v_booking_id
    ), 0)
    WHERE booking_id = v_booking_id;

    COMMIT;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20130, 'Booking passenger record not found.');
    WHEN OTHERS THEN ROLLBACK; RAISE;
END proc_remove_passenger;
/

CREATE OR REPLACE PROCEDURE proc_create_booking (
    p_user_id               IN  BOOKING.user_id%TYPE,
    p_schedule_id           IN  BOOKING.schedule_id%TYPE,
    p_boarding_location_id  IN  BOOKING.boarding_location_id%TYPE,
    p_dropping_location_id  IN  BOOKING.dropping_location_id%TYPE,
    p_booking_id            OUT BOOKING.booking_id%TYPE
) AS
    v_seats NUMBER;
BEGIN
    SELECT seats_remaining INTO v_seats
    FROM SCHEDULE WHERE schedule_id = p_schedule_id;

    IF v_seats <= 0 THEN
        RAISE_APPLICATION_ERROR(-20110, 'No seats remaining on this schedule.');
    END IF;
    INSERT INTO BOOKING (
        user_id, schedule_id, boarding_location_id, dropping_location_id,
        booking_status, total_amount
    ) VALUES (
        p_user_id, p_schedule_id, p_boarding_location_id, p_dropping_location_id,
        'pending', 0
    ) RETURNING booking_id INTO p_booking_id;

    COMMIT;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20111, 'Schedule not found.');
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END proc_create_booking;
/

-- functions
CREATE OR REPLACE FUNCTION fn_user_booking_count (
    p_user_id IN NUMBER
) RETURN NUMBER AS
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM BOOKING WHERE user_id = p_user_id;
    RETURN v_count;
END fn_user_booking_count;
/

CREATE OR REPLACE FUNCTION fn_seats_remaining (
    p_schedule_id IN NUMBER
) RETURN NUMBER AS
    v_seats NUMBER;
BEGIN
    SELECT seats_remaining INTO v_seats FROM SCHEDULE WHERE schedule_id = p_schedule_id;
    RETURN v_seats;
EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN -1;
END fn_seats_remaining;
/

CREATE OR REPLACE FUNCTION fn_route_revenue (
    p_route_id IN NUMBER
) RETURN NUMBER AS
    v_revenue NUMBER;
BEGIN
    SELECT NVL(SUM(p.amount_paid), 0) INTO v_revenue
    FROM PAYMENT p
    JOIN BOOKING b ON p.booking_id = b.booking_id
    JOIN SCHEDULE s ON b.schedule_id = s.schedule_id
    WHERE s.route_id = p_route_id
      AND p.payment_status = 'success';
    RETURN v_revenue;
END fn_route_revenue;
/

CREATE OR REPLACE FUNCTION fn_is_seat_available (
    p_schedule_id   IN NUMBER,
    p_seat_number   IN VARCHAR2
) RETURN VARCHAR2 AS
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM BOOKING_PASSENGER bp
    JOIN BOOKING b ON bp.booking_id = b.booking_id
    WHERE b.schedule_id  = p_schedule_id
      AND bp.seat_number = p_seat_number
      AND b.booking_status != 'cancelled';

    IF v_count = 0 THEN RETURN 'Y'; ELSE RETURN 'N'; END IF;
END fn_is_seat_available;
/

CREATE OR REPLACE FUNCTION fn_most_popular_route RETURN VARCHAR2 AS
    v_route_name VARCHAR2(100);
BEGIN
    SELECT route_name INTO v_route_name
    FROM (
        SELECT r.route_name, COUNT(b.booking_id) AS cnt
        FROM ROUTE r
        JOIN SCHEDULE s ON r.route_id = s.route_id
        JOIN BOOKING b  ON b.schedule_id = s.schedule_id
        GROUP BY r.route_name
        ORDER BY cnt DESC
    )
    WHERE ROWNUM = 1;
    RETURN v_route_name;
EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN 'N/A';
END fn_most_popular_route;
/

-- packages
CREATE OR REPLACE PACKAGE travel_pkg AS
    PROCEDURE search_schedules(
        p_start_loc_id IN NUMBER,
        p_end_loc_id   IN NUMBER,
        p_date         IN DATE,
        p_cursor       OUT SYS_REFCURSOR
    );

    PROCEDURE create_booking(
        p_user_id              IN  NUMBER,
        p_schedule_id          IN  NUMBER,
        p_boarding_location_id IN  NUMBER,
        p_dropping_location_id IN  NUMBER,
        p_booking_id           OUT NUMBER
    );
    PROCEDURE add_passenger(
        p_booking_id   IN NUMBER,
        p_passenger_id IN NUMBER,
        p_seat_number  IN VARCHAR2,
        p_fare         IN NUMBER
    );
    PROCEDURE confirm_booking(p_booking_id IN NUMBER);
    PROCEDURE cancel_booking(
        p_booking_id    IN  NUMBER,
        p_reason        IN  VARCHAR2,
        p_refund_amount OUT NUMBER
    );
    PROCEDURE process_payment(
        p_booking_id      IN  NUMBER,
        p_payment_method  IN  VARCHAR2,
        p_transaction_ref OUT VARCHAR2
    );

    FUNCTION seats_remaining(p_schedule_id IN NUMBER) RETURN NUMBER;
    FUNCTION is_seat_available(p_schedule_id IN NUMBER, p_seat_number IN VARCHAR2) RETURN VARCHAR2;
    FUNCTION user_booking_count(p_user_id IN NUMBER) RETURN NUMBER;
END travel_pkg;
/

CREATE OR REPLACE PACKAGE BODY travel_pkg AS

    PROCEDURE search_schedules(
        p_start_loc_id IN NUMBER, p_end_loc_id IN NUMBER,
        p_date IN DATE, p_cursor OUT SYS_REFCURSOR
    ) AS BEGIN
        proc_search_schedules(p_start_loc_id, p_end_loc_id, p_date, p_cursor);
    END;

    PROCEDURE create_booking(
        p_user_id IN NUMBER, p_schedule_id IN NUMBER,
        p_boarding_location_id IN NUMBER, p_dropping_location_id IN NUMBER,
        p_booking_id OUT NUMBER
    ) AS BEGIN
        proc_create_booking(p_user_id, p_schedule_id,
                            p_boarding_location_id, p_dropping_location_id,
                            p_booking_id);
    END;

    PROCEDURE add_passenger(
        p_booking_id IN NUMBER, p_passenger_id IN NUMBER,
        p_seat_number IN VARCHAR2, p_fare IN NUMBER
    ) AS BEGIN
        proc_add_passenger(p_booking_id, p_passenger_id, p_seat_number, p_fare);
    END;

    PROCEDURE confirm_booking(p_booking_id IN NUMBER) AS BEGIN
        proc_confirm_booking(p_booking_id);
    END;

    PROCEDURE cancel_booking(
        p_booking_id IN NUMBER, p_reason IN VARCHAR2, p_refund_amount OUT NUMBER
    ) AS BEGIN
        proc_cancel_booking(p_booking_id, p_reason, p_refund_amount);
    END;

    PROCEDURE process_payment(
        p_booking_id IN NUMBER, p_payment_method IN VARCHAR2,
        p_transaction_ref OUT VARCHAR2
    ) AS BEGIN
        proc_process_payment(p_booking_id, p_payment_method, p_transaction_ref);
    END;

    FUNCTION seats_remaining(p_schedule_id IN NUMBER) RETURN NUMBER AS BEGIN
        RETURN fn_seats_remaining(p_schedule_id);
    END;

    FUNCTION is_seat_available(p_schedule_id IN NUMBER, p_seat_number IN VARCHAR2)
    RETURN VARCHAR2 AS BEGIN
        RETURN fn_is_seat_available(p_schedule_id, p_seat_number);
    END;

    FUNCTION user_booking_count(p_user_id IN NUMBER) RETURN NUMBER AS BEGIN
        RETURN fn_user_booking_count(p_user_id);
    END;

END travel_pkg;
/

-- sample data
INSERT INTO TRAVEL_MODE (mode_name) VALUES ('Bus');
INSERT INTO TRAVEL_MODE (mode_name) VALUES ('Train');
INSERT INTO TRAVEL_MODE (mode_name) VALUES ('Flight');

INSERT INTO OPERATOR (operator_name, mode_id, contact_email, contact_phone)
VALUES ('KSRTC', 1, 'info@ksrtc.in', '1800-425-1663');
INSERT INTO OPERATOR (operator_name, mode_id, contact_email, contact_phone)
VALUES ('Indian Railways', 2, 'care@irctc.co.in', '139');
INSERT INTO OPERATOR (operator_name, mode_id, contact_email, contact_phone)
VALUES ('IndiGo Airlines', 3, 'support@goindigo.in', '1800-180-3838');
INSERT INTO OPERATOR (operator_name, mode_id, contact_email, contact_phone)
VALUES ('NEKRTC', 1, 'info@nekrtc.in', '1800-425-9999');

INSERT INTO LOCATION (location_name, city, state, location_type)
VALUES ('Kempegowda Bus Station', 'Bengaluru', 'Karnataka', 'bus_stop');
INSERT INTO LOCATION (location_name, city, state, location_type)
VALUES ('Mysuru Bus Station', 'Mysuru', 'Karnataka', 'bus_stop');
INSERT INTO LOCATION (location_name, city, state, location_type)
VALUES ('Krantivira Sangolli Rayanna Railway Station', 'Bengaluru', 'Karnataka', 'station');
INSERT INTO LOCATION (location_name, city, state, location_type)
VALUES ('Mysuru Railway Station', 'Mysuru', 'Karnataka', 'station');
INSERT INTO LOCATION (location_name, city, state, location_type)
VALUES ('Kempegowda International Airport', 'Bengaluru', 'Karnataka', 'airport');
INSERT INTO LOCATION (location_name, city, state, location_type)
VALUES ('Chennai Central', 'Chennai', 'Tamil Nadu', 'station');
INSERT INTO LOCATION (location_name, city, state, location_type)
VALUES ('Chennai Bus Terminus', 'Chennai', 'Tamil Nadu', 'bus_stop');
INSERT INTO LOCATION (location_name, city, state, location_type)
VALUES ('Chennai International Airport', 'Chennai', 'Tamil Nadu', 'airport');
INSERT INTO LOCATION (location_name, city, state, location_type)
VALUES ('Hubli Bus Station', 'Hubli', 'Karnataka', 'bus_stop');
INSERT INTO LOCATION (location_name, city, state, location_type)
VALUES ('Mangaluru Central', 'Mangaluru', 'Karnataka', 'station');

INSERT INTO VEHICLE (mode_id, operator_id, vehicle_number, vehicle_name, total_seats, status)
VALUES (1, 1, 'KA01AB1234', 'Airavat Club Class', 49, 'active');
INSERT INTO VEHICLE (mode_id, operator_id, vehicle_number, vehicle_name, total_seats, status)
VALUES (2, 2, 'TN12345678', 'Shatabdi Express', 112, 'active');
INSERT INTO VEHICLE (mode_id, operator_id, vehicle_number, vehicle_name, total_seats, status)
VALUES (3, 3, '6E-301', 'IndiGo A320', 180, 'active');
INSERT INTO VEHICLE (mode_id, operator_id, vehicle_number, vehicle_name, total_seats, status)
VALUES (1, 4, 'KA02CD5678', 'Rajahamsa Deluxe', 45, 'active');
INSERT INTO VEHICLE (mode_id, operator_id, vehicle_number, vehicle_name, total_seats, status)
VALUES (2, 2, 'TN87654321', 'Mysuru Express', 80, 'active');

INSERT INTO ROUTE (route_name, mode_id, operator_id, start_location_id, end_location_id,
                   total_distance_km, total_duration_min)
VALUES ('Bengaluru - Mysuru Bus', 1, 1, 1, 2, 150, 180);

INSERT INTO ROUTE (route_name, mode_id, operator_id, start_location_id, end_location_id,
                   total_distance_km, total_duration_min)
VALUES ('Bengaluru - Mysuru Train', 2, 2, 3, 4, 139, 120);

INSERT INTO ROUTE (route_name, mode_id, operator_id, start_location_id, end_location_id,
                   total_distance_km, total_duration_min)
VALUES ('Bengaluru - Chennai Flight', 3, 3, 5, 8, 331, 75);

INSERT INTO ROUTE (route_name, mode_id, operator_id, start_location_id, end_location_id,
                   total_distance_km, total_duration_min)
VALUES ('Bengaluru - Hubli Bus', 1, 4, 1, 9, 410, 360);

INSERT INTO ROUTE (route_name, mode_id, operator_id, start_location_id, end_location_id,
                   total_distance_km, total_duration_min)
VALUES ('Mysuru - Bengaluru Train', 2, 2, 4, 3, 139, 125);

INSERT INTO ROUTE_STOP (route_id, location_id, stop_sequence, arrival_offset_min, departure_offset_min, halt_minutes)
VALUES (1, 1, 1, 0, 0, 0);
INSERT INTO ROUTE_STOP (route_id, location_id, stop_sequence, arrival_offset_min, departure_offset_min, halt_minutes)
VALUES (1, 2, 2, 175, 180, 5);

INSERT INTO ROUTE_STOP (route_id, location_id, stop_sequence, arrival_offset_min, departure_offset_min, halt_minutes)
VALUES (2, 3, 1, 0, 0, 0);
INSERT INTO ROUTE_STOP (route_id, location_id, stop_sequence, arrival_offset_min, departure_offset_min, halt_minutes)
VALUES (2, 4, 2, 115, 120, 5);

INSERT INTO ROUTE_STOP (route_id, location_id, stop_sequence, arrival_offset_min, departure_offset_min, halt_minutes)
VALUES (3, 5, 1, 0, 0, 0);
INSERT INTO ROUTE_STOP (route_id, location_id, stop_sequence, arrival_offset_min, departure_offset_min, halt_minutes)
VALUES (3, 8, 2, 70, 75, 5);

INSERT INTO ROUTE_STOP (route_id, location_id, stop_sequence, arrival_offset_min, departure_offset_min, halt_minutes)
VALUES (4, 1, 1, 0, 0, 0);
INSERT INTO ROUTE_STOP (route_id, location_id, stop_sequence, arrival_offset_min, departure_offset_min, halt_minutes)
VALUES (4, 9, 2, 355, 360, 5);

INSERT INTO ROUTE_STOP (route_id, location_id, stop_sequence, arrival_offset_min, departure_offset_min, halt_minutes)
VALUES (5, 4, 1, 0, 0, 0);
INSERT INTO ROUTE_STOP (route_id, location_id, stop_sequence, arrival_offset_min, departure_offset_min, halt_minutes)
VALUES (5, 3, 2, 120, 125, 5);

INSERT INTO SCHEDULE (vehicle_id, route_id, departure_datetime, arrival_datetime,
                      base_fare, seats_remaining, status)
VALUES (1, 1,
        TIMESTAMP '2026-04-10 06:00:00',
        TIMESTAMP '2026-04-10 09:00:00',
        350, 49, 'scheduled');

INSERT INTO SCHEDULE (vehicle_id, route_id, departure_datetime, arrival_datetime,
                      base_fare, seats_remaining, status)
VALUES (1, 1,
        TIMESTAMP '2026-04-10 14:00:00',
        TIMESTAMP '2026-04-10 17:00:00',
        350, 49, 'scheduled');

INSERT INTO SCHEDULE (vehicle_id, route_id, departure_datetime, arrival_datetime,
                      base_fare, seats_remaining, status)
VALUES (2, 2,
        TIMESTAMP '2026-04-10 07:15:00',
        TIMESTAMP '2026-04-10 09:15:00',
        180, 112, 'scheduled');

INSERT INTO SCHEDULE (vehicle_id, route_id, departure_datetime, arrival_datetime,
                      base_fare, seats_remaining, status)
VALUES (3, 3,
        TIMESTAMP '2026-04-10 08:00:00',
        TIMESTAMP '2026-04-10 09:15:00',
        3200, 180, 'scheduled');

INSERT INTO SCHEDULE (vehicle_id, route_id, departure_datetime, arrival_datetime,
                      base_fare, seats_remaining, status)
VALUES (4, 4,
        TIMESTAMP '2026-04-10 21:00:00',
        TIMESTAMP '2026-04-11 03:00:00',
        700, 45, 'scheduled');

INSERT INTO SCHEDULE (vehicle_id, route_id, departure_datetime, arrival_datetime,
                      base_fare, seats_remaining, status)
VALUES (5, 5,
        TIMESTAMP '2026-04-10 10:00:00',
        TIMESTAMP '2026-04-10 12:05:00',
        200, 80, 'scheduled');

INSERT INTO USERS (full_name, email, phone, password_hash, role, status)
VALUES ('Admin User', 'admin@travelbook.com', '9999999999',
        '$2a$10$ytiCHtbJ.u5DOjFEQZDodexjLGbfVD2YYbvDsf8Lz7JLl545.RsiG', 'admin', 'active');

INSERT INTO USERS (full_name, email, phone, password_hash, role, status)
VALUES ('Test User', 'user@travelbook.com', '8888888888',
        '$2a$10$wk2BXKuOAgU0360YQjvuH.FxfhpNKsEgpFYzxGRjFm6f7rDKDnx2C', 'user', 'active');
COMMIT;


-- verification queries
PROMPT ============================================================
PROMPT Travel Booking DB Setup Complete
PROMPT ============================================================
SELECT 'USERS'         AS tbl, COUNT(*) AS rows_inserted FROM USERS        UNION ALL
SELECT 'TRAVEL_MODE'   AS tbl, COUNT(*) FROM TRAVEL_MODE   UNION ALL
SELECT 'OPERATOR'      AS tbl, COUNT(*) FROM OPERATOR       UNION ALL
SELECT 'LOCATION'      AS tbl, COUNT(*) FROM LOCATION       UNION ALL
SELECT 'VEHICLE'       AS tbl, COUNT(*) FROM VEHICLE        UNION ALL
SELECT 'ROUTE'         AS tbl, COUNT(*) FROM ROUTE          UNION ALL
SELECT 'ROUTE_STOP'    AS tbl, COUNT(*) FROM ROUTE_STOP     UNION ALL
SELECT 'SCHEDULE'      AS tbl, COUNT(*) FROM SCHEDULE;

PROMPT ============================================================
PROMPT Procedures and Functions registered:
PROMPT   proc_create_booking, proc_add_passenger, proc_confirm_booking
PROMPT   proc_cancel_booking, proc_process_payment, proc_search_schedules
PROMPT   proc_get_user_bookings, proc_admin_dashboard, proc_remove_passenger
PROMPT   fn_seats_remaining, fn_is_seat_available, fn_user_booking_count
PROMPT   fn_route_revenue, fn_most_popular_route
PROMPT   Package: travel_pkg
PROMPT ============================================================
