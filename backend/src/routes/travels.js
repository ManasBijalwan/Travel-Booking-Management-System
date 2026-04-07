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

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function buildSeatMap(totalSeats) {
  const seats = [];
  for (let i = 0; i < Number(totalSeats || 0); i++) {
    const row = String.fromCharCode(65 + Math.floor(i / 4));
    const num = (i % 4) + 1;
    seats.push(`${row}${num}`);
  }
  const rows = [];
  for (let i = 0; i < seats.length; i += 4) rows.push(seats.slice(i, i + 4));
  return rows;
}

function mapRow(row) {
  return {
    id:                   row.SCHEDULE_ID,
    schedule_id:          row.SCHEDULE_ID,
    type:                 row.MODE_NAME,
    name:                 row.VEHICLE_NAME,
    operatorName:         row.OPERATOR_NAME,
    origin:               row.START_CITY   || row.START_LOCATION,
    destination:          row.END_CITY     || row.END_LOCATION,
    originLocationId:     row.START_LOCATION_ID,
    destinationLocationId: row.END_LOCATION_ID,
    departureDate:        toDatePart(row.DEPARTURE_DATETIME),
    departureTime:        toTimePart(row.DEPARTURE_DATETIME),
    arrivalTime:          toTimePart(row.ARRIVAL_DATETIME),
    duration:             formatDuration(row.TOTAL_DURATION_MIN || 0),
    price:                Number(row.BASE_FARE),
    seatsAvailable:       Number(row.SEATS_REMAINING),
    vehicleCode:          row.VEHICLE_NUMBER,
    routeCode:            row.ROUTE_NAME,
    amenities:            row.STOPS ? row.STOPS.split(",").filter(Boolean) : [],
    seatMap:              buildSeatMap(row.TOTAL_SEATS),
    status:               row.STATUS,
  };
}

// Shared SELECT body used by both GET / and GET /:id
const TRAVEL_SELECT = `
  SELECT s.schedule_id,
         s.departure_datetime,
         s.arrival_datetime,
         s.base_fare,
         s.seats_remaining,
         s.status,
         r.route_name,
         r.total_duration_min,
         r.start_location_id,
         r.end_location_id,
         v.vehicle_name,
         v.vehicle_number,
         v.total_seats,
         tm.mode_name,
         op.operator_name,
         l_s.location_name  AS start_location,
         l_s.city           AS start_city,
         l_e.location_name  AS end_location,
         l_e.city           AS end_city,
         (
           SELECT LISTAGG(loc.city, ',')
                  WITHIN GROUP (ORDER BY rs.stop_sequence)
             FROM ROUTE_STOP rs
             JOIN LOCATION loc ON rs.location_id = loc.location_id
            WHERE rs.route_id = r.route_id
              AND rs.location_id NOT IN (r.start_location_id, r.end_location_id)
         ) AS stops
    FROM SCHEDULE s
    JOIN ROUTE r        ON s.route_id         = r.route_id
    JOIN VEHICLE v      ON s.vehicle_id        = v.vehicle_id
    JOIN TRAVEL_MODE tm ON r.mode_id           = tm.mode_id
    JOIN OPERATOR op    ON r.operator_id       = op.operator_id
    JOIN LOCATION l_s   ON r.start_location_id = l_s.location_id
    JOIN LOCATION l_e   ON r.end_location_id   = l_e.location_id
`;

// ─── GET /api/travels ─────────────────────────────────────────────────────────
// Query params: origin, destination, departureDate, type
router.get("/", authenticate, requireUser, async (req, res) => {
  try {
    const { origin, destination, departureDate, type } = req.query;

    const conditions = ["s.status = 'scheduled'"];
    const binds = {};

    if (departureDate) {
      conditions.push(
        "TRUNC(s.departure_datetime) = TO_DATE(:depDate, 'YYYY-MM-DD')"
      );
      binds.depDate = departureDate;
    }
    if (type) {
      conditions.push("UPPER(tm.mode_name) = UPPER(:modeName)");
      binds.modeName = type;
    }
    if (origin) {
      conditions.push(
        "(UPPER(l_s.city) LIKE UPPER(:origin) OR UPPER(l_s.location_name) LIKE UPPER(:origin))"
      );
      binds.origin = `%${origin}%`;
    }
    if (destination) {
      conditions.push(
        "(UPPER(l_e.city) LIKE UPPER(:dest) OR UPPER(l_e.location_name) LIKE UPPER(:dest))"
      );
      binds.dest = `%${destination}%`;
    }

    const sql =
      TRAVEL_SELECT +
      ` WHERE ${conditions.join(" AND ")} ORDER BY s.departure_datetime`;

    const result = await execute(sql, binds);
    return res.json(result.rows.map(mapRow));
  } catch (err) {
    console.error("Search travels error:", err);
    return res.status(500).json({ error: "Search failed." });
  }
});

// ─── GET /api/travels/:id ─────────────────────────────────────────────────────
router.get("/:id", authenticate, requireUser, async (req, res) => {
  try {
    const sql = TRAVEL_SELECT + ` WHERE s.schedule_id = :id`;
    const result = await execute(sql, { id: Number(req.params.id) });
    const row = result.rows?.[0];
    if (!row) return res.status(404).json({ error: "Schedule not found." });
    return res.json(mapRow(row));
  } catch (err) {
    console.error("Get travel error:", err);
    return res.status(500).json({ error: "Failed to load travel." });
  }
});

module.exports = router;
