const app       = require("./app");
const connectDB = require("./src/db/db");
require("dotenv").config();

const PORT = process.env.PORT || 3000;

async function start() {
    await connectDB();

    const server = app.listen(PORT, () => {
        console.log(`HostelCare server running on port ${PORT}`);
    });

    // ─── Graceful Shutdown ────────────────────────────────────────────────────
    // Handles SIGTERM (sent by Docker/K8s/PM2 on stop) and SIGINT (Ctrl+C).
    // Stops accepting new connections, waits for in-flight requests to finish,
    // then cleanly closes the MongoDB connection.
    // Without this, a restart drops in-flight requests mid-response.
    function gracefulShutdown(signal) {
        console.log(`Received ${signal}. Closing server…`);
        server.close(() => {
            console.log("HTTP server closed. Disconnecting from MongoDB…");
            const mongoose = require("mongoose");
            mongoose.connection.close(false).then(() => {
                console.log("MongoDB connection closed. Process exiting.");
                process.exit(0);
            });
        });

        // Force-exit after 10s if connections won't drain
        setTimeout(() => {
            console.error("Graceful shutdown timed out. Forcing exit.");
            process.exit(1);
        }, 10_000);
    }

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT",  () => gracefulShutdown("SIGINT"));
}

start().catch((err) => {
    console.error("Failed to start server:", err.message);
    process.exit(1);
});