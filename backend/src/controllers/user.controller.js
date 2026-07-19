import httpStatus from "http-status";
import bcrypt from "bcrypt";

import { User } from "../models/user.model.js";
import { Meeting } from "../models/meeting.model.js";
import {
    createRefreshToken,
    hashRefreshToken,
    REFRESH_TOKEN_TTL_MS,
    signAccessToken,
} from "../utils/tokens.js";

const SALT_ROUNDS = 10;

// Errors are logged server-side but never sent to the client: internal
// messages leak implementation details that are useful to an attacker.
const serverError = (res, context, error) => {
    console.error(`[${context}]`, error);
    return res
        .status(httpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: "Something went wrong. Please try again." });
};

/** Issues a new token pair and records the refresh token's hash. */
const issueSession = async (user) => {
    const { token: refreshToken, hash } = createRefreshToken();

    // Drop expired entries while we are here, so the array cannot grow
    // without bound across months of sign-ins.
    const now = Date.now();
    user.refreshTokens = user.refreshTokens.filter(
        (entry) => entry.expiresAt.getTime() > now
    );
    user.refreshTokens.push({
        hash,
        expiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
    });

    await user.save();

    return { accessToken: signAccessToken(user), refreshToken };
};

const register = async (req, res) => {
    const { name, username, password } = req.body;

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res
                .status(httpStatus.CONFLICT)
                .json({ message: "That username is already taken." });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        await User.create({ name, username, password: hashedPassword });

        return res
            .status(httpStatus.CREATED)
            .json({ message: "Account created. You can sign in now." });
    } catch (error) {
        // Guards against two simultaneous registrations of the same username
        // slipping past the check above.
        if (error?.code === 11000) {
            return res
                .status(httpStatus.CONFLICT)
                .json({ message: "That username is already taken." });
        }
        return serverError(res, "register", error);
    }
};

const login = async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });

        // Identical response for "no such user" and "wrong password" so the
        // endpoint cannot be used to discover which usernames exist.
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res
                .status(httpStatus.UNAUTHORIZED)
                .json({ message: "Invalid username or password." });
        }

        const session = await issueSession(user);

        return res.status(httpStatus.OK).json({
            ...session,
            user: { username: user.username, name: user.name },
        });
    } catch (error) {
        return serverError(res, "login", error);
    }
};

/**
 * Exchanges a refresh token for a new pair, rotating the old one out.
 *
 * Rotation means a token is single-use: if one is stolen and replayed after
 * the legitimate client has already used it, the hash is no longer on record
 * and the request is rejected.
 */
const refresh = async (req, res) => {
    const { refreshToken } = req.body;

    try {
        const hash = hashRefreshToken(refreshToken);
        const user = await User.findOne({ "refreshTokens.hash": hash });

        if (!user) {
            return res
                .status(httpStatus.UNAUTHORIZED)
                .json({ message: "Session expired. Please sign in again." });
        }

        const stored = user.refreshTokens.find((entry) => entry.hash === hash);

        // Remove by explicit filter rather than Mongoose's pull(): these
        // subdocuments are declared with `_id: false`, and pull() matches on
        // _id, so it would silently remove nothing.
        const withoutPresented = user.refreshTokens.filter(
            (entry) => entry.hash !== hash
        );

        if (stored.expiresAt.getTime() <= Date.now()) {
            user.refreshTokens = withoutPresented;
            await user.save();
            return res
                .status(httpStatus.UNAUTHORIZED)
                .json({ message: "Session expired. Please sign in again." });
        }

        user.refreshTokens = withoutPresented;
        const session = await issueSession(user);

        return res.status(httpStatus.OK).json({
            ...session,
            user: { username: user.username, name: user.name },
        });
    } catch (error) {
        return serverError(res, "refresh", error);
    }
};

/** Invalidates the presented refresh token. */
const logout = async (req, res) => {
    const { refreshToken } = req.body;

    try {
        await User.updateOne(
            { "refreshTokens.hash": hashRefreshToken(refreshToken) },
            { $pull: { refreshTokens: { hash: hashRefreshToken(refreshToken) } } }
        );

        // Always reports success: whether the token existed is not information
        // an unauthenticated caller needs.
        return res.status(httpStatus.OK).json({ message: "Signed out." });
    } catch (error) {
        return serverError(res, "logout", error);
    }
};

const getUserHistory = async (req, res) => {
    try {
        const meetings = await Meeting.find({ user_id: req.user.username }).sort({
            date: -1,
        });
        return res.status(httpStatus.OK).json(meetings);
    } catch (error) {
        return serverError(res, "getUserHistory", error);
    }
};

const addToHistory = async (req, res) => {
    const { meeting_code } = req.body;

    try {
        await Meeting.create({
            user_id: req.user.username,
            meetingCode: meeting_code,
        });

        return res
            .status(httpStatus.CREATED)
            .json({ message: "Meeting added to your history." });
    } catch (error) {
        return serverError(res, "addToHistory", error);
    }
};

export { addToHistory, getUserHistory, login, logout, refresh, register };
