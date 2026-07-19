import express from "express";
import { createServer } from "node:http";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";

import { config } from "./config/env.js";
import { connectToSocket } from "./controllers/socketManager.js";
import { apiLimiter } from "./middlewares/rateLimit.middleware.js";
import userRoutes from "./routes/users.routes.js";

const app = express();
const server = createServer(app);
connectToSocket(server);

// Render, Railway and Fly all sit behind a proxy. Without this, every
// request appears to come from the proxy's IP and rate limiting would
// throttle all users as though they were one.
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/v1", apiLimiter);
app.use("/api/v1/users", userRoutes);

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

start();
