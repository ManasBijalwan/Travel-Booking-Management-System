const express   = require("express");
const oracledb  = require("oracledb");
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
  if (!dt) return "";
  return toIso(dt)?.slice(0, 10) ?? "";
}

function toTimePart(dt) {
  if (!dt) return "";
  const d = dt instanceof Date ? dt : new Date(dt);
  return d.toTimeString().slice(0, 5);
}

function buildSeatMap(totalSeats) {
  const seats = [];
  for (let i = 0; i < Number(totalSeats || 0); i++) {
    seats.push(`${String.fromCharCode(65 + Math.floor(i / 4))}${(i % 4) + 1}`);
  }
  const rows = [];
  for (let i = 0; i < seats.length; i += 4) rows.push(seats.slice(i, i + 4));
  return rows;
}

function mapScheduleRow(row) {
  return {
    id:                    row.SCHEDULE_ID,
    schedule_id:           row.SCHEDULE_ID,
    type:                  row.MODE_NAME,
    name:                  row.VEHICLE_NAME,
    operatorName:          row.OPERATOR_NAME,
    origin:                row.START_CITY   || row.START_LOCATION,
    destination:           row.END_CITY     || row.END_LOCATION,
    originLocationId:      row.START_LOCATION_ID,
    destinationLocationId: row.END_LOCATION_ID,
    departureDate:         toDatePart(row.DEPARTURE_DATETIME),
    departureTime:         toTimePart(row.DEPARTURE_DATETIME),
    departureDateTime:     toIso(row.DEPARTURE_DATETIME),
    arrivalTime:           toTimePart(row.ARRIVAL_DATETIME),
    arrivalDateTime:       toIso(row.ARRIVAL_DATETIME),
    price:                 Number(row.BASE_FARE || row.SEAT_FARE || 0),
    seatsAvailable:        Number(row.SEATS_REMAINING),
    vehicleCode:           row.VEHICLE_NUMBER,
    routeCode:             row.ROUTE_NAME,
    seatMap:               buildSeatMap(row.TOTAL_SEATS),
    status:                row.SCHEDULE_STATUS,
  };
}

// ─── GET /api/travels/locations ───────────────────────────────────────────────
// Returns locations filtered by travel mode for the search dropdowns.
// Only returns locations that are part of an active schedule's route
// (as start, end, or intermediate stop).
// Query: ?mode=Train  (or Bus, Flight)
// location_type mapping: Train→Railway Station, Flight→Airport, Bus→all
router.get("/locations", authenticate, requireUser, async (req, res) => {
  try {
    const { mode } = req.query;

    // Map mode name to the location_type filter
    // New schema uses: 'Railway Station', 'Airport', 'Bus Stand'
    let locationTypeFilter = "";
    if (mode) {
      const m = mode.toLowerCase();
      if (m === "train")       locationTypeFilter = "'Railway Station'";
      else if (m === "flight") locationTypeFilter = "'Airport'";
      // bus → no filter (all types)
    }

    const typeClause = locationTypeFilter
      ? `AND l.location_type = ${locationTypeFilter}`
      : "";

    // Locations that appear in routes with at least one active schedule
    const sql = `
      SELECT DISTINCT l.location_id, l.location_name, l.city, l.state, l.location_type
        FROM location l
       WHERE l.location_id IN (
               -- start/end of active routes
               SELECT r.start_location_id FROM route r
                JOIN schedule s ON s.route_id = r.route_id AND s.status = 'active'
               UNION
               SELECT r.end_location_id FROM route r
                JOIN schedule s ON s.route_id = r.route_id AND s.status = 'active'
               UNION
               -- intermediate stops on active routes
               SELECT rs.location_id FROM route_stop rs
                JOIN schedule s ON s.route_id = rs.route_id AND s.status = 'active'
             )
         ${typeClause}
       ORDER BY l.city, l.location_name
    `;

    const result = await execute(sql);
    return res.json(result.rows.map((r) => ({
      value: r.LOCATION_ID,
      label: `${r.LOCATION_NAME} (${r.CITY})`,
      city:  r.CITY,
      type:  r.LOCATION_TYPE,
    })));
  } catch (err) {
    console.error("Locations for search error:", err);
    return res.status(500).json({ error: "Failed to load locations." });
  }
});

