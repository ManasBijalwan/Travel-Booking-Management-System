const express = require("express");
const oracledb = require("oracledb");
const { execute, getConnection } = require("../db");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate, requireAdmin);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function toTimePart(dt) {
  if (!dt) return "";
  const d = dt instanceof Date ? dt : new Date(dt);
  return d.toTimeString().slice(0, 5);
}

function toDatePart(dt) {
  if (!dt) return "";
  const d = dt instanceof Date ? dt : new Date(dt);
  return d.toISOString().slice(0, 10);
}

// The DB CHECK constraint uses: 'station' | 'airport' | 'bus_stop'
// The frontend sends: 'Railway Station' | 'Airport' | 'Bus Stand'
const LOCATION_TYPE_TO_DB = {
  "Railway Station": "station",
  "Airport":         "airport",
  "Bus Stand":       "bus_stop",
  // pass-through if already in DB format
  "station":  "station",
  "airport":  "airport",
  "bus_stop": "bus_stop",
};
const LOCATION_TYPE_TO_DISPLAY = {
  "station":  "Railway Station",
  "airport":  "Airport",
  "bus_stop": "Bus Stand",
};

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

    const [recentBookings, recentPayments] = await Promise.all([
      conn.execute(
        `SELECT b.booking_id, b.booking_status, b.total_amount,
                l1.city AS origin, l2.city AS destination
           FROM BOOKING b
           JOIN SCHEDULE s  ON b.schedule_id          = s.schedule_id
           JOIN ROUTE r     ON s.route_id             = r.route_id
           JOIN LOCATION l1 ON b.boarding_location_id = l1.location_id
           JOIN LOCATION l2 ON b.dropping_location_id = l2.location_id
          ORDER BY b.booking_date DESC
          FETCH FIRST 10 ROWS ONLY`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      ),
      conn.execute(
        `SELECT payment_id, booking_id, payment_method, payment_status, amount_paid
           FROM PAYMENT ORDER BY payment_date DESC FETCH FIRST 10 ROWS ONLY`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
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
      bookings: recentBookings.rows.map((r) => ({
        id: r.BOOKING_ID,
        status: r.BOOKING_STATUS,
        totalAmountLabel: formatCurrency(r.TOTAL_AMOUNT),
        travel: { origin: r.ORIGIN, destination: r.DESTINATION },
      })),
      payments: recentPayments.rows.map((r) => ({
        id: r.PAYMENT_ID,
        bookingId: r.BOOKING_ID,
        method: r.PAYMENT_METHOD,
        status: r.PAYMENT_STATUS,
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

router.get("/operators", async (req, res) => {
  try {
    const r = await execute(
      `SELECT o.operator_id AS id, o.operator_name, o.mode_id,
              tm.mode_name, o.contact_email, o.contact_phone
         FROM OPERATOR o JOIN TRAVEL_MODE tm ON o.mode_id = tm.mode_id
        ORDER BY o.operator_id`
    );
    return res.json(r.rows.map((row) => ({
      id:             row.ID,
      operator_name:  row.OPERATOR_NAME,
      mode_id:        row.MODE_ID,
      mode_name:      row.MODE_NAME,
      contact_email:  row.CONTACT_EMAIL,
      contact_phone:  row.CONTACT_PHONE,
    })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load operators." });
  }
});

router.post("/operators", async (req, res) => {
  const { operator_name, mode_id, contact_email, contact_phone } = req.body;
  try {
    const r = await execute(
      `INSERT INTO OPERATOR (operator_name, mode_id, contact_email, contact_phone)
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
    return res.status(201).json({ id: r.outBinds.id[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create operator." });
  }
});

router.put("/operators/:id", async (req, res) => {
  const { operator_name, mode_id, contact_email, contact_phone } = req.body;
  try {
    await execute(
      `UPDATE OPERATOR SET operator_name=:name, mode_id=:mid,
              contact_email=:email, contact_phone=:phone
        WHERE operator_id=:id`,
      {
        name:  operator_name,
        mid:   Number(mode_id),
        email: contact_email || null,
        phone: contact_phone || null,
        id:    Number(req.params.id),
      },
      { autoCommit: true }
    );
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update operator." });
  }
});

router.delete("/operators/:id", async (req, res) => {
  try {
    await execute(
      `DELETE FROM OPERATOR WHERE operator_id=:id`,
      { id: Number(req.params.id) },
      { autoCommit: true }
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete operator." });
  }
});

// ─── LOCATIONS ────────────────────────────────────────────────────────────────

router.get("/locations", async (req, res) => {
  try {
    const r = await execute(
      `SELECT location_id AS id, location_name, city, state, location_type
         FROM LOCATION ORDER BY location_id`
    );
    return res.json(r.rows.map((row) => ({
      id:            row.ID,
      location_name: row.LOCATION_NAME,
      city:          row.CITY,
      state:         row.STATE,
      // Convert DB values back to display labels for the frontend
      location_type: LOCATION_TYPE_TO_DISPLAY[row.LOCATION_TYPE] || row.LOCATION_TYPE,
    })));
  } catch (err) {
    return res.status(500).json({ error: "Failed to load locations." });
  }
});

router.post("/locations", async (req, res) => {
  const { location_name, city, state, location_type } = req.body;
  const dbType = LOCATION_TYPE_TO_DB[location_type];
  if (!dbType) {
    return res.status(400).json({ error: `Invalid location_type: ${location_type}` });
  }
  try {
    const r = await execute(
      `INSERT INTO LOCATION (location_name, city, state, location_type)
       VALUES (:name, :city, :state, :type) RETURNING location_id INTO :id`,
      {
        name:  location_name,
        city,
        state,
        type:  dbType,
        id:    { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true }
    );
    return res.status(201).json({ id: r.outBinds.id[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create location." });
  }
});

router.put("/locations/:id", async (req, res) => {
  const { location_name, city, state, location_type } = req.body;
  const dbType = LOCATION_TYPE_TO_DB[location_type];
  if (!dbType) {
    return res.status(400).json({ error: `Invalid location_type: ${location_type}` });
  }
  try {
    await execute(
      `UPDATE LOCATION SET location_name=:name, city=:city,
              state=:state, location_type=:type WHERE location_id=:id`,
      { name: location_name, city, state, type: dbType, id: Number(req.params.id) },
      { autoCommit: true }
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update location." });
  }
});

router.delete("/locations/:id", async (req, res) => {
  try {
    await execute(
      `DELETE FROM LOCATION WHERE location_id=:id`,
      { id: Number(req.params.id) },
      { autoCommit: true }
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({
      error: "Cannot delete location — it may be used by existing routes.",
    });
  }
});

// ─── VEHICLES ─────────────────────────────────────────────────────────────────

router.get("/vehicles", async (req, res) => {
  try {
    const r = await execute(
      `SELECT v.vehicle_id AS id, v.vehicle_number, v.vehicle_name,
              v.total_seats, v.status, v.mode_id, v.operator_id,
              tm.mode_name, op.operator_name
         FROM VEHICLE v
         JOIN TRAVEL_MODE tm ON v.mode_id      = tm.mode_id
         JOIN OPERATOR op    ON v.operator_id   = op.operator_id
        ORDER BY v.vehicle_id`
    );
    return res.json(r.rows.map((row) => ({
      id:             row.ID,
      vehicle_number: row.VEHICLE_NUMBER,
      vehicle_name:   row.VEHICLE_NAME,
      total_seats:    row.TOTAL_SEATS,
      status:         row.STATUS,
      mode_id:        row.MODE_ID,
      mode_name:      row.MODE_NAME,
      operator_id:    row.OPERATOR_ID,
      operator_name:  row.OPERATOR_NAME,
    })));
  } catch (err) {
    return res.status(500).json({ error: "Failed to load vehicles." });
  }
});

router.post("/vehicles", async (req, res) => {
  const { mode_id, operator_id, vehicle_number, vehicle_name, total_seats, status } = req.body;
  try {
    const r = await execute(
      `INSERT INTO VEHICLE (mode_id, operator_id, vehicle_number, vehicle_name, total_seats, status)
       VALUES (:mid, :oid, :vnum, :vname, :seats, :stat) RETURNING vehicle_id INTO :id`,
      {
        mid:   Number(mode_id),
        oid:   Number(operator_id),
        vnum:  vehicle_number,
        vname: vehicle_name,
        seats: Number(total_seats),
        stat:  status || "active",
        id:    { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true }
    );
    return res.status(201).json({ id: r.outBinds.id[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create vehicle." });
  }
});

router.put("/vehicles/:id", async (req, res) => {
  const { mode_id, operator_id, vehicle_number, vehicle_name, total_seats, status } = req.body;
  try {
    await execute(
      `UPDATE VEHICLE SET mode_id=:mid, operator_id=:oid, vehicle_number=:vnum,
              vehicle_name=:vname, total_seats=:seats, status=:stat
        WHERE vehicle_id=:id`,
      {
        mid:   Number(mode_id),
        oid:   Number(operator_id),
        vnum:  vehicle_number,
        vname: vehicle_name,
        seats: Number(total_seats),
        stat:  status,
        id:    Number(req.params.id),
      },
      { autoCommit: true }
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update vehicle." });
  }
});

router.delete("/vehicles/:id", async (req, res) => {
  try {
    await execute(
      `DELETE FROM VEHICLE WHERE vehicle_id=:id`,
      { id: Number(req.params.id) },
      { autoCommit: true }
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete vehicle." });
  }
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────

router.get("/routes", async (req, res) => {
  try {
    const routeRes = await execute(
      `SELECT r.route_id AS id, r.route_name, r.mode_id, r.operator_id,
              r.start_location_id, r.end_location_id,
              tm.mode_name AS mode_type, op.operator_name,
              l1.location_name AS origin_name,
              l2.location_name AS destination_name
         FROM ROUTE r
         JOIN TRAVEL_MODE tm ON r.mode_id           = tm.mode_id
         JOIN OPERATOR op    ON r.operator_id        = op.operator_id
         JOIN LOCATION l1    ON r.start_location_id = l1.location_id
         JOIN LOCATION l2    ON r.end_location_id   = l2.location_id
        ORDER BY r.route_id`
    );

    const routes = await Promise.all(
      routeRes.rows.map(async (row) => {
        const [stopsRes, schedRes] = await Promise.all([
          execute(
            `SELECT rs.route_stop_id, rs.location_id,
                    loc.location_name, loc.city
               FROM ROUTE_STOP rs
               JOIN LOCATION loc ON rs.location_id = loc.location_id
              WHERE rs.route_id = :rid
              ORDER BY rs.stop_sequence`,
            { rid: row.ID }
          ),
          execute(
            `SELECT vehicle_id, departure_datetime, arrival_datetime, status
               FROM SCHEDULE WHERE route_id = :rid
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
          departureTime:    sched ? toTimePart(sched.DEPARTURE_DATETIME) : "",
          arrivalTime:      sched ? toTimePart(sched.ARRIVAL_DATETIME) : "",
          bookingStartDate: sched ? toDatePart(sched.DEPARTURE_DATETIME) : "",
          bookingEndDate:   "",
          vehicle_id:       sched?.VEHICLE_ID || "",
          status:           sched?.STATUS || "scheduled",
          serviceDays:      [],
          intermediateStops: stopsRes.rows.map((s) => ({
            route_stop_id: s.ROUTE_STOP_ID,
            location_id:   s.LOCATION_ID,
            location_name: s.LOCATION_NAME,
            arrival_time:  "",
            departure_time: "",
          })),
        };
      })
    );

    return res.json(routes);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load routes." });
  }
});

router.post("/routes", async (req, res) => {
  const {
    mode_id, operator_id, origin, destination,
    departureTime, arrivalTime, vehicle_id,
    bookingStartDate, intermediateStops = [], status = "scheduled",
  } = req.body;

  let conn;
  try {
    conn = await getConnection();

    // Build route name from city names
    const locRes = await conn.execute(
      `SELECT location_id, city FROM LOCATION WHERE location_id IN (:s, :e)`,
      { s: Number(origin), e: Number(destination) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const cityMap = {};
    locRes.rows.forEach((r) => { cityMap[r.LOCATION_ID] = r.CITY; });
    const routeName =
      `${cityMap[Number(origin)] || origin} - ${cityMap[Number(destination)] || destination}`;

    // Insert route
    const rRes = await conn.execute(
      `INSERT INTO ROUTE
         (route_name, mode_id, operator_id, start_location_id, end_location_id,
          total_distance_km, total_duration_min)
       VALUES (:rn, :mid, :oid, :slid, :elid, 0, 0)
       RETURNING route_id INTO :rid`,
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

    // Insert intermediate stops
    for (let i = 0; i < intermediateStops.length; i++) {
      await conn.execute(
        `INSERT INTO ROUTE_STOP
           (route_id, location_id, stop_sequence,
            arrival_offset_min, departure_offset_min, halt_minutes)
         VALUES (:rid, :lid, :seq, 0, 0, 0)`,
        { rid: routeId, lid: Number(intermediateStops[i].location_id), seq: i + 1 }
      );
    }

    // Insert schedule if times provided
    if (bookingStartDate && departureTime && arrivalTime && vehicle_id) {
      await conn.execute(
        `INSERT INTO SCHEDULE
           (vehicle_id, route_id, departure_datetime, arrival_datetime,
            base_fare, seats_remaining, status)
         VALUES (:vid, :rid,
                 TO_TIMESTAMP(:dep, 'YYYY-MM-DD HH24:MI'),
                 TO_TIMESTAMP(:arr, 'YYYY-MM-DD HH24:MI'),
                 0,
                 (SELECT total_seats FROM VEHICLE WHERE vehicle_id = :vid),
                 :stat)`,
        {
          vid:  Number(vehicle_id),
          rid:  routeId,
          dep:  `${bookingStartDate} ${departureTime}`,
          arr:  `${bookingStartDate} ${arrivalTime}`,
          stat: status,
        }
      );
    }

    await conn.commit();
    return res.status(201).json({ id: routeId });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch (_) {}
    console.error(err);
    return res.status(500).json({ error: "Failed to create route." });
  } finally {
    if (conn) try { await conn.close(); } catch (_) {}
  }
});

router.put("/routes/:id", async (req, res) => {
  const routeId = Number(req.params.id);
  const {
    mode_id, operator_id, origin, destination,
    departureTime, arrivalTime, vehicle_id,
    bookingStartDate, intermediateStops = [], status,
  } = req.body;

  let conn;
  try {
    conn = await getConnection();

    await conn.execute(
      `UPDATE ROUTE SET mode_id=:mid, operator_id=:oid,
              start_location_id=:slid, end_location_id=:elid
        WHERE route_id=:rid`,
      {
        mid:  Number(mode_id),
        oid:  Number(operator_id),
        slid: Number(origin),
        elid: Number(destination),
        rid:  routeId,
      }
    );

    // Replace stops
    await conn.execute(`DELETE FROM ROUTE_STOP WHERE route_id=:rid`, { rid: routeId });
    for (let i = 0; i < intermediateStops.length; i++) {
      await conn.execute(
        `INSERT INTO ROUTE_STOP
           (route_id, location_id, stop_sequence,
            arrival_offset_min, departure_offset_min, halt_minutes)
         VALUES (:rid, :lid, :seq, 0, 0, 0)`,
        { rid: routeId, lid: Number(intermediateStops[i].location_id), seq: i + 1 }
      );
    }

    // Update schedule
    if (departureTime && arrivalTime && bookingStartDate && vehicle_id) {
      await conn.execute(
        `UPDATE SCHEDULE
            SET departure_datetime = TO_TIMESTAMP(:dep, 'YYYY-MM-DD HH24:MI'),
                arrival_datetime   = TO_TIMESTAMP(:arr, 'YYYY-MM-DD HH24:MI'),
                vehicle_id         = :vid,
                status             = :stat
          WHERE route_id = :rid`,
        {
          dep:  `${bookingStartDate} ${departureTime}`,
          arr:  `${bookingStartDate} ${arrivalTime}`,
          vid:  Number(vehicle_id),
          stat: status || "scheduled",
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
    // CASCADE on ROUTE_STOP and SCHEDULE handles children
    await execute(
      `DELETE FROM ROUTE WHERE route_id=:id`,
      { id: Number(req.params.id) },
      { autoCommit: true }
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete route." });
  }
});

module.exports = router;
