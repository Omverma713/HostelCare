const express        = require("express");
const compression    = require("compression");
const rateLimit      = require("express-rate-limit");

const complaintRouter = require("./src/routes/complaints.router");
const UserRouters     = require("./src/routes/user.route");

const app = express();

// ─── 1. Compression ───────────────────────────────────────────────────────────
// Compresses JSON responses with gzip/deflate. Justified because complaint list
// payloads can be large. Reduces network bandwidth and send latency.
app.use(compression());

// ─── 2. Body Parser ───────────────────────────────────────────────────────────
// Limit request body to 50 KB — no legitimate complaint submission needs more.
// Prevents memory exhaustion from oversized payloads.
app.use(express.json({ limit: "50kb" }));

// ─── 3. Login Rate Limiter ────────────────────────────────────────────────────
// Applies only to the login endpoint.
// 20 attempts per 15 minutes per IP — prevents brute-force while allowing
// legitimate traffic. Argon2 already serialises concurrent verifications via
// argonLimiter; this outer limit prevents the queue from being overwhelmed at
// the HTTP layer before Argon2 even runs.
const loginLimiter = rateLimit({
    windowMs:         15 * 60 * 1000, // 15 minutes
    max:              20,
    standardHeaders:  true,
    legacyHeaders:    false,
    message:          { success: false, message: "Too many login attempts. Please try again later." },
    skipSuccessfulRequests: false,
});

// ─── 4. Health Endpoint ───────────────────────────────────────────────────────
// Required for load balancers, container orchestrators (Docker healthcheck,
// K8s liveness/readiness probes), and monitoring systems.
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── 5. Routes ────────────────────────────────────────────────────────────────
app.use("/api/v1/complaints", complaintRouter);
app.use("/api/v1/users", loginLimiter, UserRouters);

// ─── 6. Centralized Error Handler ────────────────────────────────────────────
// Express 5 propagates async errors automatically — this handler catches them
// all. Prevents unhandled errors from crashing the process or leaking stack
// traces to clients.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    console.error(`[ERROR] ${req.method} ${req.path} →`, err.message);
    return res.status(status).json({
        success: false,
        message: err.message || "An unexpected error occurred",
    });
});

module.exports = app;