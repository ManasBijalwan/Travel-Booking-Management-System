const express = require("express");
const oracledb = require("oracledb");
const { execute, getConnection, fetchCursor } = require("../db");
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
  if (err.message && err.message.includes("ORA-20")) {
    const match = err.message.match(/ORA-\d+: (.+?)(\n|$)/);
    if (match) return match[1].trim();
  }
  return null;
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
    conn = await getConnection();

    // ── Step 1: Create booking (pending, amount = 0) ──────────────────────
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

    // ── Step 2: For each passenger — insert then proc_add_passenger ────────
    const farePerSeat = Math.round((Number(totalAmount) / passengers.length) * 100) / 100;

    for (let i = 0; i < passengers.length; i++) {
      const p   = passengers[i];
      const seat = selectedSeats[i];

      // Insert passenger row, get back passenger_id
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
          idType: p.id_proof_type  || "Self Declared",
          idNum:  p.id_proof_number || "",
          pid:    { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const passengerId = passResult.outBinds.pid[0];

      // Link to booking — also decrements seats_remaining in SCHEDULE
      await conn.execute(
        `BEGIN proc_add_passenger(:bookId, :passId, :seat, :fare); END;`,
        {
          bookId: bookingId,
          passId: passengerId,
          seat,
          fare:   farePerSeat,
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
    }

    // ── Step 3: Process payment — also sets booking_status = 'confirmed' ──
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

    // ── Step 4: Fetch booking summary using fn_user_booking_count ──────────
    // (demonstrates function usage — gives total booking count for the user)
    const countRes = await conn.execute(
      `SELECT fn_user_booking_count(:uid) AS total_bookings FROM DUAL`,
      { uid: Number(userId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const totalBookings = countRes.rows[0]?.TOTAL_BOOKINGS;

    // Fetch the created booking for response
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

    return res.status(201).json({
      id:               bookingId,
      booking_id:       bookingId,
      pnr:              row.PNR_NUMBER,
      status:           row.BOOKING_STATUS,
      totalAmount:      Number(row.TOTAL_AMOUNT),
      totalAmountLabel: formatCurrency(row.TOTAL_AMOUNT),
      paymentStatus:    "Paid",
      transactionRef,
      passengers,
      selectedSeats,
      userTotalBookings: totalBookings,
      travel: {
        name:          row.ROUTE_NAME,
        type:          row.MODE_NAME,
        origin:        row.BOARDING_LOCATION,
        destination:   row.DROPPING_LOCATION,
        departureDate: toDatePart(row.DEPARTURE_DATETIME),
        departureTime: toTimePart(row.DEPARTURE_DATETIME),
        arrivalTime:   toTimePart(row.ARRIVAL_DATETIME),
      },
    });
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
// Uses proc_get_user_bookings (SYS_REFCURSOR) for the history list
router.get("/user/:userId", authenticate, async (req, res) => {
  if (req.user.role !== "admin" && String(req.user.id) !== req.params.userId) {
    return res.status(403).json({ error: "Access denied." });
  }

  const uid = Number(req.params.userId);
  let conn;
  try {
    conn = await getConnection();

    // ── Call proc_get_user_bookings — returns SYS_REFCURSOR ───────────────
    const procResult = await conn.execute(
      `BEGIN proc_get_user_bookings(:uid, :cur); END;`,
      {
        uid: uid,
        cur: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const bookingRows = await fetchCursor(procResult.outBinds.cur);

    // ── For each booking, fetch passengers + seats + payment status ────────
    const bookings = await Promise.all(
      bookingRows.map(async (row) => {
        const [passResult, payResult] = await Promise.all([
          conn.execute(
            `SELECT p.passenger_name, p.age, p.gender,
                    p.id_proof_number, bp.seat_number
               FROM BOOKING_PASSENGER bp
               JOIN PASSENGER p ON bp.passenger_id = p.passenger_id
              WHERE bp.booking_id = :bid`,
            { bid: row.BOOKING_ID },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
          ),
          conn.execute(
            `SELECT payment_status FROM PAYMENT
              WHERE booking_id = :bid AND ROWNUM = 1`,
            { bid: row.BOOKING_ID },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
          ),
        ]);

        const passengers = passResult.rows.map((p) => ({
          passenger_name:  p.PASSENGER_NAME,
          age:             p.AGE,
          gender:          p.GENDER,
          id_proof_number: p.ID_PROOF_NUMBER,
        }));
        const seats     = passResult.rows.map((p) => p.SEAT_NUMBER);
        const payStatus = payResult.rows[0]?.PAYMENT_STATUS || "Pending";

        return {
          id:               row.BOOKING_ID,
          booking_id:       row.BOOKING_ID,
          pnr:              row.PNR_NUMBER,
          status:           row.BOOKING_STATUS,
          bookedAt:         row.BOOKING_DATE,
          totalAmount:      Number(row.TOTAL_AMOUNT),
          totalAmountLabel: formatCurrency(row.TOTAL_AMOUNT),
          paymentStatus:    payStatus,
          passengers,
          selectedSeats:    seats,
          travel: {
            name:          row.ROUTE_NAME,
            type:          row.MODE_NAME,
            origin:        row.BOARDING_LOCATION,
            destination:   row.DROPPING_LOCATION,
            departureDate: toDatePart(row.DEPARTURE_DATETIME),
            departureTime: toTimePart(row.DEPARTURE_DATETIME),
            arrivalTime:   toTimePart(row.ARRIVAL_DATETIME),
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

// ─── PATCH /api/bookings/:id/cancel ──────────────────────────────────────────
// Uses proc_cancel_booking (handles refund calc + cancellation record)
router.patch("/:id/cancel", authenticate, async (req, res) => {
  const bookingId = Number(req.params.id);
  let conn;
  try {
    conn = await getConnection();

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

    // ── Call proc_cancel_booking ───────────────────────────────────────────
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
    const friendly = oraError(err);
    return res.status(400).json({ error: friendly || "Cancellation failed." });
  } finally {
    if (conn) try { await conn.close(); } catch (_) {}
  }
});

module.exports = router;
