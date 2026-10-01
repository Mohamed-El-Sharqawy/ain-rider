import { expect, test } from "./helpers/fixtures";
import {
  ADMIN_EMAIL,
  ADMIN_FULL_NAME,
  ADMIN_PASSWORD,
} from "./helpers/backend";

test.describe("login guard and session lifecycle", () => {
  test("redirects unauthenticated visitors of a protected route to /login", async ({
    page,
    backend,
  }) => {
    void backend;
    await page.goto("/trips");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("#email")).toBeVisible();
    // no protected chrome (sidebar) leaks onto the login page
    await expect(page.locator('nav a[href="/users"]')).toHaveCount(0);
  });

  test("shows an error toast for invalid credentials and stays on /login", async ({
    page,
    backend,
  }) => {
    await page.goto("/login");
    await page.locator("#email").fill("wrong@ainrider.com");
    await page.locator("#password").fill("wrong-pass");
    await page.locator('button[type="submit"]').click();

    // The bad credentials reach the backend and are rejected there; the app
    // surfaces the failed login as an error toast and keeps the user on /login.
    // (Note: the toast text is the refresh-failure message, because the axios
    // interceptor rejects the login mutation with the failed /auth/refresh
    // error - see the PR body, "bugs found".)
    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    const loginAttempts = backend.recorded("POST", /\/auth\/login$/);
    expect(loginAttempts).toHaveLength(1);
    expect(loginAttempts[0].body).toEqual({
      email: "wrong@ainrider.com",
      password: "wrong-pass",
    });
  });

  test("logs in with valid credentials and lands on the dashboard shell", async ({
    page,
    backend,
  }) => {
    void backend;
    await page.goto("/login");
    await page.locator("#email").fill(ADMIN_EMAIL);
    await page.locator("#password").fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/$/);
    // dashboard shell: sidebar nav and topbar identity are visible
    for (const href of ["/users", "/trips", "/complaints", "/wallets"]) {
      await expect(page.locator(`nav a[href="${href}"]`)).toBeVisible();
    }
    await expect(page.getByText(ADMIN_FULL_NAME).first()).toBeVisible();
  });

  test("logout returns the admin to the login page and keeps them out", async ({
    page,
    backend,
  }) => {
    await backend.authenticate(page);
    await page.goto("/");
    await expect(page.getByText(ADMIN_FULL_NAME).first()).toBeVisible();

    await page
      .getByRole("button", { name: new RegExp(ADMIN_FULL_NAME) })
      .click();
    await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("#email")).toBeVisible();
    // the session must stay dead: /auth/me is a 401 from here on, so the guard
    // must not bounce the user back into the app (guest/protected ping-pong)
    await page.waitForTimeout(1_500);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("a mid-session access-token expiry is refreshed transparently", async ({
    page,
    backend,
  }) => {
    await backend.authenticate(page);
    backend.expireOnce(/\/admin\/trips$/);
    await page.goto("/trips");

    // the first /admin/trips call 401s, the client refreshes and retries;
    // the trip list still renders and the user never leaves the page
    await expect(page.getByText("Tahrir Square, Cairo")).toBeVisible();
    await expect(page).toHaveURL(/\/trips$/);
    expect(backend.refreshCalls).toBeGreaterThanOrEqual(1);
    expect(
      backend.recorded("GET", /\/admin\/trips$/).length,
      "the trips endpoint is retried after the refresh",
    ).toBeGreaterThanOrEqual(2);
  });

  test("a dead server session on load forces the guard back to /login", async ({
    page,
    backend,
  }) => {
    // the browser still believes it is signed in (persisted store), but the
    // server rejects everything: ProtectedRoute must verify with /auth/me,
    // fail the refresh, and land on the login page instead of the app
    await backend.authenticate(page);
    backend.invalidate();
    await page.goto("/trips");

    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
    await expect(page.locator("#email")).toBeVisible();
  });
});
