const express  = require("express");
const oracledb = require("oracledb");
const { execute, getConnection } = require("../db");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate, requireAdmin);

function formatCurrency(n) { return `₹${Number(n || 0).toLocaleString("en-IN")}`; }
function toIso(dt) { if (!dt) return null; return (dt instanceof Date ? dt : new Date(dt)).toISOString(); }

// ─── GET /api/admin/overview ──────────────────────────────────────────────────
router.get("/overview", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const dash = await conn.execute(
      `BEGIN proc_admin_dashboard(:u,:b,:conf,:canc,:rev,:sch); END;`,
      {
        u:    { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        b:    { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        conf: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        canc: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        rev:  { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        sch:  { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const ob = dash.outBinds;
    const [rb, rp] = await Promise.all([
      conn.execute(
        `SELECT b.booking_id, b.booking_status, b.total_amount,
                l1.city AS origin, l2.city AS destination
           FROM booking b
           JOIN schedule s  ON b.schedule_id          = s.schedule_id
           JOIN route r     ON s.route_id             = r.route_id
           JOIN location l1 ON b.boarding_location_id = l1.location_id
           JOIN location l2 ON b.dropping_location_id = l2.location_id
          ORDER BY b.booking_date DESC FETCH FIRST 10 ROWS ONLY`,
        {}, { outFormat: oracledb.OUT_FORMAT_OBJECT }
      ),
      conn.execute(
        `SELECT payment_id, booking_id, payment_method, payment_status, amount_paid
           FROM payment ORDER BY payment_date DESC FETCH FIRST 10 ROWS ONLY`,
        {}, { outFormat: oracledb.OUT_FORMAT_OBJECT }
      ),
    ]);
    return res.json({
      metrics: [
        { label: "Total Users",      value: ob.u },
        { label: "Total Bookings",   value: ob.b },
        { label: "Confirmed",        value: ob.conf },
        { label: "Cancelled",        value: ob.canc },
        { label: "Revenue",          value: formatCurrency(ob.rev) },
        { label: "Active Schedules", value: ob.sch },
      ],
      bookings: rb.rows.map(r => ({
        id:               r.BOOKING_ID,
        status:           r.BOOKING_STATUS,
        totalAmountLabel: formatCurrency(r.TOTAL_AMOUNT),
        travel:           { origin: r.ORIGIN, destination: r.DESTINATION },
      })),
      payments: rp.rows.map(r => ({
        id:          r.PAYMENT_ID,
        bookingId:   r.BOOKING_ID,
        method:      r.PAYMENT_METHOD,
        status:      r.PAYMENT_STATUS,
        amountLabel: formatCurrency(r.AMOUNT_PAID),
      })),
    });
  } catch (err) {
    console.error("Admin overview error:", err);
    return res.status(500).json({ error: "Failed to load dashboard." });
  } finally {
    if (conn) try { await conn.close(); } catch (_) {}
  }
});

// ─── OPERATORS ────────────────────────────────────────────────────────────────
// FIX: The old page was sending 'mode_type' but the DB column is mode_id.
// Backend now accepts both mode_id and mode_type and resolves correctly.

router.get("/operators", async (req, res) => {
  try {
    const r = await execute(
      `SELECT o.operator_id AS id, o.operator_name, o.mode_id,
              tm.mode_name, o.contact_email, o.contact_phone
         FROM operator o JOIN travel_mode tm ON o.mode_id = tm.mode_id
        ORDER BY o.operator_id`
    );
    return res.json(r.rows.map(row => ({
      id:             row.ID,
      operator_name:  row.OPERATOR_NAME,
      mode_id:        row.MODE_ID,
      mode_name:      row.MODE_NAME,
      // expose as mode_type too so the frontend field 'mode_type' matches
      mode_type:      row.MODE_NAME,
      contact_email:  row.CONTACT_EMAIL,
      contact_phone:  row.CONTACT_PHONE,
    })));
  } catch (err) { return res.status(500).json({ error: "Failed to load operators." }); }
});

router.post("/operators", async (req, res) => {
  // Accept mode_id directly OR resolve from mode_type string
  let { operator_name, mode_id, mode_type, contact_email, contact_phone } = req.body;

  // If mode_id not given but mode_type is, resolve it from travel_mode table
  if (!mode_id && mode_type) {
    try {
      const mRes = await execute(
        `SELECT mode_id FROM travel_mode WHERE LOWER(mode_name) = LOWER(:name)`,
        { name: mode_type }
      );
      mode_id = mRes.rows[0]?.MODE_ID;
    } catch (_) {}
  }

  if (!mode_id) return res.status(400).json({ error: "Valid mode_id or mode_type is required." });

  try {
    const r = await execute(
      `INSERT INTO operator (operator_name, mode_id, contact_email, contact_phone)
       VALUES (:name, :mid, :email, :phone) RETURNING operator_id INTO :id`,
      {
        name:  operator_name,
        mid:   Number(mode_id),
        email: contact_email || null,
        phone: contact_phone || null,
        id:    { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true }
    );
    return res.status(201).json({ id: r.outBinds.id[0], success: true });
  } catch (err) {
    console.error("Create operator error:", err);
    return res.status(500).json({ error: "Failed to create operator." });
  }
});

router.put("/operators/:id", async (req, res) => {
  let { operator_name, mode_id, mode_type, contact_email, contact_phone } = req.body;
  if (!mode_id && mode_type) {
    try {
      const mRes = await execute(
        `SELECT mode_id FROM travel_mode WHERE LOWER(mode_name) = LOWER(:name)`,
        { name: mode_type }
      );
      mode_id = mRes.rows[0]?.MODE_ID;
    } catch (_) {}
  }
  try {
    await execute(
      `UPDATE operator SET operator_name=:name, mode_id=:mid,
              contact_email=:email, contact_phone=:phone WHERE operator_id=:id`,
      { name: operator_name, mid: Number(mode_id), email: contact_email || null,
        phone: contact_phone || null, id: Number(req.params.id) },
      { autoCommit: true }
    );
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ error: "Failed to update operator." }); }
});

router.delete("/operators/:id", async (req, res) => {
  try {
    await execute(`DELETE FROM operator WHERE operator_id=:id`,
      { id: Number(req.params.id) }, { autoCommit: true });
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ error: "Failed to delete operator." }); }
});

// ─── LOCATIONS ────────────────────────────────────────────────────────────────
// New schema: country column added

router.get("/locations", async (req, res) => {
  try {
    const r = await execute(
      `SELECT location_id AS id, location_name, city, state, country, location_type
         FROM location ORDER BY location_id`
    );
    return res.json(r.rows.map(row => ({
      id:            row.ID,
      location_name: row.LOCATION_NAME,
      city:          row.CITY,
      state:         row.STATE,
      country:       row.COUNTRY,
      location_type: row.LOCATION_TYPE,
    })));
  } catch (err) { return res.status(500).json({ error: "Failed to load locations." }); }
});

router.post("/locations", async (req, res) => {
  const { location_name, city, state, country, location_type } = req.body;
  try {
    const r = await execute(
      `INSERT INTO location (location_name, city, state, country, location_type)
       VALUES (:name, :city, :state, :country, :type) RETURNING location_id INTO :id`,
      {
        name:    location_name,
        city,
        state,
        country: country || "India",
        type:    location_type,
        id:      { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true }
    );
    return res.status(201).json({ id: r.outBinds.id[0], success: true });
  } catch (err) {
    console.error("Create location error:", err);
    return res.status(500).json({ error: "Failed to create location." });
  }
});

router.put("/locations/:id", async (req, res) => {
  const { location_name, city, state, country, location_type } = req.body;
  try {
    await execute(
      `UPDATE location SET location_name=:name, city=:city, state=:state,
              country=:country, location_type=:type WHERE location_id=:id`,
      { name: location_name, city, state, country: country || "India",
        type: location_type, id: Number(req.params.id) },
      { autoCommit: true }
    );
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ error: "Failed to update location." }); }
});

