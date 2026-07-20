/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        // Fail loudly instead of silently moving to another port, so the
        // backend's CORS allowlist never drifts out of sync with the frontend.
        strictPort: true,
    },
    build: {
        outDir: "build",
        sourcemap: true,
    },
    test: {
        environment: "jsdom",
        setupFiles: ["./vitest.setup.js"],
        globals: true,
        css: false,
    },
});
