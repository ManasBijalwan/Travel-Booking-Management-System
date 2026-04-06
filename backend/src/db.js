const oracledb = require("oracledb");

// Use THIN mode — no Oracle Client installation needed
oracledb.initOracleClient(); // remove this line if using Thin mode exclusively

// Output format: objects instead of arrays
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// Auto-commit OFF globally — we manage commits inside PL/SQL procedures
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

/**
 * Execute a SQL query or PL/SQL block.
 * @param {string} sql
 * @param {object|Array} binds  - bind parameters
 * @param {object} opts         - extra oracledb execute options
 */
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

/**
 * Execute with an explicit connection — used when you need to read
 * a SYS_REFCURSOR OUT parameter returned by a stored procedure.
 */
async function executeWithConn(sql, binds = {}, opts = {}) {
  const conn = await pool.getConnection();
  return { conn, execute: () => conn.execute(sql, binds, opts) };
}

/**
 * Read all rows from a SYS_REFCURSOR returned as an OUT bind.
 * Caller must close the cursor and connection after.
 */
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
