import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        // globalSetup runs once, before any module reads process.env, which
        // matters because config/env.js validates configuration at import time.
        globalSetup: ["./src/tests/setup.js"],
        // The rate limiter counts per process, so parallel files sharing one
        // limiter would trip each other's limits.
        fileParallelism: false,
        testTimeout: 20000,
        hookTimeout: 30000,
    },
});
