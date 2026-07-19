import rateLimit from "express-rate-limit";

/**
 * Tight limit on credential endpoints. Without this, an attacker can guess
 * passwords as fast as the network allows.
 *
 * Successful requests are not counted, so somebody signing in normally is
 * never locked out by their own activity.
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many attempts. Please try again in 15 minutes." },
});

/** Broad backstop for the rest of the API. */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many requests. Please slow down." },
});
