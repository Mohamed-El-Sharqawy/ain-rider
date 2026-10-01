import { expect, test } from "./helpers/fixtures";

test.describe("trips admin flow", () => {
  test("renders the trip list with rows and stats", async ({
    page,
    backend,
  }) => {
    await backend.authenticate(page);
    await page.goto("/trips");

    await expect(page.getByText("Tahrir Square, Cairo")).toBeVisible();
    await expect(page.getByText("Cairo International Airport")).toBeVisible();
    await expect(page.getByText("Giza Pyramid Gate")).toBeVisible();
    // the id column renders the first 8 characters of every trip id
    await expect(page.getByText("trip-100", { exact: true })).toHaveCount(3);
    // three fixture trips, one row each
    await expect(page.locator("tbody tr")).toHaveCount(3);
  });

  test("search narrows the trip list", async ({ page, backend }) => {
    await backend.authenticate(page);
    await page.goto("/trips");
    await expect(page.locator("tbody tr")).toHaveCount(3);

    await page
      .getByPlaceholder("بحث برقم الرحلة، الراكب، أو السائق...")
      .fill("airport");

    await expect(page.getByText("Cairo International Airport")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.getByText("Giza Pyramid Gate")).toHaveCount(0);
  });

  test("the status filter narrows the trip list", async ({ page, backend }) => {
    await backend.authenticate(page);
    await page.goto("/trips");
    await expect(page.locator("tbody tr")).toHaveCount(3);

    await page
      .locator('button[role="combobox"]')
      .filter({ hasText: "جميع الحالات" })
      .click();
    await page.getByRole("option", { name: "مكتملة" }).click();

    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.getByText("Cairo International Airport")).toBeVisible();
    await expect(page.getByText("Giza Pyramid Gate")).toHaveCount(0);
  });

  test("clicking a row opens the trip detail modal", async ({
    page,
    backend,
  }) => {
    await backend.authenticate(page);
    await page.goto("/trips");

    await page
      .locator("tbody tr")
      .filter({ hasText: "Tahrir Square, Cairo" })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Tahrir Square, Cairo")).toBeVisible();
    await expect(dialog.getByText("Cairo International Airport")).toBeVisible();
  });
});
