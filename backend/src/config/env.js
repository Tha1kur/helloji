import "dotenv/config";
import { z } from "zod";

// Validating configuration at boot means a missing or malformed variable
// fails immediately with a readable message, rather than surfacing later as
// a confusing runtime error in an unrelated part of the app.
const envSchema = z.object({
    MONGO_URI: z.string().min(1, "MONGO_URI is required"),
    JWT_SECRET: z
        .string()
        .min(32, "JWT_SECRET must be at least 32 characters"),
    PORT: z.coerce.number().int().positive().default(8000),
    CORS_ORIGINS: z.string().default("http://localhost:3000"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("Invalid environment configuration:");
    for (const issue of parsed.error.issues) {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    console.error("\nCopy backend/.env.example to backend/.env and fill it in.");
    process.exit(1);
}

export const config = {
    ...parsed.data,
    corsOrigins: parsed.data.CORS_ORIGINS.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
};
