import express from "express";
import { createServer } from "node:http";
import cors from "cors";
import helmet from "helmet";

import { config } from "./config/env.js";
import { connectToSocket } from "./controllers/socketManager.js";
import { apiLimiter } from "./middlewares/rateLimit.middleware.js";
import userRoutes from "./routes/users.routes.js";

// This module only builds the app; server.js starts it. Keeping the two
// apart lets tests exercise the routes over an ephemeral port without
// opening the real one or requiring the production database.
export const app = express();
export const server = createServer(app);
export const io = connectToSocket(server);

// Render, Railway and Fly all sit behind a proxy. Without this, every
// request appears to come from the proxy's IP and rate limiting would
// throttle all users as though they were one.
app.set("trust proxy", 1);

app.use(helmet());

// Hosting platforms give every build its own URL, so an allowlist of exact
// origins rejects the deployment the developer is actually looking at. Entries
// may contain "*" to match one hostname segment, e.g.
// https://helloji-*-myteam.vercel.app - narrow enough that it does not admit
// unrelated sites on the same platform.
const originMatchers = config.corsOrigins.map((entry) => {
    if (!entry.includes("*")) return (origin) => origin === entry;

    const pattern = new RegExp(
        `^${entry.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^./]+")}$`
    );
    return (origin) => pattern.test(origin);
});

app.use(
    cors({
        origin(origin, callback) {
            // Requests without an Origin header (curl, health checks,
            // same-origin server calls) are not browser cross-origin requests.
            if (!origin) return callback(null, true);
            callback(null, originMatchers.some((matches) => matches(origin)));
        },
        credentials: true,
    })
);
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