router.delete("/locations/:id", async (req, res) => {
  try {
    await execute(`DELETE FROM location WHERE location_id=:id`,
      { id: Number(req.params.id) }, { autoCommit: true });
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ error: "Cannot delete — check for dependent routes." }); }
});

// ─── VEHICLES ─────────────────────────────────────────────────────────────────
// New schema: seat_fare column added, status: active/inactive only

router.get("/vehicles", async (req, res) => {
  try {
    const r = await execute(
      `SELECT v.vehicle_id AS id, v.vehicle_number, v.vehicle_name,
              v.total_seats, v.seat_fare, v.status,
              v.mode_id, v.operator_id, tm.mode_name, op.operator_name
         FROM vehicle v
         JOIN travel_mode tm ON v.mode_id     = tm.mode_id
         JOIN operator op    ON v.operator_id = op.operator_id
        ORDER BY v.vehicle_id`
    );
    return res.json(r.rows.map(row => ({
      id:             row.ID,
      vehicle_number: row.VEHICLE_NUMBER,
      vehicle_name:   row.VEHICLE_NAME,
      total_seats:    row.TOTAL_SEATS,
      seat_fare:      row.SEAT_FARE,
      status:         row.STATUS,
      mode_id:        row.MODE_ID,
      mode_name:      row.MODE_NAME,
      operator_id:    row.OPERATOR_ID,
      operator_name:  row.OPERATOR_NAME,
    })));
  } catch (err) { return res.status(500).json({ error: "Failed to load vehicles." }); }
});

