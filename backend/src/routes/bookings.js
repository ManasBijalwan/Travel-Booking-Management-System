const express  = require("express");
const oracledb = require("oracledb");
const { execute, getConnection, fetchCursor } = require("../db");
const { authenticate, requireUser } = require("../middleware/auth");

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIso(dt) {
  if (!dt) return null;
  const d = dt instanceof Date ? dt : new Date(dt);
  return d.toISOString();
}

function toDatePart(dt) {
  return toIso(dt)?.slice(0, 10) ?? "";
}

function toTimePart(dt) {
  if (!dt) return "";
  const d = dt instanceof Date ? dt : new Date(dt);
  return d.toTimeString().slice(0, 5);
}

function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

function oraError(err) {
  if (err.message?.includes("ORA-20")) {
    const match = err.message.match(/ORA-\d+: (.+?)(\n|$)/);
    if (match) return match[1].trim();
  }
  return null;
}

// ─── POST /api/bookings ───────────────────────────────────────────────────────
// Calls: upsert_vehicle (proc) to insert passenger, then direct booking insert
// New schema: booking_status defaults to 'Confirmed', payment_status='Paid'
router.post("/", authenticate, requireUser, async (req, res) => {
  const {
    userId,
    travelId,
    boardingLocationId,
    droppingLocationId,
    passengers,
    totalAmount,
    payment,
  } = req.body;

  if (!passengers?.length) {
    return res.status(400).json({ error: "At least one passenger is required." });
  }

  let conn;
  try {
    conn = await getConnection();

    // Check seats
    const schedRes = await conn.execute(
      `SELECT seats_remaining FROM schedule WHERE schedule_id = :sid AND status = 'active'`,
      { sid: Number(travelId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!schedRes.rows[0]) return res.status(404).json({ error: "Schedule not found or inactive." });
    if (Number(schedRes.rows[0].SEATS_REMAINING) < passengers.length) {
      return res.status(400).json({ error: "Not enough seats remaining." });
    }

    // Generate PNR
    const pnr = `PNR${Date.now()}${String(userId).slice(-4).padStart(4, "0")}`;
    const farePerSeat = Math.round((Number(totalAmount) / passengers.length) * 100) / 100;

    // Insert booking (new schema: status='Confirmed' by default)
    const bookRes = await conn.execute(
      `INSERT INTO booking
         (user_id, schedule_id, boarding_location_id, dropping_location_id,
          pnr_number, total_amount, booking_status)
       VALUES (:uid, :sid, :board, :drop, :pnr, :amt, 'Confirmed')
       RETURNING booking_id INTO :bid`,
      {
        uid:   Number(userId),
        sid:   Number(travelId),
        board: Number(boardingLocationId),
        drop:  Number(droppingLocationId),
        pnr,
        amt:   Number(totalAmount),
        bid:   { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const bookingId = bookRes.outBinds.bid[0];

    // Insert each passenger and link to booking
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];

      const passRes = await conn.execute(
        `INSERT INTO passenger
           (user_id, passenger_name, age, gender, id_proof_type, id_proof_number)
         VALUES (:uid, :name, :age, :gender, :idType, :idNum)
         RETURNING passenger_id INTO :pid`,
        {
          uid:    Number(userId),
          name:   p.passenger_name,
          age:    Number(p.age),
          gender: (p.gender || "Male").toLowerCase(),
          idType: p.id_proof_type  || "Self Declared",
          idNum:  p.id_proof_number || "",
          pid:    { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const passengerId = passRes.outBinds.pid[0];

      // Link passenger to booking (seat_number can be auto or sequential)
      const seatLabel = `${String.fromCharCode(65 + Math.floor(i / 4))}${(i % 4) + 1}`;
      await conn.execute(
        `INSERT INTO booking_passenger (booking_id, passenger_id, seat_number, fare)
         VALUES (:bid, :pid, :seat, :fare)`,
        { bid: bookingId, pid: passengerId, seat: seatLabel, fare: farePerSeat }
      );
    }

    // Decrement seats
    await conn.execute(
      `UPDATE schedule SET seats_remaining = seats_remaining - :cnt WHERE schedule_id = :sid`,
      { cnt: passengers.length, sid: Number(travelId) }
    );

    // Insert payment (new schema: payment_status='Paid' by default)
    const txRef = `TXN${Date.now()}${String(bookingId).padStart(6, "0")}`;
    await conn.execute(
      `INSERT INTO payment (booking_id, payment_method, amount_paid, payment_status, transaction_ref)
       VALUES (:bid, :method, :amt, 'Paid', :txref)`,
      {
        bid:    bookingId,
        method: payment?.method || "Card",
        amt:    Number(totalAmount),
        txref:  txRef,
      }
    );

    // Insert cancellation record seeded as initiated (for future use)
    // (not needed at booking time — only on cancel)

    await conn.commit();

    // Fetch booking for response
    const bookQuery = await conn.execute(
      `SELECT b.booking_id, b.pnr_number, b.booking_status, b.total_amount, b.booking_date,
              s.departure_datetime, s.arrival_datetime,
              r.route_name, tm.mode_name,
              l1.location_name AS boarding_location,
              l2.location_name AS dropping_location
         FROM booking b
         JOIN schedule s     ON b.schedule_id          = s.schedule_id
         JOIN route r        ON s.route_id             = r.route_id
         JOIN travel_mode tm ON r.mode_id              = tm.mode_id
         JOIN location l1    ON b.boarding_location_id = l1.location_id
         JOIN location l2    ON b.dropping_location_id = l2.location_id
        WHERE b.booking_id = :id`,
      { id: bookingId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const row = bookQuery.rows[0];

    return res.status(201).json({
      id:               bookingId,
      booking_id:       bookingId,
      pnr:              row.PNR_NUMBER,
      status:           row.BOOKING_STATUS,
      totalAmount:      Number(row.TOTAL_AMOUNT),
      totalAmountLabel: formatCurrency(row.TOTAL_AMOUNT),
      paymentStatus:    "Paid",
      transactionRef:   txRef,
      passengers,
      travel: {
        name:          row.ROUTE_NAME,
        type:          row.MODE_NAME,
        origin:        row.BOARDING_LOCATION,
        destination:   row.DROPPING_LOCATION,
        departureDate: toDatePart(row.DEPARTURE_DATETIME),
        departureTime: toTimePart(row.DEPARTURE_DATETIME),
        departureDateTime: toIso(row.DEPARTURE_DATETIME),
        arrivalDateTime:   toIso(row.ARRIVAL_DATETIME),
        arrivalTime:   toTimePart(row.ARRIVAL_DATETIME),
      },
    });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch (_) {}
    console.error("Create booking error:", err);
    return res.status(400).json({ error: oraError(err) || "Booking failed." });
  } finally {
    if (conn) try { await conn.close(); } catch (_) {}
  }
});

// ─── GET /api/bookings/user/:userId ──────────────────────────────────────────
// Uses proc_get_user_bookings (SYS_REFCURSOR)
router.get("/user/:userId", authenticate, async (req, res) => {
  if (req.user.role !== "admin" && String(req.user.id) !== req.params.userId) {
    return res.status(403).json({ error: "Access denied." });
  }
  const uid = Number(req.params.userId);
  let conn;
  try {
    conn = await getConnection();

    const procResult = await conn.execute(
      `BEGIN proc_get_user_bookings(:uid, :cur); END;`,
      { uid, cur: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR } },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const bookingRows = await fetchCursor(procResult.outBinds.cur);

    const bookings = await Promise.all(
      bookingRows.map(async (row) => {
        const [passResult, payResult, cancelResult] = await Promise.all([
          conn.execute(
            `SELECT p.passenger_name, p.age, p.gender, p.id_proof_number, bp.seat_number
               FROM booking_passenger bp
               JOIN passenger p ON bp.passenger_id = p.passenger_id
              WHERE bp.booking_id = :bid`,
            { bid: row.BOOKING_ID },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
          ),
          conn.execute(
            `SELECT payment_status, amount_paid FROM payment
              WHERE booking_id = :bid AND ROWNUM = 1`,
            { bid: row.BOOKING_ID },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
          ),
          conn.execute(
            `SELECT refund_amount, refund_status, cancellation_reason, cancellation_date
               FROM cancellation WHERE booking_id = :bid AND ROWNUM = 1`,
            { bid: row.BOOKING_ID },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
          ),
        ]);

        const passengers = passResult.rows.map(p => ({
          passenger_name:  p.PASSENGER_NAME,
          fullName:        p.PASSENGER_NAME,
          age:             p.AGE,
          gender:          p.GENDER,
          id_proof_number: p.ID_PROOF_NUMBER,
        }));
        const seats      = passResult.rows.map(p => p.SEAT_NUMBER);
        const payStatus  = payResult.rows[0]?.PAYMENT_STATUS || "Paid";
        const cancel     = cancelResult.rows[0];

        // Intermediate stops for this booking's route
        const stopRes = await conn.execute(
          `SELECT rs.location_id, rs.arrival_datetime, rs.departure_datetime,
                  l.location_name, l.city
             FROM route_stop rs
             JOIN location l ON rs.location_id = l.location_id
            WHERE rs.route_id = (SELECT route_id FROM schedule WHERE schedule_id = :sid)
            ORDER BY rs.stop_sequence`,
          { sid: row.SCHEDULE_ID || 0 },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return {
          id:               row.BOOKING_ID,
          booking_id:       row.BOOKING_ID,
          pnr:              row.PNR_NUMBER,
          status:           row.BOOKING_STATUS,
          bookedAt:         toIso(row.BOOKING_DATE),
          totalAmount:      Number(row.TOTAL_AMOUNT),
          totalAmountLabel: formatCurrency(row.TOTAL_AMOUNT),
          paymentStatus:    payStatus,
          passengers,
          selectedSeats:    seats,
          cancellation:     cancel ? {
            refundAmount:     Number(cancel.REFUND_AMOUNT),
            refundAmountLabel: formatCurrency(cancel.REFUND_AMOUNT),
            refundStatus:     cancel.REFUND_STATUS,
            reason:           cancel.CANCELLATION_REASON,
            cancellationDate: toIso(cancel.CANCELLATION_DATE),
          } : null,
          travel: {
            name:              row.ROUTE_NAME,
            type:              row.MODE_NAME,
            origin:            row.BOARDING_LOCATION,
            destination:       row.DROPPING_LOCATION,
            departureDate:     toDatePart(row.DEPARTURE_DATETIME),
            departureTime:     toTimePart(row.DEPARTURE_DATETIME),
            departureDateTime: toIso(row.DEPARTURE_DATETIME),
            arrivalDate:       toDatePart(row.ARRIVAL_DATETIME),
            arrivalTime:       toTimePart(row.ARRIVAL_DATETIME),
            arrivalDateTime:   toIso(row.ARRIVAL_DATETIME),
            intermediateStops: stopRes.rows.map(s => ({
              location_id:       s.LOCATION_ID,
              location_name:     s.LOCATION_NAME,
              city:              s.CITY,
              arrivalDateTime:   toIso(s.ARRIVAL_DATETIME),
              departureDateTime: toIso(s.DEPARTURE_DATETIME),
            })),
          },
        };
      })
    );

    return res.json(bookings);
  } catch (err) {
    console.error("Get user bookings error:", err);
    return res.status(500).json({ error: "Failed to load bookings." });
  } finally {
    if (conn) try { await conn.close(); } catch (_) {}
  }
});

// ─── GET /api/bookings/user/:userId/cancellations ─────────────────────────────
router.get("/user/:userId/cancellations", authenticate, async (req, res) => {
  if (req.user.role !== "admin" && String(req.user.id) !== req.params.userId) {
    return res.status(403).json({ error: "Access denied." });
  }
  try {
    const result = await execute(
      `SELECT c.cancellation_id, c.booking_id, c.cancellation_date,
              c.refund_amount, c.cancellation_reason, c.refund_status,
              b.pnr_number,
              l1.city AS origin_city, l2.city AS dest_city,
              r.route_name, s.departure_datetime
         FROM cancellation c
         JOIN booking b    ON c.booking_id           = b.booking_id
         JOIN schedule s   ON b.schedule_id           = s.schedule_id
         JOIN route r      ON s.route_id              = r.route_id
         JOIN location l1  ON b.boarding_location_id  = l1.location_id
         JOIN location l2  ON b.dropping_location_id  = l2.location_id
        WHERE b.user_id = :uid
        ORDER BY c.cancellation_date DESC`,
      { uid: Number(req.params.userId) }
    );
    return res.json(result.rows.map(r => ({
      id:               r.CANCELLATION_ID,
      bookingId:        r.BOOKING_ID,
      cancellationDate: toIso(r.CANCELLATION_DATE),
      refundAmount:     Number(r.REFUND_AMOUNT),
      refundAmountLabel: formatCurrency(r.REFUND_AMOUNT),
      reason:           r.CANCELLATION_REASON,
      refundStatus:     r.REFUND_STATUS,
      pnr:              r.PNR_NUMBER,
      travelName:       r.ROUTE_NAME,
      route:            `${r.ORIGIN_CITY} to ${r.DEST_CITY}`,
      journeyDate:      toDatePart(r.DEPARTURE_DATETIME),
    })));
  } catch (err) {
    console.error("Get cancellations error:", err);
    return res.status(500).json({ error: "Failed to load cancellations." });
  }
});

// ─── PATCH /api/bookings/:id/cancel ──────────────────────────────────────────
router.patch("/:id/cancel", authenticate, async (req, res) => {
  const bookingId = Number(req.params.id);
  let conn;
  try {
    conn = await getConnection();

    const ownResult = await conn.execute(
      `SELECT user_id, booking_status FROM booking WHERE booking_id = :id`,
      { id: bookingId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!ownResult.rows[0]) return res.status(404).json({ error: "Booking not found." });
    if (req.user.role !== "admin" && String(ownResult.rows[0].USER_ID) !== String(req.user.id)) {
      return res.status(403).json({ error: "Access denied." });
    }
    if (ownResult.rows[0].BOOKING_STATUS === "Cancelled") {
      return res.status(400).json({ error: "Booking is already cancelled." });
    }

    // Use stored procedure for cancellation
    const cancelResult = await conn.execute(
      `BEGIN proc_cancel_booking(:bookId, :reason, :refund); END;`,
      {
        bookId: bookingId,
        reason: req.body.reason || "User requested",
        refund: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    await conn.commit();

    return res.json({
      success:           true,
      bookingId,
      refundAmount:      cancelResult.outBinds.refund,
      refundAmountLabel: formatCurrency(cancelResult.outBinds.refund),
    });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch (_) {}
    console.error("Cancel booking error:", err);
    return res.status(400).json({ error: oraError(err) || "Cancellation failed." });
  } finally {
    if (conn) try { await conn.close(); } catch (_) {}
  }
});

module.exports = router;
