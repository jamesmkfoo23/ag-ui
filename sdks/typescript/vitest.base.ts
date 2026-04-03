import { defineConfig } from "vitest/config";

/**
 * Shared Vitest base configuration for all TypeScript packages.
 * Import and merge this in each package's vitest.config.ts using:
 *
 * @example
 * import { mergeConfig } from "vitest/config";
 * import baseConfig from "../../vitest.base";
 *
 * export default mergeConfig(baseConfig, defineConfig({
 *   // package-specific overrides
 * }));
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    passWithNoTests: true,
    // In CI, emit JUnit XML and JSON reports so results can be uploaded as artifacts.
    // Locally, only the default reporter is used to keep output readable.
    reporters: process.env.CI
      ? ["verbose", "junit", "json"]
      : ["verbose"],
    outputFile: process.env.CI
      ? {
          junit: "./test-results/junit.xml",
          json: "./test-results/results.json",
        }
      : undefined,
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      // Target: 80% coverage for statements, branches, functions, and lines
      // Thresholds are not enforced to allow builds to pass while coverage improves
    },
  },
});
