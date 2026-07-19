import { z } from "zod";

export const registerSchema = z.object({
    name: z.string().trim().min(1, "Name is required.").max(80),
    username: z
        .string()
        .trim()
        .min(3, "Username must be at least 3 characters.")
        .max(30, "Username must be at most 30 characters.")
        .regex(
            /^[a-zA-Z0-9._-]+$/,
            "Username may only contain letters, numbers, dots, underscores and hyphens."
        ),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters.")
        .max(128, "Password must be at most 128 characters."),
});

export const loginSchema = z.object({
    username: z.string().trim().min(1, "Username is required."),
    password: z.string().min(1, "Password is required."),
});

export const refreshSchema = z.object({
    refreshToken: z.string().min(1, "Refresh token is required."),
});

export const addToHistorySchema = z.object({
    meeting_code: z
        .string()
        .trim()
        .min(1, "A meeting code is required.")
        .max(64, "Meeting code is too long."),
});
