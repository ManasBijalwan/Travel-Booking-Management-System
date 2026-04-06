const express = require("express");
const { execute } = require("../db");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

// GET /api/cancellations/user/:userId
router.get("/user/:userId", authenticate, async (req, res) => {
  if (req.user.role !== "admin" && req.user.id != req.params.userId) {
    return res.status(403).json({ error: "Access denied." });
  }
  try {
    const result = await execute(
      `SELECT c.cancellation_id,
              c.booking_id,
              c.cancellation_date,
              c.refund_amount,
              c.cancellation_reason,
              c.refund_status,
              b.pnr_number,
              r.route_name,
              l1.city AS origin_city,
              l2.city AS dest_city
         FROM CANCELLATION c
         JOIN BOOKING b    ON c.booking_id          = b.booking_id
         JOIN SCHEDULE s   ON b.schedule_id          = s.schedule_id
         JOIN ROUTE r      ON s.route_id             = r.route_id
         JOIN LOCATION l1  ON b.boarding_location_id = l1.location_id
         JOIN LOCATION l2  ON b.dropping_location_id = l2.location_id
        WHERE b.user_id = :uid
        ORDER BY c.cancellation_date DESC`,
      { uid: Number(req.params.userId) }
    );

    const cancellations = result.rows.map((row) => ({
      id: row.CANCELLATION_ID,
      bookingId: row.BOOKING_ID,
      cancellationDate: row.CANCELLATION_DATE,
      refundAmount: Number(row.REFUND_AMOUNT),
      refundAmountLabel: formatCurrency(row.REFUND_AMOUNT),
      reason: row.CANCELLATION_REASON,
      refundStatus: row.REFUND_STATUS,
      pnr: row.PNR_NUMBER,
      travelName: row.ROUTE_NAME,
      route: `${row.ORIGIN_CITY} to ${row.DEST_CITY}`,
    }));

    return res.json(cancellations);
  } catch (err) {
    console.error("Get cancellations error:", err);
    return res.status(500).json({ error: "Failed to load cancellations." });
  }
});

module.exports = router;
