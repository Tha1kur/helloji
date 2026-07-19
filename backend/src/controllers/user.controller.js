import httpStatus from "http-status";
import bcrypt from "bcrypt";
import crypto from "node:crypto";

import { User } from "../models/user.model.js";
import { Meeting } from "../models/meeting.model.js";

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

// Errors are logged server-side but never sent to the client: internal
// messages leak implementation details that are useful to an attacker.
const serverError = (res, context, error) => {
    console.error(`[${context}]`, error);
    return res
        .status(httpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: "Something went wrong. Please try again." });
};

const register = async (req, res) => {
    const { name, username, password } = req.body;

    if (!name || !username || !password) {
        return res
            .status(httpStatus.BAD_REQUEST)
            .json({ message: "Name, username and password are all required." });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
        return res.status(httpStatus.BAD_REQUEST).json({
            message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
        });
    }

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
        return serverError(res, "register", error);
    }
};

const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res
            .status(httpStatus.BAD_REQUEST)
            .json({ message: "Username and password are required." });
    }

    try {
        const user = await User.findOne({ username });

        // Same response for "no such user" and "wrong password" so the endpoint
        // cannot be used to discover which usernames exist.
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res
                .status(httpStatus.UNAUTHORIZED)
                .json({ message: "Invalid username or password." });
        }

        const token = crypto.randomBytes(20).toString("hex");
        user.token = token;
        await user.save();

        return res.status(httpStatus.OK).json({ token });
    } catch (error) {
        return serverError(res, "login", error);
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

    if (!meeting_code) {
        return res
            .status(httpStatus.BAD_REQUEST)
            .json({ message: "A meeting code is required." });
    }

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

export { login, register, getUserHistory, addToHistory };
