const express  = require("express");
const oracledb = require("oracledb");
const { execute } = require("../db");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate, requireAdmin);

function formatCurrency(n) { return `₹${Number(n || 0).toLocaleString("en-IN")}`; }
function toIso(dt) { if (!dt) return null; return (dt instanceof Date ? dt : new Date(dt)).toISOString(); }

// ─── GET /api/admin/bookings ──────────────────────────────────────────────────
router.get("/bookings", async (req, res) => {
  try {
    const result = await execute(
      `SELECT b.booking_id, b.pnr_number, b.booking_status,
              b.total_amount, b.booking_date,
              r.route_name, tm.mode_name,
              l1.city AS boarding_city, l2.city AS dropping_city,
              u.full_name AS user_name
         FROM booking b
         JOIN users u        ON b.user_id              = u.user_id
         JOIN schedule s     ON b.schedule_id           = s.schedule_id
         JOIN route r        ON s.route_id              = r.route_id
         JOIN travel_mode tm ON r.mode_id               = tm.mode_id
         JOIN location l1    ON b.boarding_location_id  = l1.location_id
         JOIN location l2    ON b.dropping_location_id  = l2.location_id
        ORDER BY b.booking_date DESC`
    );
    const bookings = await Promise.all(result.rows.map(async row => {
      const [passRes, payRes] = await Promise.all([
        execute(
          `SELECT p.passenger_name, bp.seat_number
             FROM booking_passenger bp JOIN passenger p ON bp.passenger_id = p.passenger_id
            WHERE bp.booking_id = :bid`, { bid: row.BOOKING_ID }
        ),
        execute(
          `SELECT payment_status FROM payment WHERE booking_id = :bid AND ROWNUM = 1`,
          { bid: row.BOOKING_ID }
        ),
      ]);
      return {
        id:               row.BOOKING_ID,
        pnr:              row.PNR_NUMBER,
        status:           row.BOOKING_STATUS,
        totalAmount:      Number(row.TOTAL_AMOUNT),
        totalAmountLabel: formatCurrency(row.TOTAL_AMOUNT),
        paymentStatus:    payRes.rows[0]?.PAYMENT_STATUS || "Paid",
        userName:         row.USER_NAME,
        passengers:       passRes.rows.map(p => ({ passenger_name: p.PASSENGER_NAME })),
        selectedSeats:    passRes.rows.map(p => p.SEAT_NUMBER),
        travel: {
          name:        row.ROUTE_NAME,
          type:        row.MODE_NAME,
          origin:      row.BOARDING_CITY,
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
    await execute(`DELETE FROM booking WHERE booking_id=:id`,
      { id: Number(req.params.id) }, { autoCommit: true });
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ error: "Failed to delete booking." }); }
});

// ─── GET /api/admin/payments ──────────────────────────────────────────────────
router.get("/payments", async (req, res) => {
  try {
    const result = await execute(
      `SELECT payment_id, booking_id, payment_method,
              payment_status, amount_paid, payment_date, transaction_ref
         FROM payment ORDER BY payment_date DESC`
    );
    return res.json(result.rows.map(r => ({
      id:             r.PAYMENT_ID,
      bookingId:      r.BOOKING_ID,
      method:         r.PAYMENT_METHOD,
      status:         r.PAYMENT_STATUS,
      amount:         Number(r.AMOUNT_PAID),
      amountLabel:    formatCurrency(r.AMOUNT_PAID),
      date:           toIso(r.PAYMENT_DATE),
      transactionRef: r.TRANSACTION_REF,
    })));
  } catch (err) { return res.status(500).json({ error: "Failed to load payments." }); }
});

// ─── GET /api/admin/cancellations ─────────────────────────────────────────────
// Returns extra fields: bookedByName, bookedByDisplayId, passengerNames
router.get("/cancellations", async (req, res) => {
  try {
    const result = await execute(
      `SELECT c.cancellation_id, c.booking_id, c.cancellation_date,
              c.refund_amount, c.cancellation_reason, c.refund_status,
              b.pnr_number,
              l1.city AS origin_city, l2.city AS dest_city,
              r.route_name,
              u.full_name AS booked_by_name, u.user_id AS booked_by_id
         FROM cancellation c
         JOIN booking b    ON c.booking_id           = b.booking_id
         JOIN schedule s   ON b.schedule_id           = s.schedule_id
         JOIN route r      ON s.route_id              = r.route_id
         JOIN location l1  ON b.boarding_location_id  = l1.location_id
         JOIN location l2  ON b.dropping_location_id  = l2.location_id
         JOIN users u      ON b.user_id               = u.user_id
        ORDER BY c.cancellation_date DESC`
    );

    const cancellations = await Promise.all(result.rows.map(async r => {
      const passRes = await execute(
        `SELECT p.passenger_name
           FROM booking_passenger bp JOIN passenger p ON bp.passenger_id = p.passenger_id
          WHERE bp.booking_id = :bid`,
        { bid: r.BOOKING_ID }
      );
      return {
        id:                r.CANCELLATION_ID,
        bookingId:         r.BOOKING_ID,
        cancellationDate:  toIso(r.CANCELLATION_DATE),
        refundAmount:      Number(r.REFUND_AMOUNT),
        refundAmountLabel: formatCurrency(r.REFUND_AMOUNT),
        reason:            r.CANCELLATION_REASON,
        refundStatus:      r.REFUND_STATUS,
        pnr:               r.PNR_NUMBER,
        travelName:        r.ROUTE_NAME,
        route:             `${r.ORIGIN_CITY} to ${r.DEST_CITY}`,
        bookedByName:      r.BOOKED_BY_NAME,
        bookedByDisplayId: r.BOOKED_BY_ID,
        passengerNames:    passRes.rows.map(p => p.PASSENGER_NAME),
      };
    }));

    return res.json(cancellations);
  } catch (err) {
    console.error("Admin cancellations error:", err);
    return res.status(500).json({ error: "Failed to load cancellations." });
  }
});

// ─── POST /api/admin/cancellations (upsert refund details) ────────────────────
// Admin can update refund_amount, refund_status, reason on an existing cancellation
router.post("/cancellations", async (req, res) => {
  const { id, bookingId, refundAmount, refundStatus, reason } = req.body;
  if (!id) return res.status(400).json({ error: "Cancellation ID required." });

  try {
    // Update cancellation record
    await execute(
      `UPDATE cancellation
          SET refund_amount = :amt,
              refund_status = :stat,
              cancellation_reason = :reason
        WHERE cancellation_id = :cid`,
      { amt: Number(refundAmount || 0), stat: refundStatus, reason: reason || null, cid: Number(id) },
      { autoCommit: false }
    );

    // Update linked payment status
    await execute(
      `UPDATE payment
          SET payment_status = CASE
            WHEN LOWER(:stat) = 'reimbursed' THEN 'Refunded'
            ELSE 'Refund Pending'
          END
        WHERE booking_id = :bid`,
      { stat: refundStatus, bid: Number(bookingId) },
      { autoCommit: true }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Update cancellation error:", err);
    return res.status(500).json({ error: "Failed to update reimbursement." });
  }
});

// ─── GET /api/admin/form-options/vehicles ─────────────────────────────────────
// FIX: operators now include mode_id so frontend can filter by selected mode
router.get("/form-options/vehicles", async (req, res) => {
  try {
    const [modes, operators] = await Promise.all([
      execute(`SELECT mode_id, mode_name FROM travel_mode ORDER BY mode_id`),
      execute(
        `SELECT o.operator_id, o.operator_name, o.mode_id, tm.mode_name
           FROM operator o JOIN travel_mode tm ON o.mode_id = tm.mode_id
          ORDER BY o.operator_name`
      ),
    ]);
    return res.json({
      modes: modes.rows.map(r => ({ value: r.MODE_ID, label: r.MODE_NAME })),
      // Include mode_id on each operator so frontend can filter by mode
      operators: operators.rows.map(r => ({
        value:   r.OPERATOR_ID,
        label:   r.OPERATOR_NAME,
        mode_id: r.MODE_ID,
      })),
    });
  } catch (err) { return res.status(500).json({ error: "Failed to load vehicle form options." }); }
});

// ─── GET /api/admin/form-options/routes ───────────────────────────────────────
// Vehicles also include mode_id and operator_id for cascading filters
router.get("/form-options/routes", async (req, res) => {
  try {
    const [modes, locations, operators, vehicles] = await Promise.all([
      execute(`SELECT mode_id, mode_name FROM travel_mode ORDER BY mode_id`),
      execute(
        `SELECT location_id, location_name, city, location_type
           FROM location ORDER BY city, location_name`
      ),
      execute(
        `SELECT o.operator_id, o.operator_name, o.mode_id
           FROM operator o ORDER BY o.operator_name`
      ),
      execute(
        `SELECT vehicle_id, vehicle_name, vehicle_number, mode_id, operator_id
           FROM vehicle WHERE status = 'active' ORDER BY vehicle_name`
      ),
    ]);
    return res.json({
      modes:     modes.rows.map(r => ({ value: r.MODE_ID, label: r.MODE_NAME })),
      locations: locations.rows.map(r => ({
        value:         r.LOCATION_ID,
        label:         `${r.LOCATION_NAME} (${r.CITY})`,
        location_type: r.LOCATION_TYPE,
      })),
      operators: operators.rows.map(r => ({
        value:   r.OPERATOR_ID,
        label:   r.OPERATOR_NAME,
        mode_id: r.MODE_ID,
      })),
      vehicles: vehicles.rows.map(r => ({
        value:       r.VEHICLE_ID,
        label:       `${r.VEHICLE_NAME} (${r.VEHICLE_NUMBER})`,
        mode_id:     r.MODE_ID,
        operator_id: r.OPERATOR_ID,
        assigned_route_id: null,
      })),
    });
  } catch (err) { return res.status(500).json({ error: "Failed to load route form options." }); }
});

// ─── GET /api/admin/analytics ─────────────────────────────────────────────────
router.get("/analytics", async (req, res) => {
  try {
    const popularRes = await execute(`SELECT fn_most_popular_route() AS popular_route FROM DUAL`);
    const routeRes   = await execute(`SELECT route_id, route_name FROM route ORDER BY route_id`);
    const revenueByRoute = await Promise.all(routeRes.rows.map(async r => {
      const revRes = await execute(
        `SELECT fn_route_revenue(:rid) AS revenue FROM DUAL`, { rid: r.ROUTE_ID }
      );
      return {
        routeId:      r.ROUTE_ID,
        routeName:    r.ROUTE_NAME,
        revenue:      Number(revRes.rows[0]?.REVENUE || 0),
        revenueLabel: formatCurrency(revRes.rows[0]?.REVENUE || 0),
      };
    }));
    return res.json({
      popularRoute: popularRes.rows[0]?.POPULAR_ROUTE || "N/A",
      revenueByRoute,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return res.status(500).json({ error: "Failed to load analytics." });
  }
});

module.exports = router;
