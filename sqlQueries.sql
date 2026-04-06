DROP DATABASE IF EXISTS travel_booking;
CREATE DATABASE travel_booking;
USE travel_booking;

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(15),
    password_hash VARCHAR(255),
    role ENUM('admin','user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active','inactive') DEFAULT 'active'
);

CREATE TABLE travel_mode (
    mode_id INT AUTO_INCREMENT PRIMARY KEY,
    mode_name VARCHAR(50) UNIQUE
);

CREATE TABLE operator (
    operator_id INT AUTO_INCREMENT PRIMARY KEY,
    operator_name VARCHAR(100),
    mode_id INT,
    contact_email VARCHAR(100),
    contact_phone VARCHAR(15),
    FOREIGN KEY (mode_id) REFERENCES travel_mode(mode_id)
);

CREATE TABLE location (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    location_name VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(100),
    location_type ENUM('station','airport','bus_stop')
);

CREATE TABLE passenger (
    passenger_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    passenger_name VARCHAR(100),
    age INT,
    gender ENUM('male','female','other'),
    id_proof_type VARCHAR(50),
    id_proof_number VARCHAR(100),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE vehicle (
    vehicle_id INT AUTO_INCREMENT PRIMARY KEY,
    mode_id INT,
    operator_id INT,
    vehicle_number VARCHAR(50) UNIQUE,
    vehicle_name VARCHAR(100),
    total_seats INT,
    status ENUM('active','inactive'),
    FOREIGN KEY (mode_id) REFERENCES travel_mode(mode_id),
    FOREIGN KEY (operator_id) REFERENCES operator(operator_id)
);

CREATE TABLE route (
    route_id INT AUTO_INCREMENT PRIMARY KEY,
    route_name VARCHAR(100),
    mode_id INT,
    operator_id INT,
    start_location_id INT,
    end_location_id INT,
    total_distance_km DECIMAL(10,2),
    total_duration_min INT,
    FOREIGN KEY (mode_id) REFERENCES travel_mode(mode_id),
    FOREIGN KEY (operator_id) REFERENCES operator(operator_id),
    FOREIGN KEY (start_location_id) REFERENCES location(location_id) ON DELETE CASCADE,
    FOREIGN KEY (end_location_id) REFERENCES location(location_id) ON DELETE CASCADE
);

CREATE TABLE route_stop (
    route_stop_id INT AUTO_INCREMENT PRIMARY KEY,
    route_id INT,
    location_id INT,
    stop_sequence INT,
    arrival_offset_min INT,
    departure_offset_min INT,
    halt_minutes INT,
    FOREIGN KEY (route_id) REFERENCES route(route_id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES location(location_id) ON DELETE CASCADE
);

CREATE TABLE schedule (
    schedule_id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT,
    route_id INT,
    departure_datetime DATETIME,
    arrival_datetime DATETIME,
    base_fare DECIMAL(10,2),
    available_seats INT,
    seats_remaining INT,
    status ENUM('scheduled','cancelled','completed','full'),
    FOREIGN KEY (vehicle_id) REFERENCES vehicle(vehicle_id) ON DELETE CASCADE,
    FOREIGN KEY (route_id) REFERENCES route(route_id) ON DELETE CASCADE
);

CREATE TABLE seat (
    seat_id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT,
    seat_number VARCHAR(10),
    seat_type VARCHAR(50),
    class_type VARCHAR(50),
    status ENUM('available','reserved','blocked'),
    UNIQUE(vehicle_id, seat_number),
    FOREIGN KEY (vehicle_id) REFERENCES vehicle(vehicle_id) ON DELETE CASCADE
);

CREATE TABLE booking (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    schedule_id INT,
    boarding_location_id INT,
    dropping_location_id INT,
    booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pnr_number VARCHAR(20) UNIQUE,
    total_amount DECIMAL(10,2),
    booking_status ENUM('confirmed','cancelled','pending'),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (schedule_id) REFERENCES schedule(schedule_id) ON DELETE CASCADE,
    FOREIGN KEY (boarding_location_id) REFERENCES location(location_id),
    FOREIGN KEY (dropping_location_id) REFERENCES location(location_id)
);

CREATE TABLE booking_passenger (
    booking_id INT,
    passenger_id INT,
    seat_id INT,
    fare DECIMAL(10,2),
    PRIMARY KEY (booking_id, passenger_id),
    FOREIGN KEY (booking_id) REFERENCES booking(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (passenger_id) REFERENCES passenger(passenger_id),
    FOREIGN KEY (seat_id) REFERENCES seat(seat_id)
);

CREATE TABLE payment (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(50),
    amount_paid DECIMAL(10,2),
    payment_status ENUM('success','failed','pending'),
    transaction_ref VARCHAR(100),
    FOREIGN KEY (booking_id) REFERENCES booking(booking_id) ON DELETE CASCADE
);

CREATE TABLE cancellation (
    cancellation_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT,
    cancellation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    refund_amount DECIMAL(10,2),
    cancellation_reason TEXT,
    refund_status ENUM('processed','pending'),
    FOREIGN KEY (booking_id) REFERENCES booking(booking_id) ON DELETE CASCADE
);

CREATE PROCEDURE proc_add_passenger (
    IN p_booking_id INT,
    IN p_passenger_id INT,
    IN p_seat_id INT,
    IN p_fare DECIMAL(10,2)
)
BEGIN
    DECLARE sched_id INT;
    DECLARE remaining INT;

    SELECT schedule_id INTO sched_id
    FROM booking
    WHERE booking_id = p_booking_id;

    SELECT seats_remaining INTO remaining
    FROM schedule
    WHERE schedule_id = sched_id;

    IF remaining <= 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No seats remaining';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM booking_passenger bp
        JOIN booking b ON bp.booking_id = b.booking_id
        WHERE bp.seat_id = p_seat_id
        AND b.schedule_id = sched_id
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Seat already booked';
    END IF;

    INSERT INTO booking_passenger (booking_id, passenger_id, seat_id, fare)
    VALUES (p_booking_id, p_passenger_id, p_seat_id, p_fare);

    UPDATE schedule
    SET seats_remaining = seats_remaining - 1
    WHERE schedule_id = sched_id;

    UPDATE booking
    SET total_amount = (
        SELECT SUM(fare)
        FROM booking_passenger
        WHERE booking_id = p_booking_id
    )
    WHERE booking_id = p_booking_id;
END //

CREATE PROCEDURE proc_remove_passenger (
    IN p_booking_id INT,
    IN p_passenger_id INT
)
BEGIN
    DECLARE sched_id INT;

    SELECT schedule_id INTO sched_id
    FROM booking
    WHERE booking_id = p_booking_id;

    DELETE FROM booking_passenger
    WHERE booking_id = p_booking_id
    AND passenger_id = p_passenger_id;

    UPDATE schedule
    SET seats_remaining = seats_remaining + 1
    WHERE schedule_id = sched_id;

    UPDATE booking
    SET total_amount = (
        SELECT IFNULL(SUM(fare), 0)
        FROM booking_passenger
        WHERE booking_id = p_booking_id
    )
    WHERE booking_id = p_booking_id;
END //

CREATE PROCEDURE proc_update_booking_total (
    IN p_booking_id INT
)
BEGIN
    UPDATE booking
    SET total_amount = (
        SELECT IFNULL(SUM(fare), 0)
        FROM booking_passenger
        WHERE booking_id = p_booking_id
    )
    WHERE booking_id = p_booking_id;
END //

CREATE PROCEDURE proc_update_schedule_status (
    IN p_schedule_id INT
)
BEGIN
    DECLARE remaining INT;

    SELECT seats_remaining INTO remaining
    FROM schedule
    WHERE schedule_id = p_schedule_id;

    IF remaining = 0 THEN
        UPDATE schedule
        SET status = 'full'
        WHERE schedule_id = p_schedule_id;
    END IF;
END //

CREATE PROCEDURE proc_cleanup_route (
    IN p_route_id INT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM route_stop WHERE route_id = p_route_id
    ) THEN
        DELETE FROM route WHERE route_id = p_route_id;
    END IF;
END //

CREATE PROCEDURE proc_create_booking (
    IN p_user_id INT,
    IN p_schedule_id INT,
    IN p_boarding_loc INT,
    IN p_dropping_loc INT
)
BEGIN
    INSERT INTO booking (
        user_id, schedule_id, boarding_location_id,
        dropping_location_id, pnr_number,
        booking_status, total_amount
    )
    VALUES (
        p_user_id, p_schedule_id, p_boarding_loc,
        p_dropping_loc, UUID(),
        'pending', 0
    );

    SELECT LAST_INSERT_ID() AS booking_id;
END //

CREATE PROCEDURE proc_confirm_booking (
    IN p_booking_id INT
)
BEGIN
    UPDATE booking
    SET booking_status = 'confirmed'
    WHERE booking_id = p_booking_id;
END //

CREATE PROCEDURE proc_cancel_booking (
    IN p_booking_id INT
)
BEGIN
    DECLARE sched_id INT;
    DECLARE seat_count INT;

    SELECT schedule_id INTO sched_id
    FROM booking
    WHERE booking_id = p_booking_id;

    SELECT COUNT(*) INTO seat_count
    FROM booking_passenger
    WHERE booking_id = p_booking_id;

    UPDATE schedule
    SET seats_remaining = seats_remaining + seat_count
    WHERE schedule_id = sched_id;

    UPDATE booking
    SET booking_status = 'cancelled'
    WHERE booking_id = p_booking_id;

    INSERT INTO cancellation (booking_id, refund_amount, refund_status)
    VALUES (p_booking_id, 0, 'pending');
END //

CREATE PROCEDURE proc_search_schedules (
    IN p_start INT,
    IN p_end INT,
    IN p_date DATE
)
BEGIN
    SELECT s.*, r.route_name, v.vehicle_name
    FROM schedule s
    JOIN route r ON s.route_id = r.route_id
    JOIN vehicle v ON s.vehicle_id = v.vehicle_id
    JOIN route_stop rs1 ON r.route_id = rs1.route_id
    JOIN route_stop rs2 ON r.route_id = rs2.route_id
    WHERE rs1.location_id = p_start
      AND rs2.location_id = p_end
      AND rs1.stop_sequence < rs2.stop_sequence
      AND DATE(s.departure_datetime) = p_date;
END //

CREATE PROCEDURE proc_get_available_seats (
    IN p_schedule_id INT
)
BEGIN
    SELECT s.seat_id, s.seat_number
    FROM seat s
    WHERE s.vehicle_id = (
        SELECT vehicle_id FROM schedule WHERE schedule_id = p_schedule_id
    )
    AND s.seat_id NOT IN (
        SELECT bp.seat_id
        FROM booking_passenger bp
        JOIN booking b ON bp.booking_id = b.booking_id
        WHERE b.schedule_id = p_schedule_id
    );
END //

CREATE PROCEDURE proc_get_user_bookings (
    IN p_user_id INT
)
BEGIN
    SELECT b.booking_id, b.pnr_number, b.booking_status,
           s.departure_datetime, r.route_name
    FROM booking b
    JOIN schedule s ON b.schedule_id = s.schedule_id
    JOIN route r ON s.route_id = r.route_id
    WHERE b.user_id = p_user_id;
END //