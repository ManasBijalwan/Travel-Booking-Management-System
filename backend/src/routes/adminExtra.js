const express = require("express");
const oracledb = require("oracledb");
const { execute, getConnection } = require("../db");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate, requireAdmin);

function formatCurrency(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

// ─── GET /api/admin/bookings ──────────────────────────────────────────────────
router.get("/bookings", async (req, res) => {
  try {
    const result = await execute(
      `SELECT b.booking_id, b.pnr_number, b.booking_status,
              b.total_amount, b.booking_date,
              r.route_name, tm.mode_name,
              l1.city AS boarding_city,
              l2.city AS dropping_city,
              u.full_name AS user_name
         FROM BOOKING b
         JOIN USERS u        ON b.user_id              = u.user_id
         JOIN SCHEDULE s     ON b.schedule_id           = s.schedule_id
         JOIN ROUTE r        ON s.route_id              = r.route_id
         JOIN TRAVEL_MODE tm ON r.mode_id               = tm.mode_id
         JOIN LOCATION l1    ON b.boarding_location_id  = l1.location_id
         JOIN LOCATION l2    ON b.dropping_location_id  = l2.location_id
        ORDER BY b.booking_date DESC`
    );

    const bookings = await Promise.all(
      result.rows.map(async (row) => {
        const [passRes, payRes] = await Promise.all([
          execute(
            `SELECT p.passenger_name, bp.seat_number
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
        return {
          id:               row.BOOKING_ID,
          pnr:              row.PNR_NUMBER,
          status:           row.BOOKING_STATUS,
          totalAmount:      Number(row.TOTAL_AMOUNT),
          totalAmountLabel: formatCurrency(row.TOTAL_AMOUNT),
          paymentStatus:    payRes.rows[0]?.PAYMENT_STATUS || "Pending",
          userName:         row.USER_NAME,
          passengers:       passRes.rows.map((p) => ({ passenger_name: p.PASSENGER_NAME })),
          selectedSeats:    passRes.rows.map((p) => p.SEAT_NUMBER),
          travel: {
            name:        row.ROUTE_NAME,
            type:        row.MODE_NAME,
            origin:      row.BOARDING_CITY,
            destination: row.DROPPING_CITY,
          },
        };
      })
    );

    return res.json(bookings);
  } catch (err) {
    console.error("Admin bookings error:", err);
    return res.status(500).json({ error: "Failed to load bookings." });
  }
});

router.delete("/bookings/:id", async (req, res) => {
  try {
    await execute(
      `DELETE FROM BOOKING WHERE booking_id=:id`,
      { id: Number(req.params.id) },
      { autoCommit: true }
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete booking." });
  }
});

// ─── GET /api/admin/payments ──────────────────────────────────────────────────
router.get("/payments", async (req, res) => {
  try {
    const result = await execute(
      `SELECT payment_id, booking_id, payment_method,
              payment_status, amount_paid, payment_date, transaction_ref
         FROM PAYMENT ORDER BY payment_date DESC`
    );
    return res.json(result.rows.map((r) => ({
      id:             r.PAYMENT_ID,
      bookingId:      r.BOOKING_ID,
      method:         r.PAYMENT_METHOD,
      status:         r.PAYMENT_STATUS,
      amount:         Number(r.AMOUNT_PAID),
      amountLabel:    formatCurrency(r.AMOUNT_PAID),
      date:           r.PAYMENT_DATE,
      transactionRef: r.TRANSACTION_REF,
    })));
  } catch (err) {
    return res.status(500).json({ error: "Failed to load payments." });
  }
});

// ─── GET /api/admin/cancellations ─────────────────────────────────────────────
router.get("/cancellations", async (req, res) => {
  try {
    const result = await execute(
      `SELECT c.cancellation_id, c.booking_id, c.cancellation_date,
              c.refund_amount, c.cancellation_reason, c.refund_status,
              b.pnr_number,
              l1.city AS origin_city,
              l2.city AS dest_city,
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
      id:                r.CANCELLATION_ID,
      bookingId:         r.BOOKING_ID,
      cancellationDate:  r.CANCELLATION_DATE,
      refundAmount:      Number(r.REFUND_AMOUNT),
      refundAmountLabel: formatCurrency(r.REFUND_AMOUNT),
      reason:            r.CANCELLATION_REASON,
      refundStatus:      r.REFUND_STATUS,
      pnr:               r.PNR_NUMBER,
      travelName:        r.ROUTE_NAME,
      route:             `${r.ORIGIN_CITY} to ${r.DEST_CITY}`,
    })));
  } catch (err) {
    return res.status(500).json({ error: "Failed to load cancellations." });
  }
});

// ─── GET /api/admin/form-options/vehicles ─────────────────────────────────────
router.get("/form-options/vehicles", async (req, res) => {
  try {
    const [modes, operators] = await Promise.all([
      execute(`SELECT mode_id, mode_name FROM TRAVEL_MODE ORDER BY mode_id`),
      execute(`SELECT operator_id, operator_name FROM OPERATOR ORDER BY operator_name`),
    ]);
    return res.json({
      modes:     modes.rows.map((r) => ({ value: r.MODE_ID,     label: r.MODE_NAME })),
      operators: operators.rows.map((r) => ({ value: r.OPERATOR_ID, label: r.OPERATOR_NAME })),
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load vehicle form options." });
  }
});

// ─── GET /api/admin/form-options/routes ───────────────────────────────────────
router.get("/form-options/routes", async (req, res) => {
  try {
    const [modes, locations, operators, vehicles] = await Promise.all([
      execute(`SELECT mode_id, mode_name FROM TRAVEL_MODE ORDER BY mode_id`),
      execute(
        `SELECT location_id, location_name, city FROM LOCATION
          ORDER BY city, location_name`
      ),
      execute(`SELECT operator_id, operator_name FROM OPERATOR ORDER BY operator_name`),
      execute(
        `SELECT vehicle_id, vehicle_name, vehicle_number FROM VEHICLE
          WHERE status = 'active' ORDER BY vehicle_name`
      ),
    ]);
    return res.json({
      modes:     modes.rows.map((r) => ({ value: r.MODE_ID,     label: r.MODE_NAME })),
      locations: locations.rows.map((r) => ({
        value: r.LOCATION_ID,
        label: `${r.LOCATION_NAME} (${r.CITY})`,
      })),
      operators: operators.rows.map((r) => ({
        value: r.OPERATOR_ID,
        label: r.OPERATOR_NAME,
      })),
      vehicles: vehicles.rows.map((r) => ({
        value: r.VEHICLE_ID,
        label: `${r.VEHICLE_NAME} (${r.VEHICLE_NUMBER})`,
      })),
      weekDays: [
        "Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday",
      ],
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load route form options." });
  }
});

// ─── GET /api/admin/analytics ─────────────────────────────────────────────────
// Uses fn_route_revenue, fn_most_popular_route, fn_user_booking_count
// This endpoint enriches the dashboard with function-based analytics.
// Called optionally — dashboard works without it, but adds extra insight.
router.get("/analytics", async (req, res) => {
  try {
    // Most popular route — fn_most_popular_route
    const popularRes = await execute(
      `SELECT fn_most_popular_route() AS popular_route FROM DUAL`
    );
    const popularRoute = popularRes.rows[0]?.POPULAR_ROUTE || "N/A";

    // Revenue per route — fn_route_revenue for each route
    const routeRes = await execute(
      `SELECT route_id, route_name FROM ROUTE ORDER BY route_id`
    );
    const revenueByRoute = await Promise.all(
      routeRes.rows.map(async (r) => {
        const revRes = await execute(
          `SELECT fn_route_revenue(:rid) AS revenue FROM DUAL`,
          { rid: r.ROUTE_ID }
        );
        return {
          routeId:   r.ROUTE_ID,
          routeName: r.ROUTE_NAME,
          revenue:   Number(revRes.rows[0]?.REVENUE || 0),
          revenueLabel: formatCurrency(revRes.rows[0]?.REVENUE || 0),
        };
      })
    );

    // Top 5 users by booking count — fn_user_booking_count
    const userRes = await execute(
      `SELECT user_id, full_name FROM USERS WHERE role='user' ORDER BY user_id`
    );
    const userStats = await Promise.all(
      userRes.rows.map(async (u) => {
        const cntRes = await execute(
          `SELECT fn_user_booking_count(:uid) AS cnt FROM DUAL`,
          { uid: u.USER_ID }
        );
        return {
          userId:        u.USER_ID,
          name:          u.FULL_NAME,
          bookingCount:  Number(cntRes.rows[0]?.CNT || 0),
        };
      })
    );
    const topUsers = userStats
      .sort((a, b) => b.bookingCount - a.bookingCount)
      .slice(0, 5);

    return res.json({
      popularRoute,
      revenueByRoute,
      topUsers,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return res.status(500).json({ error: "Failed to load analytics." });
  }
});

module.exports = router;
