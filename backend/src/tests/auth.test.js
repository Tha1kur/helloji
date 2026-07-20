import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import mongoose from "mongoose";

import { app } from "../app.js";
import { User } from "../models/user.model.js";

const API = "/api/v1/users";
const credentials = { name: "Test User", username: "tester", password: "password123" };

const registerAndLogin = async (overrides = {}) => {
    const user = { ...credentials, ...overrides };
    await request(app).post(`${API}/register`).send(user);
    const response = await request(app)
        .post(`${API}/login`)
        .send({ username: user.username, password: user.password });
    return response.body;
};

beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI);
});

afterAll(async () => {
    await mongoose.connection.close();
});

beforeEach(async () => {
    await User.deleteMany({});
});

describe("registration", () => {
    it("creates an account", async () => {
        const response = await request(app).post(`${API}/register`).send(credentials);
        expect(response.status).toBe(201);
    });

    it("stores the password as a hash, never in plain text", async () => {
        await request(app).post(`${API}/register`).send(credentials);
        const user = await User.findOne({ username: credentials.username });

        expect(user.password).not.toBe(credentials.password);
        expect(user.password).toMatch(/^\$2[aby]\$/);
    });

    it("rejects a password below the minimum length", async () => {
        const response = await request(app)
            .post(`${API}/register`)
            .send({ ...credentials, password: "short" });

        expect(response.status).toBe(400);
    });

    it("rejects a username containing illegal characters", async () => {
        const response = await request(app)
            .post(`${API}/register`)
            .send({ ...credentials, username: "has spaces" });

        expect(response.status).toBe(400);
    });

    it("rejects a duplicate username with 409, not a redirect code", async () => {
        await request(app).post(`${API}/register`).send(credentials);
        const response = await request(app).post(`${API}/register`).send(credentials);

        expect(response.status).toBe(409);
    });
});

describe("login", () => {
    it("returns an access and refresh token pair", async () => {
        const body = await registerAndLogin();

        expect(body.accessToken).toBeTruthy();
        expect(body.refreshToken).toBeTruthy();
        expect(body.user.username).toBe(credentials.username);
    });

    it("never returns the password hash or stored tokens", async () => {
        const body = await registerAndLogin();

        expect(body.user.password).toBeUndefined();
        expect(body.user.refreshTokens).toBeUndefined();
    });

    it("gives the same response for a wrong password and an unknown user", async () => {
        await request(app).post(`${API}/register`).send(credentials);

        const wrongPassword = await request(app)
            .post(`${API}/login`)
            .send({ username: credentials.username, password: "wrongpassword" });

        const unknownUser = await request(app)
            .post(`${API}/login`)
            .send({ username: "nobody-here", password: "wrongpassword" });

        // Differing responses would let an attacker discover which usernames
        // exist before ever guessing a password.
        expect(wrongPassword.status).toBe(401);
        expect(unknownUser.status).toBe(401);
        expect(wrongPassword.body.message).toBe(unknownUser.body.message);
    });
});

describe("protected routes", () => {
    it("rejects a request with no token", async () => {
        const response = await request(app).get(`${API}/get_all_activity`);
        expect(response.status).toBe(401);
        expect(response.body.code).toBe("NO_TOKEN");
    });

    it("rejects a tampered token", async () => {
        const { accessToken } = await registerAndLogin();
        const response = await request(app)
            .get(`${API}/get_all_activity`)
            .set("Authorization", `Bearer ${accessToken.slice(0, -1)}X`);

        expect(response.status).toBe(401);
        expect(response.body.code).toBe("TOKEN_INVALID");
    });

    it("records and returns meeting history for the caller", async () => {
        const { accessToken } = await registerAndLogin();

        await request(app)
            .post(`${API}/add_to_activity`)
            .set("Authorization", `Bearer ${accessToken}`)
            .send({ meeting_code: "abc-def-ghi" });

        const response = await request(app)
            .get(`${API}/get_all_activity`)
            .set("Authorization", `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].meetingCode).toBe("abc-def-ghi");
    });

    it("does not leak another user's history", async () => {
        const alice = await registerAndLogin({ username: "alice" });
        await request(app)
            .post(`${API}/add_to_activity`)
            .set("Authorization", `Bearer ${alice.accessToken}`)
            .send({ meeting_code: "alice-only" });

        const bob = await registerAndLogin({ username: "bob" });
        const response = await request(app)
            .get(`${API}/get_all_activity`)
            .set("Authorization", `Bearer ${bob.accessToken}`);

        expect(response.body).toHaveLength(0);
    });
});

describe("refresh token rotation", () => {
    it("issues a different refresh token on every use", async () => {
        const { refreshToken } = await registerAndLogin();
        const response = await request(app).post(`${API}/refresh`).send({ refreshToken });

        expect(response.status).toBe(200);
        expect(response.body.refreshToken).not.toBe(refreshToken);
    });

    it("rejects a refresh token that has already been spent", async () => {
        // This is the regression guard for a real bug: revocation used
        // Mongoose's pull(), which matches on _id and so silently removed
        // nothing from subdocuments declared with `_id: false`.
        const { refreshToken } = await registerAndLogin();
        await request(app).post(`${API}/refresh`).send({ refreshToken });

        const replay = await request(app).post(`${API}/refresh`).send({ refreshToken });

        expect(replay.status).toBe(401);
    });

    it("stores only a hash of the refresh token", async () => {
        const { refreshToken } = await registerAndLogin();
        const user = await User.findOne({ username: credentials.username });

        expect(user.refreshTokens).toHaveLength(1);
        expect(user.refreshTokens[0].hash).not.toBe(refreshToken);
    });

    it("keeps sessions on separate devices independent", async () => {
        await request(app).post(`${API}/register`).send(credentials);
        const login = () =>
            request(app)
                .post(`${API}/login`)
                .send({ username: credentials.username, password: credentials.password });

        const laptop = (await login()).body;
        const phone = (await login()).body;

        await request(app).post(`${API}/logout`).send({ refreshToken: laptop.refreshToken });

        const phoneStillWorks = await request(app)
            .post(`${API}/refresh`)
            .send({ refreshToken: phone.refreshToken });

        expect(phoneStillWorks.status).toBe(200);
    });

    it("revokes a refresh token on logout", async () => {
        const { refreshToken } = await registerAndLogin();
        await request(app).post(`${API}/logout`).send({ refreshToken });

        const response = await request(app).post(`${API}/refresh`).send({ refreshToken });
        expect(response.status).toBe(401);
    });
});

describe("service endpoints", () => {
    it("reports health", async () => {
        const response = await request(app).get("/health");
        expect(response.body).toEqual({ status: "ok" });
    });

    it("answers at the root instead of returning a 404", async () => {
        const response = await request(app).get("/");
        expect(response.status).toBe(200);
        expect(response.body.status).toBe("ok");
    });

    it("returns JSON, not HTML, for an unknown route", async () => {
        const response = await request(app).get("/api/v1/does-not-exist");

        expect(response.status).toBe(404);
        expect(response.headers["content-type"]).toMatch(/json/);
    });

    it("sets security headers", async () => {
        const response = await request(app).get("/health");
        expect(response.headers["x-content-type-options"]).toBe("nosniff");
    });
});