// ─── GET /api/travels ─────────────────────────────────────────────────────────
// Query: origin (location_id), destination (location_id), departureDate, type (mode name)
// New schema: schedule.status = 'active' (not 'scheduled')
router.get("/", authenticate, requireUser, async (req, res) => {
  try {
    const { origin, destination, departureDate, type } = req.query;

    const conditions = ["s.status = 'active'"];
    const binds = {};

    if (departureDate) {
      conditions.push("TRUNC(s.departure_datetime) = TO_DATE(:depDate, 'YYYY-MM-DD')");
      binds.depDate = departureDate;
    }
    if (type) {
      conditions.push("UPPER(tm.mode_name) = UPPER(:modeName)");
      binds.modeName = type;
    }

    // origin/destination are now location_id values (from dropdown)
    if (origin) {
      conditions.push(`EXISTS (
        SELECT 1 FROM route_stop rs1
         WHERE rs1.route_id = r.route_id AND rs1.location_id = :originId
      )`);
      binds.originId = Number(origin);
    }
    if (destination) {
      conditions.push(`EXISTS (
        SELECT 1 FROM route_stop rs2
         WHERE rs2.route_id = r.route_id AND rs2.location_id = :destId
      )`);
      binds.destId = Number(destination);
    }
    // If both provided, ensure origin stop comes before destination stop
    if (origin && destination) {
      conditions.push(`(
        SELECT rs_o.stop_sequence FROM route_stop rs_o
         WHERE rs_o.route_id = r.route_id AND rs_o.location_id = :originId2
      ) < (
        SELECT rs_d.stop_sequence FROM route_stop rs_d
         WHERE rs_d.route_id = r.route_id AND rs_d.location_id = :destId2
      )`);
      binds.originId2 = Number(origin);
      binds.destId2   = Number(destination);
    }

    const sql = `
      SELECT s.schedule_id,
             s.departure_datetime,
             s.arrival_datetime,
             s.base_fare,
             s.seats_remaining,
             s.status AS schedule_status,
             r.route_name,
             r.start_location_id,
             r.end_location_id,
             v.vehicle_name,
             v.vehicle_number,
             v.total_seats,
             v.seat_fare,
             tm.mode_name,
             op.operator_name,
             l_s.location_name AS start_location,
             l_s.city          AS start_city,
             l_e.location_name AS end_location,
             l_e.city          AS end_city
        FROM schedule s
        JOIN route r        ON s.route_id         = r.route_id
        JOIN vehicle v      ON s.vehicle_id        = v.vehicle_id
        JOIN travel_mode tm ON r.mode_id           = tm.mode_id
        JOIN operator op    ON r.operator_id       = op.operator_id
        JOIN location l_s   ON r.start_location_id = l_s.location_id
        JOIN location l_e   ON r.end_location_id   = l_e.location_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY s.departure_datetime
    `;

    const result = await execute(sql, binds);

    // Enrich with intermediate stops
    const travels = await Promise.all(result.rows.map(async (row) => {
      const stopRes = await execute(
        `SELECT rs.location_id, rs.arrival_datetime, rs.departure_datetime,
                l.location_name, l.city
           FROM route_stop rs
           JOIN location l ON rs.location_id = l.location_id
          WHERE rs.route_id = (
            SELECT route_id FROM schedule WHERE schedule_id = :sid
          )
          ORDER BY rs.stop_sequence`,
        { sid: row.SCHEDULE_ID }
      );
      const mapped = mapScheduleRow(row);
      mapped.intermediateStops = stopRes.rows
        .filter(s => s.LOCATION_ID !== row.START_LOCATION_ID && s.LOCATION_ID !== row.END_LOCATION_ID)
        .map(s => ({
          location_id:      s.LOCATION_ID,
          location_name:    s.LOCATION_NAME,
          city:             s.CITY,
          arrivalDateTime:  toIso(s.ARRIVAL_DATETIME),
          departureDateTime: toIso(s.DEPARTURE_DATETIME),
        }));
      return mapped;
    }));

    return res.json(travels);
  } catch (err) {
    console.error("Search travels error:", err);
    return res.status(500).json({ error: "Search failed." });
  }
});

