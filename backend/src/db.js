const oracledb = require("oracledb");

oracledb.initOracleClient();
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
  console.log("Oracle connection pool created.");
}

async function execute(sql, binds = {}, opts = {}) {
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      ...opts,
    });
    return result;
  } finally {
    if (conn) await conn.close();
  }
}

async function executeWithConn(sql, binds = {}, opts = {}) {
  const conn = await pool.getConnection();
  return { conn, execute: () => conn.execute(sql, binds, opts) };
}

async function fetchCursor(cursor) {
  const rows = [];
  let row;
  while ((row = await cursor.getRow()) !== null) {
    rows.push(row);
  }
  await cursor.close();
  return rows;
}

module.exports = { initPool, execute, executeWithConn, fetchCursor };
