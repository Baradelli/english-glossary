import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // SQLite test database (prisma/test.db); rebuilt by test/global-setup.ts.
    env: {
      DATABASE_URL: "file:./test.db",
    },
    globalSetup: ["./test/global-setup.ts"],
    // SQLite is single-writer; run files sequentially to avoid lock contention.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: [
        "src/domain/**/*.ts",
        "src/infra/**/*.ts",
        "src/application/**/*.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/index.ts",
        "src/infra/prisma/client.ts",
        // External-API glue — exercised via a fake AiProvider in the use-case
        // tests; the SDK call itself can't be unit-tested without a live key.
        "src/infra/ai/**",
        // Type-only contracts (no runtime code).
        "src/domain/model.ts",
        "src/domain/ports/**",
        "src/application/dto.ts",
      ],
      reporter: ["text", "text-summary"],
    },
  },
});
