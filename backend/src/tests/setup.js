import { MongoMemoryServer } from "mongodb-memory-server";

// Tests run against an in-memory MongoDB rather than a real cluster, so the
// suite needs no credentials, cannot touch production data, and runs
// identically on a laptop and in CI.
let mongo;

// Named `setup`/`teardown` exports, not a default export: Vitest treats a
// default export as the setup function itself.
export async function setup() {
    mongo = await MongoMemoryServer.create();

    // Set before any worker spawns, so the workers inherit these and
    // config/env.js validates successfully at import time.
    process.env.MONGO_URI = mongo.getUri("helloji-test");
    process.env.JWT_SECRET = "test-secret-that-is-long-enough-to-pass-validation";
    process.env.CORS_ORIGINS = "http://localhost:3000";
    process.env.NODE_ENV = "test";
}

export async function teardown() {
    await mongo?.stop();
}
