const express = require("express");
const oracledb = require("oracledb");
const { execute } = require("../db");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate, requireAdmin);

// ─── This file handles all remaining admin endpoints ─────────────────────────
// Mounted at /api/admin (alongside admin.js which handles overview + CRUD)

// GET /api/admin/bookings
router.get("/bookings", async (req, res) => {
  try {
    const result = await execute(
      `SELECT b.booking_id, b.pnr_number, b.booking_status,
              b.total_amount, b.booking_date,
              s.departure_datetime, s.arrival_datetime,
              r.route_name, tm.mode_name,
              l1.city AS boarding_city, l2.city AS dropping_city,
              u.full_name AS user_name
         FROM BOOKING b
         JOIN USERS u     ON b.user_id              = u.user_id
         JOIN SCHEDULE s  ON b.schedule_id           = s.schedule_id
         JOIN ROUTE r     ON s.route_id              = r.route_id
         JOIN TRAVEL_MODE tm ON r.mode_id            = tm.mode_id
         JOIN LOCATION l1 ON b.boarding_location_id  = l1.location_id
         JOIN LOCATION l2 ON b.dropping_location_id  = l2.location_id
        ORDER BY b.booking_date DESC`
    );

    const bookings = await Promise.all(result.rows.map(async (row) => {
      const passRes = await execute(
        `SELECT p.passenger_name, bp.seat_number
           FROM BOOKING_PASSENGER bp
           JOIN PASSENGER p ON bp.passenger_id = p.passenger_id
          WHERE bp.booking_id = :bid`,
        { bid: row.BOOKING_ID }
      );
      const payRes = await execute(
        `SELECT payment_status FROM PAYMENT WHERE booking_id = :bid AND ROWNUM = 1`,
        { bid: row.BOOKING_ID }
      );
      return {
        id: row.BOOKING_ID,
        pnr: row.PNR_NUMBER,
        status: row.BOOKING_STATUS,
        totalAmount: Number(row.TOTAL_AMOUNT),
        totalAmountLabel: `₹${Number(row.TOTAL_AMOUNT).toLocaleString("en-IN")}`,
        paymentStatus: payRes.rows[0]?.PAYMENT_STATUS || "Pending",
        userName: row.USER_NAME,
        passengers: passRes.rows.map((p) => ({ passenger_name: p.PASSENGER_NAME })),
        selectedSeats: passRes.rows.map((p) => p.SEAT_NUMBER),
        travel: {
          name: row.ROUTE_NAME,
          type: row.MODE_NAME,
          origin: row.BOARDING_CITY,
          destination: row.DROPPING_CITY,
        },
      };
    }));

    return res.json(bookings);
  } catch (err) {
    console.error("Admin bookings error:", err);
    return res.status(500).json({ error: "Failed to load bookings." });
  }
});

router.delete("/bookings/:id", async (req, res) => {
  try {
    // CASCADE constraints in DB handle booking_passenger, payment, cancellation
    await execute(
      `DELETE FROM BOOKING WHERE booking_id = :id`,
      { id: Number(req.params.id) },
      { autoCommit: true }
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete booking." });
  }
});

// GET /api/admin/payments
router.get("/payments", async (req, res) => {
  try {
    const result = await execute(
      `SELECT p.payment_id, p.booking_id, p.payment_method,
              p.payment_status, p.amount_paid, p.payment_date, p.transaction_ref
         FROM PAYMENT p
        ORDER BY p.payment_date DESC`
    );
    return res.json(result.rows.map((r) => ({
      id: r.PAYMENT_ID,
      bookingId: r.BOOKING_ID,
      method: r.PAYMENT_METHOD,
      status: r.PAYMENT_STATUS,
      amount: Number(r.AMOUNT_PAID),
      amountLabel: `₹${Number(r.AMOUNT_PAID).toLocaleString("en-IN")}`,
      date: r.PAYMENT_DATE,
      transactionRef: r.TRANSACTION_REF,
    })));
  } catch (err) {
    return res.status(500).json({ error: "Failed to load payments." });
  }
});

// GET /api/admin/cancellations
router.get("/cancellations", async (req, res) => {
  try {
    const result = await execute(
      `SELECT c.cancellation_id, c.booking_id, c.cancellation_date,
              c.refund_amount, c.cancellation_reason, c.refund_status,
              b.pnr_number,
              l1.city AS origin_city, l2.city AS dest_city,
              r.route_name
         FROM CANCELLATION c
         JOIN BOOKING b    ON c.booking_id           = b.booking_id
         JOIN SCHEDULE s   ON b.schedule_id           = s.schedule_id
         JOIN ROUTE r      ON s.route_id              = r.route_id
         JOIN LOCATION l1  ON b.boarding_location_id  = l1.location_id
         JOIN LOCATION l2  ON b.dropping_location_id  = l2.location_id
        ORDER BY c.cancellation_date DESC`
    );
    return res.json(result.rows.map((r) => ({
      id: r.CANCELLATION_ID,
      bookingId: r.BOOKING_ID,
      cancellationDate: r.CANCELLATION_DATE,
      refundAmount: Number(r.REFUND_AMOUNT),
      refundAmountLabel: `₹${Number(r.REFUND_AMOUNT).toLocaleString("en-IN")}`,
      reason: r.CANCELLATION_REASON,
      refundStatus: r.REFUND_STATUS,
      pnr: r.PNR_NUMBER,
      travelName: r.ROUTE_NAME,
      route: `${r.ORIGIN_CITY} to ${r.DEST_CITY}`,
    })));
  } catch (err) {
    return res.status(500).json({ error: "Failed to load cancellations." });
  }
});

// GET /api/admin/form-options/vehicles
// Returns mode and operator dropdowns for vehicle form
router.get("/form-options/vehicles", async (req, res) => {
  try {
    const [modes, operators] = await Promise.all([
      execute(`SELECT mode_id, mode_name FROM TRAVEL_MODE ORDER BY mode_id`),
      execute(`SELECT operator_id, operator_name FROM OPERATOR ORDER BY operator_id`),
    ]);
    return res.json({
      modes: modes.rows.map((r) => ({ value: r.MODE_ID, label: r.MODE_NAME })),
      operators: operators.rows.map((r) => ({ value: r.OPERATOR_ID, label: r.OPERATOR_NAME })),
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load vehicle form options." });
  }
});

// GET /api/admin/form-options/routes
// Returns all dropdowns for route form
router.get("/form-options/routes", async (req, res) => {
  try {
    const [modes, locations, operators, vehicles] = await Promise.all([
      execute(`SELECT mode_id, mode_name FROM TRAVEL_MODE ORDER BY mode_id`),
      execute(`SELECT location_id, location_name, city FROM LOCATION ORDER BY location_id`),
      execute(`SELECT operator_id, operator_name FROM OPERATOR ORDER BY operator_id`),
      execute(`SELECT vehicle_id, vehicle_name, vehicle_number FROM VEHICLE ORDER BY vehicle_id`),
    ]);
    return res.json({
      modes: modes.rows.map((r) => ({ value: r.MODE_ID, label: r.MODE_NAME })),
      locations: locations.rows.map((r) => ({
        value: r.LOCATION_ID,
        label: `${r.LOCATION_NAME} (${r.CITY})`,
      })),
      operators: operators.rows.map((r) => ({ value: r.OPERATOR_ID, label: r.OPERATOR_NAME })),
      vehicles: vehicles.rows.map((r) => ({
        value: r.VEHICLE_ID,
        label: `${r.VEHICLE_NAME} (${r.VEHICLE_NUMBER})`,
      })),
      weekDays: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load route form options." });
  }
});

module.exports = router;
