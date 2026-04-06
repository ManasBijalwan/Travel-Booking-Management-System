const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { execute } = require("../db");

const router = express.Router();

function makeToken(user) {
  return jwt.sign(
    { id: user.USER_ID, user_id: user.USER_ID, role: user.ROLE },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );
}

function mapUser(row) {
  return {
    id: row.USER_ID,
    user_id: row.USER_ID,
    name: row.FULL_NAME,
    full_name: row.FULL_NAME,
    email: row.EMAIL,
    phone: row.PHONE,
    role: row.ROLE,
    status: row.STATUS,
  };
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { user_id, password, role } = req.body;
    if (!user_id || !password) {
      return res.status(400).json({ error: "user_id and password are required." });
    }

    const result = await execute(
      `SELECT user_id, full_name, email, phone, password_hash, role, status
         FROM USERS WHERE user_id = :uid`,
      { uid: user_id }
    );

    const row = result.rows?.[0];
    if (!row) {
      return res.status(401).json({ error: "Invalid user ID or password." });
    }

    if (row.STATUS !== "active") {
      return res.status(403).json({ error: "Account is inactive." });
    }

    const match = await bcrypt.compare(password, row.PASSWORD_HASH);
    if (!match) {
      return res.status(401).json({ error: "Invalid user ID or password." });
    }

    // Role enforcement (admin vs user login pages)
    if (role && row.ROLE !== role) {
      const msg =
        role === "admin"
          ? "Use the admin login for administrative access."
          : "Use the user login for customer bookings.";
      return res.status(403).json({ error: msg });
    }

    const user = mapUser(row);
    const token = makeToken(row);
    return res.json({ token, user });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed." });
  }
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { user_id, full_name, email, phone, password } = req.body;

    if (!user_id || !full_name || !email || !password) {
      return res.status(400).json({ error: "user_id, full_name, email, and password are required." });
    }
    if (!/^[A-Za-z0-9]+$/.test(String(user_id).trim())) {
      return res.status(400).json({ error: "user_id must be alphanumeric." });
    }

    // Check uniqueness
    const exists = await execute(
      `SELECT COUNT(*) AS cnt FROM USERS WHERE user_id = :uid OR email = :email`,
      { uid: user_id, email }
    );
    if (exists.rows[0].CNT > 0) {
      return res.status(409).json({ error: "user_id or email already in use." });
    }

    const hash = await bcrypt.hash(password, 10);

    await execute(
      `INSERT INTO USERS (user_id, full_name, email, phone, password_hash, role, status)
       VALUES (:uid, :name, :email, :phone, :hash, 'user', 'active')`,
      { uid: user_id, name: full_name, email, phone: phone || null, hash },
      { autoCommit: true }
    );

    // Fetch back the created user
    const created = await execute(
      `SELECT user_id, full_name, email, phone, role, status FROM USERS WHERE user_id = :uid`,
      { uid: user_id }
    );
    const user = mapUser(created.rows[0]);
    const token = makeToken(created.rows[0]);
    return res.status(201).json({ token, user });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Registration failed." });
  }
});

module.exports = router;
