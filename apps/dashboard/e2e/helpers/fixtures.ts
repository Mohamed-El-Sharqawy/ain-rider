import { test as base, expect } from "@playwright/test";
import { MockBackend } from "./backend";

/**
 * Every test gets a fresh browser context with the mock backend installed.
 *
 * Playwright fixtures are lazy: `backend` is only instantiated when a test
 * destructures it. EVERY test in the suite MUST take `{ page, backend }`
 * (add `void backend` when the handle itself is unused), otherwise the
 * app's requests bypass the mocks and hit the Vite dev server.
 */
export const test = base.extend<{ backend: MockBackend }>({
  // (the fixture runner arg is named `run` because react-hooks lint rules
  // flag Playwright's conventional `use` name as a React hook)
  backend: async ({ page }, run) => {
    const backend = await MockBackend.install(page);
    await run(backend);
  },
});

export { expect };
