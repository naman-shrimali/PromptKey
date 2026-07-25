import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
    test: {
        include: ["tests/**/*.test.ts"],
        // mongodb-memory-server downloads a mongod binary on first run
        testTimeout: 60_000,
        hookTimeout: 120_000,
    },
});
