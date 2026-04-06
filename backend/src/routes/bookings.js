const express = require("express");
const oracledb = require("oracledb");
const { execute } = require("../db");
const { authenticate, requireUser } = require("../middleware/auth");

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDatePart(dt) {
  if (!dt) return "";
  const d = dt instanceof Date ? dt : new Date(dt);
  return d.toISOString().slice(0, 10);
}

function toTimePart(dt) {
  if (!dt) return "";
  const d = dt instanceof Date ? dt : new Date(dt);
  return d.toTimeString().slice(0, 5);
}

function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

function mapBookingRow(row, passengers = [], seats = [], paymentStatus = "Pending") {
  return {
    id: row.BOOKING_ID,
    booking_id: row.BOOKING_ID,
    pnr: row.PNR_NUMBER,
    status: row.BOOKING_STATUS,
    bookedAt: row.BOOKING_DATE,
    totalAmount: Number(row.TOTAL_AMOUNT),
    totalAmountLabel: formatCurrency(row.TOTAL_AMOUNT),
    paymentStatus,
    passengers,
    selectedSeats: seats,
    travel: {
      name: row.ROUTE_NAME,
      type: row.MODE_NAME,
      origin: row.BOARDING_LOCATION,
      destination: row.DROPPING_LOCATION,
      departureDate: toDatePart(row.DEPARTURE_DATETIME),
      departureTime: toTimePart(row.DEPARTURE_DATETIME),
      arrivalTime: toTimePart(row.ARRIVAL_DATETIME),
    },
  };
}

// ─── POST /api/bookings ───────────────────────────────────────────────────────
// Calls: proc_create_booking → proc_add_passenger (×N) → proc_process_payment
router.post("/", authenticate, requireUser, async (req, res) => {
  const {
    userId,
    travelId,
    boardingLocationId,
    droppingLocationId,
    passengers,
    selectedSeats,
    totalAmount,
    payment,
  } = req.body;

  if (!passengers?.length || !selectedSeats?.length) {
    return res.status(400).json({ error: "Passengers and seats are required." });
  }
  if (passengers.length !== selectedSeats.length) {
    return res.status(400).json({ error: "Passenger count must match seat count." });
  }

  let conn;
  try {
    const oracledb = require("oracledb");
    const pool = require("../db");
    conn = await (await require("../db").executeWithConn("SELECT 1 FROM DUAL", {})).conn;
    // We use a direct connection here to run the full transaction in sequence

    // Re-get connection properly
    conn = await (require("oracledb").getPool()).getConnection();

    // 1) Create booking (pending)
    const bookingResult = await conn.execute(
      `BEGIN proc_create_booking(:userId, :schedId, :boardLoc, :dropLoc, :bookId); END;`,
      {
        userId: Number(userId),
        schedId: Number(travelId),
        boardLoc: Number(boardingLocationId),
        dropLoc: Number(droppingLocationId),
        bookId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      }
    );
    const bookingId = bookingResult.outBinds.bookId;

    // 2) Insert passengers and add to booking
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      const seat = selectedSeats[i];

      // Insert into PASSENGER table
      const passResult = await conn.execute(
        `INSERT INTO PASSENGER
           (user_id, passenger_name, age, gender, id_proof_type, id_proof_number)
         VALUES (:uid, :name, :age, :gender, :idType, :idNum)
         RETURNING passenger_id INTO :pid`,
        {
          uid: Number(userId),
          name: p.passenger_name,
          age: Number(p.age),
          gender: (p.gender || "Male").toLowerCase(),
          idType: p.id_proof_type || "Self Declared",
          idNum: p.id_proof_number || "",
          pid: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        }
      );
      const passengerId = passResult.outBinds.pid[0];

      // Link passenger to booking via proc_add_passenger
      await conn.execute(
        `BEGIN proc_add_passenger(:bookId, :passId, :seat, :fare); END;`,
        {
          bookId: bookingId,
          passId: passengerId,
          seat,
          fare: Number(payment ? totalAmount / passengers.length : 0),
        }
      );
    }

    // 3) Process payment — this also confirms the booking
    const payResult = await conn.execute(
      `BEGIN proc_process_payment(:bookId, :method, :txRef); END;`,
      {
        bookId: bookingId,
        method: payment?.method || "Card",
        txRef: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 100 },
      }
    );
    const txRef = payResult.outBinds.txRef;

    await conn.commit();

    // 4) Fetch the created booking to return full view
    const bookQuery = await conn.execute(
      `SELECT b.booking_id, b.pnr_number, b.booking_status,
              b.total_amount, b.booking_date,
              s.departure_datetime, s.arrival_datetime,
              r.route_name, tm.mode_name,
              l1.location_name AS boarding_location,
              l2.location_name AS dropping_location
         FROM BOOKING b
         JOIN SCHEDULE s    ON b.schedule_id          = s.schedule_id
         JOIN ROUTE r       ON s.route_id             = r.route_id
         JOIN TRAVEL_MODE tm ON r.mode_id             = tm.mode_id
         JOIN LOCATION l1   ON b.boarding_location_id = l1.location_id
         JOIN LOCATION l2   ON b.dropping_location_id = l2.location_id
        WHERE b.booking_id = :id`,
      { id: bookingId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const row = bookQuery.rows[0];
    const booking = mapBookingRow(row, passengers, selectedSeats, "Paid");
    booking.transactionRef = txRef;

    return res.status(201).json(booking);
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    console.error("Create booking error:", err);
    const msg = err.message?.includes("ORA-20")
      ? err.message.split("\n")[0].replace(/.*ORA-\d+: /, "")
      : "Booking failed.";
    return res.status(400).json({ error: msg });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (_) {}
    }
  }
});

