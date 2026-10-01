import { expect, test } from "./helpers/fixtures";
import { ADMIN_ID } from "./helpers/backend";

test.describe("wallets admin flow", () => {
  test("renders the withdrawal summary and list", async ({ page, backend }) => {
    await backend.authenticate(page);
    await page.goto("/wallets");

    await expect(page.locator("tbody tr")).toHaveCount(3);
    await expect(page.getByText("wdl-3001", { exact: false })).toBeVisible();
    await expect(page.getByText("wdl-3003", { exact: false })).toBeVisible();
  });

  test("the status filter narrows the withdrawals to pending", async ({
    page,
    backend,
  }) => {
    await backend.authenticate(page);
    await page.goto("/wallets");
    await expect(page.locator("tbody tr")).toHaveCount(3);

    await page
      .locator('button[role="combobox"]')
      .filter({ hasText: "جميع الحالات" })
      .click();
    await page.getByRole("option", { name: "قيد الانتظار" }).click();

    await expect(page.locator("tbody tr")).toHaveCount(2);
    await expect(page.getByText("wdl-3003", { exact: false })).toHaveCount(0);
  });

  test("processing a pending withdrawal approves it end to end", async ({
    page,
    backend,
  }) => {
    await backend.authenticate(page);
    await page.goto("/wallets");

    const row = page.locator("tbody tr").filter({ hasText: "wdl-3001" });
    await expect(row).toBeVisible();
    await row.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.locator('button[role="combobox"]').click();
    await page.getByRole("option", { name: "قبول" }).click();
    await dialog.getByRole("button", { name: "معالجة" }).click();

    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible();
    const patches = backend.recorded(
      "PATCH",
      /\/admin\/withdrawals\/wdl-3001\/process$/,
    );
    expect(patches).toHaveLength(1);
    expect(patches[0].body).toEqual({ approve: true });

    // the list refetches and the withdrawal shows as completed
    await expect(row.getByText("مكتمل", { exact: true })).toBeVisible();
    expect(
      backend.recorded("GET", /\/admin\/withdrawals$/).length,
    ).toBeGreaterThanOrEqual(2);
    void ADMIN_ID;
  });
});
