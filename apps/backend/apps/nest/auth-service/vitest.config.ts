import { defineConfig } from "vitest/config";
import swc from "unplugin-swc";

export default defineConfig({
  plugins: [
    // Vitest's default esbuild transform drops TS decorator metadata
    // (design:paramtypes), which Nest DI needs to resolve constructor
    // dependencies. SWC emits it, so the AppModule can boot under test.
    swc.vite({
      module: { type: "es6" },
      jsc: {
        target: "es2022",
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    setupFiles: ["./test/setup-env.ts"],
    include: ["test/**/*.test.ts"],
    // Integration suites share one postgres/nats instance: run files sequentially.
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 180_000,
    coverage: {
      enabled: true,
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/generated/**", "src/**/*.d.ts", "src/main.ts"],
      reporter: ["text-summary", "lcovonly"],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