// ─── GET /api/bookings/user/:userId ──────────────────────────────────────────
router.get("/user/:userId", authenticate, async (req, res) => {
  // Users can only see their own bookings; admins can see any
  if (req.user.role !== "admin" && req.user.id != req.params.userId) {
    return res.status(403).json({ error: "Access denied." });
  }
  try {
    // Fetch bookings
    const bookings = await execute(
      `SELECT b.booking_id, b.pnr_number, b.booking_status,
              b.total_amount, b.booking_date,
              s.departure_datetime, s.arrival_datetime,
              r.route_name, tm.mode_name,
              l1.location_name AS boarding_location,
              l2.location_name AS dropping_location
         FROM BOOKING b
         JOIN SCHEDULE s    ON b.schedule_id          = s.schedule_id
         JOIN ROUTE r       ON s.route_id             = r.route_id
         JOIN TRAVEL_MODE tm ON r.mode_id             = tm.mode_id
         JOIN LOCATION l1   ON b.boarding_location_id = l1.location_id
         JOIN LOCATION l2   ON b.dropping_location_id = l2.location_id
        WHERE b.user_id = :uid
        ORDER BY b.booking_date DESC`,
      { uid: Number(req.params.userId) }
    );

    // For each booking fetch passengers + seats + payment status
    const results = await Promise.all(
      bookings.rows.map(async (row) => {
        const [passResult, payResult] = await Promise.all([
          execute(
            `SELECT p.passenger_name, p.age, p.gender, p.id_proof_number, bp.seat_number
               FROM BOOKING_PASSENGER bp
               JOIN PASSENGER p ON bp.passenger_id = p.passenger_id
              WHERE bp.booking_id = :bid`,
            { bid: row.BOOKING_ID }
          ),
          execute(
            `SELECT payment_status FROM PAYMENT WHERE booking_id = :bid AND ROWNUM = 1`,
            { bid: row.BOOKING_ID }
          ),
        ]);

        const passengers = passResult.rows.map((p) => ({
          passenger_name: p.PASSENGER_NAME,
          age: p.AGE,
          gender: p.GENDER,
          id_proof_number: p.ID_PROOF_NUMBER,
        }));
        const seats = passResult.rows.map((p) => p.SEAT_NUMBER);
        const payStatus = payResult.rows[0]?.PAYMENT_STATUS || "Pending";
        return mapBookingRow(row, passengers, seats, payStatus);
      })
    );

    return res.json(results);
  } catch (err) {
    console.error("Get user bookings error:", err);
    return res.status(500).json({ error: "Failed to load bookings." });
  }
});

// ─── PATCH /api/bookings/:id/cancel ──────────────────────────────────────────
router.patch("/:id/cancel", authenticate, requireUser, async (req, res) => {
  const bookingId = Number(req.params.id);
  let conn;
  try {
    const oracledb = require("oracledb");
    conn = await (require("oracledb").getPool()).getConnection();

    // Verify ownership
    const own = await conn.execute(
      `SELECT user_id FROM BOOKING WHERE booking_id = :id`,
      { id: bookingId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!own.rows[0]) return res.status(404).json({ error: "Booking not found." });
    if (req.user.role !== "admin" && own.rows[0].USER_ID != req.user.id) {
      return res.status(403).json({ error: "Access denied." });
    }

    const cancelResult = await conn.execute(
      `BEGIN proc_cancel_booking(:bookId, :reason, :refund); END;`,
      {
        bookId: bookingId,
        reason: req.body.reason || "User requested",
        refund: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      }
    );
    await conn.commit();

    return res.json({
      success: true,
      bookingId,
      refundAmount: cancelResult.outBinds.refund,
    });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch (_) {}
    console.error("Cancel booking error:", err);
    const msg = err.message?.includes("ORA-20")
      ? err.message.split("\n")[0].replace(/.*ORA-\d+: /, "")
      : "Cancellation failed.";
    return res.status(400).json({ error: msg });
  } finally {
    if (conn) try { await conn.close(); } catch (_) {}
  }
});

module.exports = router;
