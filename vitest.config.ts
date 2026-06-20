import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
    // SQLite test database (prisma/test.db); rebuilt by test/global-setup.ts.
    env: {
      DATABASE_URL: "file:./test.db",
    },
    globalSetup: ["./test/global-setup.ts"],
    // SQLite is single-writer; run files sequentially to avoid lock contention.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/domain/**/*.ts", "src/infra/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/index.ts",
        "src/infra/prisma/client.ts",
        // Type-only contracts (no runtime code).
        "src/domain/model.ts",
        "src/domain/ports/**",
      ],
      reporter: ["text", "text-summary"],
    },
  },
});
