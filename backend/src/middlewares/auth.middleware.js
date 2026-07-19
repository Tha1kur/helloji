import httpStatus from "http-status";

import { verifyAccessToken } from "../utils/tokens.js";

/**
 * Verifies the access token and populates `req.user`.
 *
 * Verification is a signature check, not a database lookup, so this stays
 * cheap regardless of traffic. The trade-off is that an access token remains
 * valid until it expires, which is why access tokens are short-lived and
 * revocation happens at the refresh-token layer.
 *
 * The token is read from the Authorization header rather than the query
 * string, because query strings are captured in server and proxy logs.
 */
export const requireAuth = (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

    if (!token) {
        return res
            .status(httpStatus.UNAUTHORIZED)
            .json({ message: "Authentication required.", code: "NO_TOKEN" });
    }

    try {
        const payload = verifyAccessToken(token);
        req.user = { id: payload.sub, username: payload.username, name: payload.name };
        return next();
    } catch (error) {
        // The client uses this code to decide whether to attempt a refresh.
        const expired = error.name === "TokenExpiredError";
        return res.status(httpStatus.UNAUTHORIZED).json({
            message: expired ? "Access token expired." : "Invalid access token.",
            code: expired ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
        });
    }
};