// ─── GET /api/travels/:id ─────────────────────────────────────────────────────
router.get("/:id", authenticate, requireUser, async (req, res) => {
  try {
    const schedId = Number(req.params.id);
    const result  = await execute(
      `SELECT s.schedule_id,
              s.departure_datetime, s.arrival_datetime,
              s.base_fare, s.seats_remaining, s.status AS schedule_status,
              r.route_name, r.start_location_id, r.end_location_id,
              v.vehicle_name, v.vehicle_number, v.total_seats, v.seat_fare,
              tm.mode_name, op.operator_name,
              l_s.location_name AS start_location, l_s.city AS start_city,
              l_e.location_name AS end_location,   l_e.city AS end_city
         FROM schedule s
         JOIN route r        ON s.route_id         = r.route_id
         JOIN vehicle v      ON s.vehicle_id        = v.vehicle_id
         JOIN travel_mode tm ON r.mode_id           = tm.mode_id
         JOIN operator op    ON r.operator_id       = op.operator_id
         JOIN location l_s   ON r.start_location_id = l_s.location_id
         JOIN location l_e   ON r.end_location_id   = l_e.location_id
        WHERE s.schedule_id = :id`,
      { id: schedId }
    );

    const row = result.rows?.[0];
    if (!row) return res.status(404).json({ error: "Schedule not found." });

    // Live seat count via function
    const seatRes = await execute(
      `SELECT fn_seats_remaining(:id) AS seats FROM DUAL`,
      { id: schedId }
    );
    const liveSeats = Number(seatRes.rows[0]?.SEATS ?? row.SEATS_REMAINING);

    // All stops including endpoints
    const stopRes = await execute(
      `SELECT rs.location_id, rs.stop_sequence,
              rs.arrival_datetime, rs.departure_datetime,
              l.location_name, l.city
         FROM route_stop rs
         JOIN location l ON rs.location_id = l.location_id
        WHERE rs.route_id = (SELECT route_id FROM schedule WHERE schedule_id = :sid)
        ORDER BY rs.stop_sequence`,
      { sid: schedId }
    );

    // Check booked seats via function
    const totalSeats = Number(row.TOTAL_SEATS || 0);
    const rawSeats   = [];
    for (let i = 0; i < totalSeats; i++) {
      rawSeats.push(`${String.fromCharCode(65 + Math.floor(i / 4))}${(i % 4) + 1}`);
    }
    const availChecks = await Promise.all(
      rawSeats.map(async (seat) => {
        const r = await execute(
          `SELECT fn_is_seat_available(:sid, :seat) AS avail FROM DUAL`,
          { sid: schedId, seat }
        );
        return { seat, available: r.rows[0]?.AVAIL === "Y" };
      })
    );
    const seatRows       = [];
    for (let i = 0; i < availChecks.length; i += 4)
      seatRows.push(availChecks.slice(i, i + 4).map(s => s.seat));
    const unavailableSeats = availChecks.filter(s => !s.available).map(s => s.seat);

    const intermediateStops = stopRes.rows
      .filter(s => s.LOCATION_ID !== row.START_LOCATION_ID && s.LOCATION_ID !== row.END_LOCATION_ID)
      .map(s => ({
        location_id:       s.LOCATION_ID,
        location_name:     s.LOCATION_NAME,
        city:              s.CITY,
        arrivalDateTime:   toIso(s.ARRIVAL_DATETIME),
        departureDateTime: toIso(s.DEPARTURE_DATETIME),
      }));

    return res.json({
      ...mapScheduleRow(row),
      seatsAvailable:  liveSeats,
      seatMap:         seatRows,
      unavailableSeats,
      intermediateStops,
    });
  } catch (err) {
    console.error("Get travel error:", err);
    return res.status(500).json({ error: "Failed to load travel." });
  }
});

module.exports = router;
