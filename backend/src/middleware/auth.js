const jwt = require("jsonwebtoken");

/**
 * Verify JWT and attach decoded payload to req.user.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided." });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

/**
 * Restrict to admin role only.
 */
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
}

/**
 * Restrict to user role only.
 */
function requireUser(req, res, next) {
  if (req.user?.role !== "user") {
    return res.status(403).json({ error: "User access required." });
  }
  next();
}

module.exports = { authenticate, requireAdmin, requireUser };
