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

// Visiting the root of an API server is a common way to check it is alive,
// so answer with something readable rather than Express's default 404.
app.get("/", (req, res) =>
    res.json({
        name: "HelloJi API",
        status: "ok",
        docs: "https://github.com/Tha1kur/helloji",
        endpoints: ["/health", "/api/v1/users"],
    })
);

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/v1", apiLimiter);
app.use("/api/v1/users", userRoutes);

// An API should answer in JSON even when the route does not exist, rather
// than returning Express's default HTML error page to a fetch() caller.
app.use((req, res) =>
    res.status(404).json({ message: `Cannot ${req.method} ${req.path}` })
);

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
