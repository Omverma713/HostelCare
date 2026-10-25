const express        = require("express");
const cors           = require("cors");
const compression    = require("compression");
const rateLimit      = require("express-rate-limit");

const jwt              = require("jsonwebtoken");
const { recordClientIdentity } = require("./src/utils/clientTracker");

const complaintRouter   = require("./src/routes/complaints.router");
const UserRouters       = require("./src/routes/user.route");
const feedbackRouter    = require("./src/routes/feedback.route");
const superAdminRouter  = require("./src/routes/superAdmin.route");
const appVersionRouter  = require("./src/routes/appVersion.route");
const chatTicketRouter  = require("./src/routes/chatTicket.route");

const app = express();

// Enable trusted reverse proxy header (Cloudflare, AWS ALB, Nginx) for accurate client IP detection
app.set("trust proxy", 1);

// ─── 1. CORS ──────────────────────────────────────────────────────────────────
// Must be the first middleware so CORS headers are set on every response,
// including preflight OPTIONS responses, error responses, and rate-limit
// responses. Placing it after other middleware would leave some responses
// without CORS headers, causing the browser to block them silently.
//
// Express 5 routes OPTIONS through the normal middleware stack, so a single
// app.use(cors(corsOptions)) is sufficient — no separate app.options('*', ...)
// wildcard route is needed.
const corsOptions = {
    origin: [
        "https://hostelcare.omverma-dev.workers.dev", // Cloudflare production
        "https://hostelcare-api.duckdns.org",          // AWS EC2 via DuckDNS HTTPS
        "http://localhost:5173",                       // Vite dev server
        "https://localhost",                           // Capacitor Android webview
        "http://localhost",
        "capacitor://localhost",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false, // JWT sent in Authorization header, not cookies
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
};
app.use(cors(corsOptions));

// ─── 2. Compression ───────────────────────────────────────────────────────────
// Compresses JSON responses with gzip/deflate. Justified because complaint list
// payloads can be large. Reduces network bandwidth and send latency.
// Exclude APK binaries to prevent chunked transfer encoding that causes mobile Chrome to stall at 100%.
app.use(compression({
    filter: (req, res) => {
        if (req.path.endsWith('.apk') || req.path.includes('/download')) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

// ─── 3. Body Parser ───────────────────────────────────────────────────────────
// Limit request body to 50 KB — no legitimate complaint submission needs more.
// Prevents memory exhaustion from oversized payloads.
app.use(express.json({ limit: "50kb" }));

// ─── 3.1 Client Identity Tracker ──────────────────────────────────────────────
// Maps client IP addresses to active user registration numbers so that legacy APK clients
// (e.g. v1.2.2.0) that do not send auth headers during version checks can be reliably identified
// for targeted pilot testing rollouts.
app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith("Bearer ")) {
        try {
            const decoded = jwt.decode(auth.substring(7).trim());
            if (decoded && (decoded.registrationNumber || decoded.regNo || decoded.username)) {
                const reg = decoded.registrationNumber || decoded.regNo || decoded.username;
                const ip = req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress;
                recordClientIdentity(ip, reg);
            }
        } catch (e) {
            // Ignore token decode errors
        }
    }
    next();
});

// ─── 4. Login Rate Limiter ────────────────────────────────────────────────────
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

// ─── 5. Health & Public Maintenance Endpoints ───────────────────────────────
// Required for load balancers, container orchestrators (Docker healthcheck,
// K8s liveness/readiness probes), and client status checks.
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Public endpoint for clients (web app, mobile app) to query maintenance status
app.get("/api/v1/maintenance/status", async (req, res) => {
    try {
        const SystemConfig = require("./src/models/systemConfig.model");
        const config = await SystemConfig.getEffectiveConfig();
        const maintenance = config.maintenance || {};
        const globalMaint = maintenance.global || { enabled: false };
        const selectiveMaint = maintenance.selective || { enabled: false };

        let activeMode = null;
        if (globalMaint.enabled) {
            activeMode = "global";
        } else if (selectiveMaint.enabled) {
            activeMode = "selective";
        }

        return res.status(200).json({
            success: true,
            activeMode,
            maintenance: {
                global: {
                    enabled: Boolean(globalMaint.enabled),
                    title: globalMaint.title,
                    message: globalMaint.message,
                    plannedStart: globalMaint.plannedStart,
                    plannedEnd: globalMaint.plannedEnd,
                },
                selective: {
                    enabled: Boolean(selectiveMaint.enabled),
                    title: selectiveMaint.title,
                    message: selectiveMaint.message,
                    affectedRoles: selectiveMaint.affectedRoles || [],
                    affectedRegistrationNumbers: selectiveMaint.affectedRegistrationNumbers || [],
                    plannedStart: selectiveMaint.plannedStart,
                    plannedEnd: selectiveMaint.plannedEnd,
                },
            },
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve maintenance status",
            error: err.message,
        });
    }
});

// ─── 6. Global Maintenance Enforcer Middleware ────────────────────────────────
const maintenanceMiddleware = require("./src/middleware/maintenance.middleware");
app.use(maintenanceMiddleware);

const messMenuRouter   = require("./src/routes/messMenu.router");
const { getPublicMessMenu } = require("./src/controllers/messMenu.controller");

// ─── 7. Application Routes ───────────────────────────────────────────────────
app.get("/api/v1/public/mess-menu", getPublicMessMenu);

// Public mess auto-notification schedule query (for mobile and web background alarms)
app.get("/api/v1/public/mess-notifications", async (req, res) => {
    try {
        const { getEffectiveStartTimings, getKolkataTime } = require("./src/services/messReminderScheduler");
        const SystemConfig = require("./src/models/systemConfig.model");
        const config = await SystemConfig.getEffectiveConfig();
        const effectiveTimings = await getEffectiveStartTimings();
        const timeInfo = getKolkataTime();
        return res.status(200).json({
            success: true,
            config: config.messNotificationConfig,
            effectiveTimings,
            serverTime: timeInfo,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve mess notifications schedule",
            error: err.message,
        });
    }
});
app.use("/api/v1/mess-menu", messMenuRouter);
app.use("/api/v1/complaints", complaintRouter);
app.use("/api/v1/users", UserRouters);
app.use("/api/v1/feedback", feedbackRouter);
app.use("/api/v1/superadmin", superAdminRouter);
app.use("/api/v1/app-version", appVersionRouter);
app.use("/api/v1/chat", chatTicketRouter);

// ─── 7. Centralized Error Handler ────────────────────────────────────────────
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