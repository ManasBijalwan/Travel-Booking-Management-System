const express = require("express");
const oracledb = require("oracledb");
const { execute, getConnection } = require("../db");
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

function oraError(err) {
  // Extract the human-readable part from Oracle application errors
  // e.g. "ORA-20110: No seats remaining..." → "No seats remaining..."
  if (err.message && err.message.includes("ORA-20")) {
    const match = err.message.match(/ORA-\d+: (.+?)(\n|$)/);
    if (match) return match[1].trim();
  }
  return null;
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
// Flow: proc_create_booking → INSERT PASSENGER + proc_add_passenger (×N)
//       → proc_process_payment (confirms booking + records payment)
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
    conn = await getConnection();

    // ── Step 1: Create booking (status = pending, amount = 0) ─────────────────
    const createResult = await conn.execute(
      `BEGIN proc_create_booking(:userId, :schedId, :boardLoc, :dropLoc, :bookId); END;`,
      {
        userId:   Number(userId),
        schedId:  Number(travelId),
        boardLoc: Number(boardingLocationId),
        dropLoc:  Number(droppingLocationId),
        bookId:   { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const bookingId = createResult.outBinds.bookId;

    // ── Step 2: Insert each passenger and link to booking ─────────────────────
    const farePerSeat = Number(totalAmount) / passengers.length;

    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      const seat = selectedSeats[i];

      // Insert passenger record
      const passResult = await conn.execute(
        `INSERT INTO PASSENGER
           (user_id, passenger_name, age, gender, id_proof_type, id_proof_number)
         VALUES (:uid, :name, :age, :gender, :idType, :idNum)
         RETURNING passenger_id INTO :pid`,
        {
          uid:    Number(userId),
          name:   p.passenger_name,
          age:    Number(p.age),
          gender: (p.gender || "Male").toLowerCase(),
          idType: p.id_proof_type || "Self Declared",
          idNum:  p.id_proof_number || "",
          pid:    { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const passengerId = passResult.outBinds.pid[0];

      // Link passenger to booking (also decrements seats_remaining)
      await conn.execute(
        `BEGIN proc_add_passenger(:bookId, :passId, :seat, :fare); END;`,
        {
          bookId: bookingId,
          passId: passengerId,
          seat,
          fare:   Math.round(farePerSeat * 100) / 100,
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
    }

    // ── Step 3: Process payment → also confirms booking ───────────────────────
    const payResult = await conn.execute(
      `BEGIN proc_process_payment(:bookId, :method, :txRef); END;`,
      {
        bookId: bookingId,
        method: payment?.method || "Card",
        txRef:  { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 100 },
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const transactionRef = payResult.outBinds.txRef;

    await conn.commit();

    // ── Step 4: Fetch full booking view to return ─────────────────────────────
    const bookQuery = await conn.execute(
      `SELECT b.booking_id, b.pnr_number, b.booking_status,
              b.total_amount, b.booking_date,
              s.departure_datetime, s.arrival_datetime,
              r.route_name, tm.mode_name,
              l1.location_name AS boarding_location,
              l2.location_name AS dropping_location
         FROM BOOKING b
         JOIN SCHEDULE s     ON b.schedule_id          = s.schedule_id
         JOIN ROUTE r        ON s.route_id             = r.route_id
         JOIN TRAVEL_MODE tm ON r.mode_id              = tm.mode_id
         JOIN LOCATION l1    ON b.boarding_location_id = l1.location_id
         JOIN LOCATION l2    ON b.dropping_location_id = l2.location_id
        WHERE b.booking_id = :id`,
      { id: bookingId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const row = bookQuery.rows[0];
    const booking = mapBookingRow(row, passengers, selectedSeats, "Paid");
    booking.transactionRef = transactionRef;

    return res.status(201).json(booking);
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch (_) {}
    console.error("Create booking error:", err);
    const friendly = oraError(err);
    return res.status(400).json({ error: friendly || "Booking failed. Please try again." });
  } finally {
    if (conn) try { await conn.close(); } catch (_) {}
  }
});

// ─── GET /api/bookings/user/:userId ──────────────────────────────────────────
router.get("/user/:userId", authenticate, async (req, res) => {
  // Users can only see their own; admins can see anyone's
  if (req.user.role !== "admin" && String(req.user.id) !== req.params.userId) {
    return res.status(403).json({ error: "Access denied." });
  }

  try {
    const bookingsResult = await execute(
      `SELECT b.booking_id, b.pnr_number, b.booking_status,
              b.total_amount, b.booking_date,
              s.departure_datetime, s.arrival_datetime,
              r.route_name, tm.mode_name,
              l1.location_name AS boarding_location,
              l2.location_name AS dropping_location
         FROM BOOKING b
         JOIN SCHEDULE s     ON b.schedule_id          = s.schedule_id
         JOIN ROUTE r        ON s.route_id             = r.route_id
         JOIN TRAVEL_MODE tm ON r.mode_id              = tm.mode_id
         JOIN LOCATION l1    ON b.boarding_location_id = l1.location_id
         JOIN LOCATION l2    ON b.dropping_location_id = l2.location_id
        WHERE b.user_id = :uid
        ORDER BY b.booking_date DESC`,
      { uid: Number(req.params.userId) }
    );

    const bookings = await Promise.all(
      bookingsResult.rows.map(async (row) => {
        const [passResult, payResult] = await Promise.all([
          execute(
            `SELECT p.passenger_name, p.age, p.gender, p.id_proof_number,
                    bp.seat_number
               FROM BOOKING_PASSENGER bp
               JOIN PASSENGER p ON bp.passenger_id = p.passenger_id
              WHERE bp.booking_id = :bid`,
            { bid: row.BOOKING_ID }
          ),
          execute(
            `SELECT payment_status FROM PAYMENT
              WHERE booking_id = :bid AND ROWNUM = 1`,
            { bid: row.BOOKING_ID }
          ),
        ]);

        const passengers = passResult.rows.map((p) => ({
          passenger_name:  p.PASSENGER_NAME,
          age:             p.AGE,
          gender:          p.GENDER,
          id_proof_number: p.ID_PROOF_NUMBER,
        }));
        const seats = passResult.rows.map((p) => p.SEAT_NUMBER);
        const payStatus = payResult.rows[0]?.PAYMENT_STATUS || "Pending";

        return mapBookingRow(row, passengers, seats, payStatus);
      })
    );

    return res.json(bookings);
  } catch (err) {
    console.error("Get user bookings error:", err);
    return res.status(500).json({ error: "Failed to load bookings." });
  }
});

// ─── PATCH /api/bookings/:id/cancel ──────────────────────────────────────────
router.patch("/:id/cancel", authenticate, async (req, res) => {
  const bookingId = Number(req.params.id);
  let conn;
  try {
    conn = await getConnection();

    // Verify booking exists and check ownership
    const ownResult = await conn.execute(
      `SELECT user_id, booking_status FROM BOOKING WHERE booking_id = :id`,
      { id: bookingId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!ownResult.rows[0]) {
      return res.status(404).json({ error: "Booking not found." });
    }
    if (
      req.user.role !== "admin" &&
      String(ownResult.rows[0].USER_ID) !== String(req.user.id)
    ) {
      return res.status(403).json({ error: "Access denied." });
    }
    if (ownResult.rows[0].BOOKING_STATUS === "cancelled") {
      return res.status(400).json({ error: "Booking is already cancelled." });
    }

    // Call the cancel procedure
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
      success: true,
      bookingId,
      refundAmount: cancelResult.outBinds.refund,
      refundAmountLabel: formatCurrency(cancelResult.outBinds.refund),
    });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch (_) {}
    console.error("Cancel booking error:", err);
    const friendly = oraError(err);
    return res.status(400).json({ error: friendly || "Cancellation failed." });
  } finally {
    if (conn) try { await conn.close(); } catch (_) {}
  }
});

module.exports = router;
