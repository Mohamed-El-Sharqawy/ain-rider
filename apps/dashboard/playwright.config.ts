import { defineConfig, devices } from "@playwright/test";

/**
 * E2E configuration for the admin dashboard.
 *
 * The Vite dev server is started on a dedicated port (5190) so the suite never
 * collides with a dev server another workspace or agent may be running on the
 * default port. `reuseExistingServer` keeps local iteration fast.
 *
 * `VITE_API_GATEWAY_URL` is overridden to the same-origin prefix `/__api` so
 * every backend call the app makes (axios baseURL) is same-origin and can be
 * intercepted deterministically with `page.route` - no CORS, no real backend,
 * no network flake. See e2e/helpers/backend.ts.
 */
const PORT = 5190;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  expect: {
    timeout: 10_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    env: {
      VITE_API_GATEWAY_URL: "/__api",
    },
  },
});
