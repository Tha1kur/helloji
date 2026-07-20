import mongoose from "mongoose";

import { config } from "./config/env.js";
import { server } from "./app.js";

const start = async () => {
    try {
        const connection = await mongoose.connect(config.MONGO_URI);
        console.log(`MongoDB connected: ${connection.connection.host}`);
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    }

    server.listen(config.PORT, () => {
        console.log(`Server listening on port ${config.PORT}`);
    });
};

// Close the database handle on shutdown so the platform's restart is clean
// rather than leaving a connection to time out server-side.
const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down.`);
    server.close(async () => {
        await mongoose.connection.close();
        process.exit(0);
    });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start();
