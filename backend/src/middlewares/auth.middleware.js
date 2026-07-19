import httpStatus from "http-status";

import { User } from "../models/user.model.js";

/**
 * Resolves the caller's session token into `req.user`.
 *
 * The token is read from the Authorization header rather than the query
 * string, because query strings end up in server logs, proxy logs and
 * browser history.
 *
 * Any route mounted behind this middleware can assume `req.user` exists.
 */
export const requireAuth = async (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

    if (!token) {
        return res
            .status(httpStatus.UNAUTHORIZED)
            .json({ message: "Authentication required." });
    }

    try {
        const user = await User.findOne({ token });

        if (!user) {
            return res
                .status(httpStatus.UNAUTHORIZED)
                .json({ message: "Your session has expired. Please sign in again." });
        }

        req.user = user;
        return next();
    } catch (error) {
        console.error("[requireAuth]", error);
        return res
            .status(httpStatus.INTERNAL_SERVER_ERROR)
            .json({ message: "Something went wrong. Please try again." });
    }
};
