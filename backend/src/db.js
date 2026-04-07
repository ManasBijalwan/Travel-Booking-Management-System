const oracledb = require("oracledb");
if (process.env.USE_THICK_MODE === "true") {
  oracledb.initOracleClient({
    libDir: process.env.ORACLE_CLIENT_LIB || undefined,
  });
  console.log("OracleDB: THICK mode");
} else {
  console.log("OracleDB: THIN mode (no Instant Client needed)");
}

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = false;

let pool;

async function initPool() {
  pool = await oracledb.createPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    poolMin: 2,
    poolMax: 10,
    poolIncrement: 1,
  });
  console.log(`Oracle pool ready → ${process.env.DB_CONNECT_STRING}`);
}

async function execute(sql, binds = {}, opts = {}) {
  let conn;
  try {
    conn = await pool.getConnection();
    return await conn.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      ...opts,
    });
  } finally {
    if (conn) try { await conn.close(); } catch (_) {}
  }
}

async function getConnection() {
  return pool.getConnection();
}

async function fetchCursor(cursor) {
  const rows = [];
  let row;
  while ((row = await cursor.getRow()) !== null) rows.push(row);
  await cursor.close();
  return rows;
}

module.exports = { initPool, execute, getConnection, fetchCursor };
