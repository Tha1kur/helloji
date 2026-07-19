import "dotenv/config";

import express from "express";
import { createServer } from "node:http";
import mongoose from "mongoose";
import cors from "cors";

import { connectToSocket } from "./controllers/socketManager.js";
import userRoutes from "./routes/users.routes.js";

const app = express();
const server = createServer(app);
connectToSocket(server);

const PORT = process.env.PORT || 8000;
const MONGO_URI = process.env.MONGO_URI;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/v1/users", userRoutes);

const start = async () => {
    if (!MONGO_URI) {
        console.error("MONGO_URI is not set. Copy backend/.env.example to backend/.env and fill it in.");
        process.exit(1);
    }

    try {
        const connection = await mongoose.connect(MONGO_URI);
        console.log(`MongoDB connected: ${connection.connection.host}`);
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    }

    server.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
};

start();
