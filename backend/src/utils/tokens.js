import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import { config } from "../config/env.js";

export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Short-lived access token. Carries the caller's identity in a signed
 * payload, so verifying a request costs a signature check rather than a
 * database round trip.
 */
export const signAccessToken = (user) =>
    jwt.sign(
        { sub: user._id.toString(), username: user.username, name: user.name },
        config.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_TTL }
    );

export const verifyAccessToken = (token) =>
    jwt.verify(token, config.JWT_SECRET);

/**
 * Long-lived refresh token.
 *
 * Only the SHA-256 hash is stored. A database leak therefore does not hand
 * an attacker usable tokens, for the same reason passwords are hashed.
 * SHA-256 rather than bcrypt is deliberate: the token is already 320 bits of
 * entropy, so it is not brute-forceable and does not need a slow hash.
 */
export const createRefreshToken = () => {
    const token = crypto.randomBytes(40).toString("hex");
    return { token, hash: hashRefreshToken(token) };
};

export const hashRefreshToken = (token) =>
    crypto.createHash("sha256").update(token).digest("hex");
