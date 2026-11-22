const mongoose = require("mongoose");
const dns = require("dns");

// Ensure robust SRV record resolution across all network providers
try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
    // Fallback gracefully if custom DNS is restricted
}

async function connectDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("MONGODB_URI environment variable is not set");
    }
    await mongoose.connect(uri, {
        maxPoolSize: process.env.MONGO_MAX_POOL_SIZE ? parseInt(process.env.MONGO_MAX_POOL_SIZE, 10) : 50,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        waitQueueTimeoutMS: 5000, // Prevent infinite driver wait queue deadlocks
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
        socketTimeoutMS: 45000,
    });
    console.log("MongoDB connected");
}

module.exports = connectDB;