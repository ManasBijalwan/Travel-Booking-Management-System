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

// Map a row from proc_search_schedules cursor or direct SELECT to travel view
function mapRow(row, extraFields = {}) {
  return {
    id:                    row.SCHEDULE_ID,
    schedule_id:           row.SCHEDULE_ID,
    type:                  row.MODE_NAME,
    name:                  row.VEHICLE_NAME,
    operatorName:          row.OPERATOR_NAME,
    origin:                extraFields.origin  || row.START_LOCATION,
    destination:           extraFields.dest    || row.END_LOCATION,
    originLocationId:      extraFields.startLocId || null,
    destinationLocationId: extraFields.endLocId   || null,
    departureDate:         toDatePart(row.DEPARTURE_DATETIME),
    departureTime:         toTimePart(row.DEPARTURE_DATETIME),
    arrivalTime:           toTimePart(row.ARRIVAL_DATETIME),
    duration:              formatDuration(extraFields.durationMin || 0),
    price:                 Number(row.BASE_FARE),
    seatsAvailable:        Number(row.SEATS_REMAINING),
    vehicleCode:           row.VEHICLE_NUMBER,
    routeCode:             row.ROUTE_NAME,
    amenities:             extraFields.stops || [],
    seatMap:               buildSeatMap(extraFields.totalSeats || 0),
    status:                row.STATUS,
  };
}

