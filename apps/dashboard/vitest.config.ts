import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // heavy RTL form flows under v8 coverage exceed the 5s default on loaded machines
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // bootstrap entry - excluded per the coverage gate conventions (issue #4)
        'src/main.tsx',
        // test harness files
        'src/test/**',
        // pure type declarations - no runtime code
        'src/types/**',
        // shadcn CLI-generated vendored primitives (components.json), not hand-written source
        'src/components/ui/**',
      ],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
})
