import { describe, expect, it } from "vitest";
import request from "supertest";

import { app } from "../app.js";

// setup.js sets CORS_ORIGINS to http://localhost:3000 for the suite.
const ALLOWED = "http://localhost:3000";

const preflight = (origin) =>
    request(app)
        .options("/api/v1/users/login")
        .set("Origin", origin)
        .set("Access-Control-Request-Method", "POST");

describe("CORS", () => {
    it("allows a configured origin", async () => {
        const response = await preflight(ALLOWED);
        expect(response.headers["access-control-allow-origin"]).toBe(ALLOWED);
    });

    it("does not allow an origin that is not configured", async () => {
        const response = await preflight("https://not-my-site.example");

        // The browser blocks the request when this header is absent, which is
        // what makes an unlisted deployment URL look like an unreachable server.
        expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("allows requests with no Origin header", async () => {
        // curl, uptime checks and server-to-server calls send no Origin, and
        // are not subject to the browser's cross-origin rules.
        const response = await request(app).get("/health");
        expect(response.status).toBe(200);
    });
});