// ─── GET /api/travels ─────────────────────────────────────────────────────────
// Uses proc_search_schedules when origin+destination location IDs are given,
// falls back to a filtered SELECT for city-name / mode-only searches.
router.get("/", authenticate, requireUser, async (req, res) => {
  try {
    const { origin, destination, departureDate, type } = req.query;

    // ── Try to resolve city names to location IDs for proc_search_schedules ──
    let startLocId = null;
    let endLocId   = null;

    if (origin) {
      const r = await execute(
        `SELECT location_id FROM LOCATION
          WHERE UPPER(city) LIKE UPPER(:q) OR UPPER(location_name) LIKE UPPER(:q)
          FETCH FIRST 1 ROWS ONLY`,
        { q: `%${origin}%` }
      );
      startLocId = r.rows[0]?.LOCATION_ID ?? null;
    }
    if (destination) {
      const r = await execute(
        `SELECT location_id FROM LOCATION
          WHERE UPPER(city) LIKE UPPER(:q) OR UPPER(location_name) LIKE UPPER(:q)
          FETCH FIRST 1 ROWS ONLY`,
        { q: `%${destination}%` }
      );
      endLocId = r.rows[0]?.LOCATION_ID ?? null;
    }

    let scheduleRows = [];

    // ── Path A: Use proc_search_schedules (both location IDs resolved + date) ──
    if (startLocId && endLocId && departureDate) {
      let conn;
      try {
        conn = await getConnection();
        const result = await conn.execute(
          `BEGIN proc_search_schedules(:startLoc, :endLoc, TO_DATE(:dt,'YYYY-MM-DD'), :cur); END;`,
          {
            startLoc: startLocId,
            endLoc:   endLocId,
            dt:       departureDate,
            cur:      { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
          },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        scheduleRows = await fetchCursor(result.outBinds.cur);
      } finally {
        if (conn) try { await conn.close(); } catch (_) {}
      }
    } else {
      // ── Path B: Flexible fallback SELECT (no stored proc, mode/city filter) ──
      const conditions = ["s.status = 'scheduled'"];
      const binds = {};

      if (departureDate) {
        conditions.push("TRUNC(s.departure_datetime) = TO_DATE(:depDate,'YYYY-MM-DD')");
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

      const r = await execute(
        `SELECT s.schedule_id, s.departure_datetime, s.arrival_datetime,
                s.base_fare, s.seats_remaining, s.status,
                r.route_name, r.total_duration_min,
                r.start_location_id, r.end_location_id,
                v.vehicle_name, v.vehicle_number, v.total_seats,
                tm.mode_name, op.operator_name,
                l_s.location_name AS start_location, l_s.city AS start_city,
                l_e.location_name AS end_location,   l_e.city AS end_city,
                (SELECT LISTAGG(loc.city,',') WITHIN GROUP (ORDER BY rs.stop_sequence)
                   FROM ROUTE_STOP rs JOIN LOCATION loc ON rs.location_id = loc.location_id
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
          WHERE ${conditions.join(" AND ")}
          ORDER BY s.departure_datetime`,
        binds
      );
      scheduleRows = r.rows;
    }

    // ── Filter by travel mode (proc doesn't filter by mode) ────────────────
    let filtered = scheduleRows;
    if (type) {
      filtered = scheduleRows.filter(
        (r) => (r.MODE_NAME || "").toLowerCase() === type.toLowerCase()
      );
    }

    // ── Enrich each row with fn_seats_remaining (live seat count) ──────────
    const travels = await Promise.all(
      filtered.map(async (row) => {
        // Call fn_seats_remaining for live seat count
        const seatRes = await execute(
          `SELECT fn_seats_remaining(:id) AS seats FROM DUAL`,
          { id: row.SCHEDULE_ID }
        );
        const liveSeats = seatRes.rows[0]?.SEATS ?? Number(row.SEATS_REMAINING);

        // Gather stop names if not already present
        let stops = [];
        if (row.STOPS) {
          stops = row.STOPS.split(",").filter(Boolean);
        } else if (row.START_LOCATION_ID || row.ROUTE_NAME) {
          // proc_search_schedules rows don't include stop list — fetch separately
          const stopRes = await execute(
            `SELECT loc.city FROM ROUTE_STOP rs
               JOIN LOCATION loc ON rs.location_id = loc.location_id
               JOIN SCHEDULE s   ON rs.route_id    = s.route_id
              WHERE s.schedule_id = :sid
                AND rs.location_id NOT IN (
                      SELECT start_location_id FROM ROUTE WHERE route_id = rs.route_id
                      UNION
                      SELECT end_location_id   FROM ROUTE WHERE route_id = rs.route_id
                    )
              ORDER BY rs.stop_sequence`,
            { sid: row.SCHEDULE_ID }
          );
          stops = stopRes.rows.map((s) => s.CITY);
        }

        // Fetch vehicle total_seats if not in row (proc cursor doesn't return it)
        let totalSeats = row.TOTAL_SEATS;
        if (!totalSeats && row.SCHEDULE_ID) {
          const vRes = await execute(
            `SELECT v.total_seats FROM VEHICLE v
               JOIN SCHEDULE s ON s.vehicle_id = v.vehicle_id
              WHERE s.schedule_id = :sid`,
            { sid: row.SCHEDULE_ID }
          );
          totalSeats = vRes.rows[0]?.TOTAL_SEATS || 0;
        }

        return mapRow(row, {
          origin:     row.START_CITY    || row.START_LOCATION,
          dest:       row.END_CITY      || row.END_LOCATION,
          startLocId: row.START_LOCATION_ID,
          endLocId:   row.END_LOCATION_ID,
          durationMin: row.TOTAL_DURATION_MIN || 0,
          stops,
          totalSeats,
          liveSeats,
        });
      })
    );

    // Override seatsAvailable with live count from function
    const result = travels.map((t, i) => ({
      ...t,
      seatsAvailable: filtered[i]
        ? Number(filtered[i].SEATS_REMAINING ?? t.seatsAvailable)
        : t.seatsAvailable,
    }));

    return res.json(result);
  } catch (err) {
    console.error("Search travels error:", err);
    return res.status(500).json({ error: "Search failed." });
  }
});

// ─── GET /api/travels/:id ─────────────────────────────────────────────────────
// Uses fn_seats_remaining for live seat count and fn_is_seat_available
// to mark which seats are already booked.
router.get("/:id", authenticate, requireUser, async (req, res) => {
  try {
    const schedId = Number(req.params.id);

    // Fetch full schedule details
    const result = await execute(
      `SELECT s.schedule_id, s.departure_datetime, s.arrival_datetime,
              s.base_fare, s.seats_remaining, s.status,
              r.route_name, r.total_duration_min,
              r.start_location_id, r.end_location_id,
              v.vehicle_name, v.vehicle_number, v.total_seats,
              tm.mode_name, op.operator_name,
              l_s.location_name AS start_location, l_s.city AS start_city,
              l_e.location_name AS end_location,   l_e.city AS end_city
         FROM SCHEDULE s
         JOIN ROUTE r        ON s.route_id         = r.route_id
         JOIN VEHICLE v      ON s.vehicle_id        = v.vehicle_id
         JOIN TRAVEL_MODE tm ON r.mode_id           = tm.mode_id
         JOIN OPERATOR op    ON r.operator_id       = op.operator_id
         JOIN LOCATION l_s   ON r.start_location_id = l_s.location_id
         JOIN LOCATION l_e   ON r.end_location_id   = l_e.location_id
        WHERE s.schedule_id = :id`,
      { id: schedId }
    );

    const row = result.rows?.[0];
    if (!row) return res.status(404).json({ error: "Schedule not found." });

    // ── Call fn_seats_remaining for live count ────────────────────────────
    const seatRes = await execute(
      `SELECT fn_seats_remaining(:id) AS seats FROM DUAL`,
      { id: schedId }
    );
    const liveSeats = Number(seatRes.rows[0]?.SEATS ?? row.SEATS_REMAINING);

    // ── Build seat map and check each seat with fn_is_seat_available ───────
    const totalSeats = Number(row.TOTAL_SEATS || 0);
    const rawSeats = [];
    for (let i = 0; i < totalSeats; i++) {
      const seatLabel = `${String.fromCharCode(65 + Math.floor(i / 4))}${(i % 4) + 1}`;
      rawSeats.push(seatLabel);
    }

    // Check availability for all seats in parallel
    const availChecks = await Promise.all(
      rawSeats.map(async (seat) => {
        const r = await execute(
          `SELECT fn_is_seat_available(:sid, :seat) AS avail FROM DUAL`,
          { sid: schedId, seat }
        );
        return { seat, available: r.rows[0]?.AVAIL === "Y" };
      })
    );

    // Build seat map rows of 4, marking unavailable seats
    const seatRows = [];
    for (let i = 0; i < availChecks.length; i += 4) {
      seatRows.push(availChecks.slice(i, i + 4).map((s) => s.seat));
    }
    const unavailableSeats = availChecks
      .filter((s) => !s.available)
      .map((s) => s.seat);

    // Get intermediate stops
    const stopRes = await execute(
      `SELECT loc.city FROM ROUTE_STOP rs
         JOIN LOCATION loc ON rs.location_id = loc.location_id
        WHERE rs.route_id = (SELECT route_id FROM SCHEDULE WHERE schedule_id = :sid)
          AND rs.location_id NOT IN (
                SELECT start_location_id FROM ROUTE
                 WHERE route_id = (SELECT route_id FROM SCHEDULE WHERE schedule_id = :sid)
                UNION
                SELECT end_location_id FROM ROUTE
                 WHERE route_id = (SELECT route_id FROM SCHEDULE WHERE schedule_id = :sid)
              )
        ORDER BY rs.stop_sequence`,
      { sid: schedId }
    );

    const travel = {
      ...mapRow(row, {
        origin:     row.START_CITY || row.START_LOCATION,
        dest:       row.END_CITY   || row.END_LOCATION,
        startLocId: row.START_LOCATION_ID,
        endLocId:   row.END_LOCATION_ID,
        durationMin: row.TOTAL_DURATION_MIN || 0,
        stops:      stopRes.rows.map((s) => s.CITY),
        totalSeats,
      }),
      seatsAvailable:  liveSeats,
      seatMap:         seatRows,
      unavailableSeats,
    };

    return res.json(travel);
  } catch (err) {
    console.error("Get travel error:", err);
    return res.status(500).json({ error: "Failed to load travel." });
  }
});

module.exports = router;