router.post("/vehicles", async (req, res) => {
  const { mode_id, operator_id, vehicle_number, vehicle_name, total_seats, seat_fare, status } = req.body;
  // Use stored procedure (upsert_vehicle) per oracle_queries.sql
  try {
    await execute(
      `BEGIN upsert_vehicle(:vid, :mid, :oid, :vnum, :vname, :seats, :fare, :stat); END;`,
      {
        vid:   null,  // null triggers INSERT path in upsert proc
        mid:   Number(mode_id),
        oid:   Number(operator_id),
        vnum:  vehicle_number,
        vname: vehicle_name,
        seats: Number(total_seats),
        fare:  Number(seat_fare || 0),
        stat:  status || "active",
      },
      { autoCommit: true }
    );
    // Fetch back the newly inserted vehicle
    const latest = await execute(
      `SELECT vehicle_id AS id FROM vehicle WHERE vehicle_number = :vnum ORDER BY vehicle_id DESC FETCH FIRST 1 ROWS ONLY`,
      { vnum: vehicle_number }
    );
    return res.status(201).json({ id: latest.rows[0]?.ID, success: true });
  } catch (err) {
    console.error("Create vehicle error:", err);
    // Fallback: direct INSERT if stored proc not found
    try {
      const r = await execute(
        `INSERT INTO vehicle (mode_id, operator_id, vehicle_number, vehicle_name, total_seats, seat_fare, status)
         VALUES (:mid, :oid, :vnum, :vname, :seats, :fare, :stat) RETURNING vehicle_id INTO :id`,
        {
          mid:  Number(mode_id), oid: Number(operator_id),
          vnum: vehicle_number,  vname: vehicle_name,
          seats: Number(total_seats), fare: Number(seat_fare || 0),
          stat: status || "active",
          id:   { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
        { autoCommit: true }
      );
      return res.status(201).json({ id: r.outBinds.id[0], success: true });
    } catch (err2) {
      return res.status(500).json({ error: "Failed to create vehicle." });
    }
  }
});

router.put("/vehicles/:id", async (req, res) => {
  const { mode_id, operator_id, vehicle_number, vehicle_name, total_seats, seat_fare, status } = req.body;
  try {
    await execute(
      `BEGIN upsert_vehicle(:vid, :mid, :oid, :vnum, :vname, :seats, :fare, :stat); END;`,
      {
        vid:   Number(req.params.id),
        mid:   Number(mode_id),
        oid:   Number(operator_id),
        vnum:  vehicle_number,
        vname: vehicle_name,
        seats: Number(total_seats),
        fare:  Number(seat_fare || 0),
        stat:  status,
      },
      { autoCommit: true }
    );
    return res.json({ success: true });
  } catch (err) {
    // Fallback
    try {
      await execute(
        `UPDATE vehicle SET mode_id=:mid, operator_id=:oid, vehicle_number=:vnum,
                vehicle_name=:vname, total_seats=:seats, seat_fare=:fare, status=:stat
          WHERE vehicle_id=:id`,
        {
          mid: Number(mode_id), oid: Number(operator_id), vnum: vehicle_number,
          vname: vehicle_name, seats: Number(total_seats), fare: Number(seat_fare || 0),
          stat: status, id: Number(req.params.id),
        },
        { autoCommit: true }
      );
      return res.json({ success: true });
    } catch (err2) {
      return res.status(500).json({ error: "Failed to update vehicle." });
    }
  }
});

router.delete("/vehicles/:id", async (req, res) => {
  try {
    await execute(`DELETE FROM vehicle WHERE vehicle_id=:id`,
      { id: Number(req.params.id) }, { autoCommit: true });
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ error: "Failed to delete vehicle." }); }
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────
// New schema: no total_distance_km/total_duration_min on route.
// route_stop now has arrival_datetime/departure_datetime (not offset fields).
// schedule.status: active/inactive.

router.get("/routes", async (req, res) => {
  try {
    const routeRes = await execute(
      `SELECT r.route_id AS id, r.route_name, r.mode_id, r.operator_id,
              r.start_location_id, r.end_location_id,
              tm.mode_name AS mode_type, op.operator_name,
              l1.location_name AS origin_name,
              l2.location_name AS destination_name
         FROM route r
         JOIN travel_mode tm ON r.mode_id           = tm.mode_id
         JOIN operator op    ON r.operator_id        = op.operator_id
         JOIN location l1    ON r.start_location_id = l1.location_id
         JOIN location l2    ON r.end_location_id   = l2.location_id
        ORDER BY r.route_id`
    );

    const routes = await Promise.all(routeRes.rows.map(async (row) => {
      const [stopsRes, schedRes] = await Promise.all([
        execute(
          `SELECT rs.route_stop_id, rs.location_id, rs.stop_sequence,
                  rs.arrival_datetime, rs.departure_datetime,
                  loc.location_name, loc.city
             FROM route_stop rs JOIN location loc ON rs.location_id = loc.location_id
            WHERE rs.route_id = :rid ORDER BY rs.stop_sequence`,
          { rid: row.ID }
        ),
        execute(
          `SELECT vehicle_id, departure_datetime, arrival_datetime, status, schedule_id
             FROM schedule WHERE route_id = :rid
            ORDER BY departure_datetime DESC FETCH FIRST 1 ROWS ONLY`,
          { rid: row.ID }
        ),
      ]);
      const sched = schedRes.rows[0];
      return {
        id:               row.ID,
        route_name:       row.ROUTE_NAME,
        mode_id:          row.MODE_ID,
        mode_type:        row.MODE_TYPE,
        operator_id:      row.OPERATOR_ID,
        operator_name:    row.OPERATOR_NAME,
        origin:           row.START_LOCATION_ID,
        origin_name:      row.ORIGIN_NAME,
        destination:      row.END_LOCATION_ID,
        destination_name: row.DESTINATION_NAME,
        // Full datetime fields (new schema)
        departureDateTime: sched ? toIso(sched.DEPARTURE_DATETIME) : "",
        arrivalDateTime:   sched ? toIso(sched.ARRIVAL_DATETIME) : "",
        // Legacy time-only fields for backwards compat
        departureTime:     sched ? (sched.DEPARTURE_DATETIME ? new Date(sched.DEPARTURE_DATETIME).toTimeString().slice(0,5) : "") : "",
        arrivalTime:       sched ? (sched.ARRIVAL_DATETIME ? new Date(sched.ARRIVAL_DATETIME).toTimeString().slice(0,5) : "") : "",
        vehicle_id:        sched?.VEHICLE_ID || "",
        status:            sched?.STATUS || "active",
        intermediateStops: stopsRes.rows.map(s => ({
          route_stop_id:     s.ROUTE_STOP_ID,
          location_id:       s.LOCATION_ID,
          location_name:     s.LOCATION_NAME,
          arrivalDateTime:   toIso(s.ARRIVAL_DATETIME),
          departureDateTime: toIso(s.DEPARTURE_DATETIME),
        })),
      };
    }));

    return res.json(routes);
  } catch (err) {
    console.error("Get routes error:", err);
    return res.status(500).json({ error: "Failed to load routes." });
  }
});

router.post("/routes", async (req, res) => {
  const {
    mode_id, operator_id, origin, destination,
    departureDateTime, arrivalDateTime, vehicle_id,
    intermediateStops = [], status = "active",
  } = req.body;

  let conn;
  try {
    conn = await getConnection();

    // Build route name from location names
    const locRes = await conn.execute(
      `SELECT location_id, city FROM location WHERE location_id IN (:s, :e)`,
      { s: Number(origin), e: Number(destination) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const cityMap = {};
    locRes.rows.forEach(r => { cityMap[r.LOCATION_ID] = r.CITY; });
    const routeName = `${cityMap[Number(origin)] || origin} - ${cityMap[Number(destination)] || destination}`;

    // Insert route (no distance/duration columns in new schema)
    const rRes = await conn.execute(
      `INSERT INTO route (route_name, mode_id, operator_id, start_location_id, end_location_id)
       VALUES (:rn, :mid, :oid, :slid, :elid) RETURNING route_id INTO :rid`,
      {
        rn:   routeName,
        mid:  Number(mode_id),
        oid:  Number(operator_id),
        slid: Number(origin),
        elid: Number(destination),
        rid:  { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const routeId = rRes.outBinds.rid[0];

    // Insert intermediate stops with arrival_datetime/departure_datetime
    for (let i = 0; i < intermediateStops.length; i++) {
      const stop = intermediateStops[i];
      await conn.execute(
        `INSERT INTO route_stop
           (route_id, location_id, stop_sequence,
            arrival_datetime, departure_datetime)
         VALUES (:rid, :lid, :seq,
                 TO_TIMESTAMP(:arr, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                 TO_TIMESTAMP(:dep, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))`,
        {
          rid: routeId,
          lid: Number(stop.location_id),
          seq: i + 1,
          arr: stop.arrivalDateTime   ? stop.arrivalDateTime.replace("T", " ").slice(0, 19) : null,
          dep: stop.departureDateTime ? stop.departureDateTime.replace("T", " ").slice(0, 19) : null,
        }
      );
    }

    // Insert schedule
    if (departureDateTime && arrivalDateTime && vehicle_id) {
      await conn.execute(
        `INSERT INTO schedule (vehicle_id, route_id, departure_datetime, arrival_datetime,
                base_fare, seats_remaining, status)
         VALUES (:vid, :rid,
                 TO_TIMESTAMP(:dep, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                 TO_TIMESTAMP(:arr, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                 (SELECT seat_fare FROM vehicle WHERE vehicle_id = :vid),
                 (SELECT total_seats FROM vehicle WHERE vehicle_id = :vid),
                 :stat)`,
        {
          vid:  Number(vehicle_id),
          rid:  routeId,
          dep:  departureDateTime.replace("T", " ").slice(0, 19),
          arr:  arrivalDateTime.replace("T", " ").slice(0, 19),
          stat: status,
        }
      );
    }

    await conn.commit();
    return res.status(201).json({ id: routeId, success: true });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch (_) {}
    console.error("Create route error:", err);
    return res.status(500).json({ error: "Failed to create route." });
  } finally {
    if (conn) try { await conn.close(); } catch (_) {}
  }
});

router.put("/routes/:id", async (req, res) => {
  const routeId = Number(req.params.id);
  const {
    mode_id, operator_id, origin, destination,
    departureDateTime, arrivalDateTime, vehicle_id,
    intermediateStops = [], status,
  } = req.body;

  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      `UPDATE route SET mode_id=:mid, operator_id=:oid,
              start_location_id=:slid, end_location_id=:elid
        WHERE route_id=:rid`,
      { mid: Number(mode_id), oid: Number(operator_id),
        slid: Number(origin), elid: Number(destination), rid: routeId }
    );

    // Replace stops
    await conn.execute(`DELETE FROM route_stop WHERE route_id=:rid`, { rid: routeId });
    for (let i = 0; i < intermediateStops.length; i++) {
      const stop = intermediateStops[i];
      await conn.execute(
        `INSERT INTO route_stop
           (route_id, location_id, stop_sequence,
            arrival_datetime, departure_datetime)
         VALUES (:rid, :lid, :seq,
                 TO_TIMESTAMP(:arr, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                 TO_TIMESTAMP(:dep, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))`,
        {
          rid: routeId, lid: Number(stop.location_id), seq: i + 1,
          arr: stop.arrivalDateTime   ? stop.arrivalDateTime.replace("T", " ").slice(0, 19) : null,
          dep: stop.departureDateTime ? stop.departureDateTime.replace("T", " ").slice(0, 19) : null,
        }
      );
    }

    // Update schedule
    if (departureDateTime && arrivalDateTime && vehicle_id) {
      await conn.execute(
        `UPDATE schedule
            SET departure_datetime = TO_TIMESTAMP(:dep, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                arrival_datetime   = TO_TIMESTAMP(:arr, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                vehicle_id = :vid,
                status = :stat
          WHERE route_id = :rid`,
        {
          dep:  departureDateTime.replace("T", " ").slice(0, 19),
          arr:  arrivalDateTime.replace("T", " ").slice(0, 19),
          vid:  Number(vehicle_id),
          stat: status || "active",
          rid:  routeId,
        }
      );
    }

    await conn.commit();
    return res.json({ success: true });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch (_) {}
    return res.status(500).json({ error: "Failed to update route." });
  } finally {
    if (conn) try { await conn.close(); } catch (_) {}
  }
});

router.delete("/routes/:id", async (req, res) => {
  try {
    await execute(`DELETE FROM route WHERE route_id=:id`,
      { id: Number(req.params.id) }, { autoCommit: true });
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ error: "Failed to delete route." }); }
});

module.exports = router;
