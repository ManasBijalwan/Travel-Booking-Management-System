require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { initPool } = require("./db");

const authRoutes         = require("./routes/auth");
const travelsRoutes      = require("./routes/travels");
const bookingsRoutes     = require("./routes/bookings");
const cancellationsRoutes = require("./routes/cancellations");
const adminRoutes        = require("./routes/admin");
const adminExtraRoutes   = require("./routes/adminExtra");

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
}));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth",          authRoutes);
app.use("/api/travels",       travelsRoutes);
app.use("/api/bookings",      bookingsRoutes);
app.use("/api/cancellations", cancellationsRoutes);

// Admin routes - both files mounted at /api/admin
// admin.js:      overview, operators, locations, vehicles, routes
// adminExtra.js: bookings, payments, cancellations, form-options
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminExtraRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Endpoint not found." }));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error." });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;

(async () => {
  try {
    await initPool();
    app.listen(PORT, () => {
      console.log(`TravelSphere backend running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
})();
