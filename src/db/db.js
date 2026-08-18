const mongoose = require("mongoose");

async function connectDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("MONGODB_URI environment variable is not set");
    }
    await mongoose.connect(uri, {
        maxPoolSize: 100,
        minPoolSize: 10,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
    });
    console.log("MongoDB connected");
}

module.exports = connectDB;