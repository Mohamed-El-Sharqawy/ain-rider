import { expect, test } from "./helpers/fixtures";

test.describe("users admin flow", () => {
  test("renders the user list with identity cells", async ({
    page,
    backend,
  }) => {
    await backend.authenticate(page);
    await page.goto("/users");

    await expect(page.getByText("ahmed@example.com")).toBeVisible();
    await expect(page.getByText("mona@example.com")).toBeVisible();
    await expect(page.getByText("omar@example.com")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(3);
  });

  test("search by email fragment narrows the list", async ({
    page,
    backend,
  }) => {
    await backend.authenticate(page);
    await page.goto("/users");
    await expect(page.locator("tbody tr")).toHaveCount(3);

    await page
      .getByPlaceholder("بحث بالاسم أو البريد أو الهاتف...")
      .fill("mona");

    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.getByText("mona@example.com")).toBeVisible();
    await expect(page.getByText("ahmed@example.com")).toHaveCount(0);
  });

  test("the role filter narrows the list to drivers", async ({
    page,
    backend,
  }) => {
    await backend.authenticate(page);
    await page.goto("/users");
    await expect(page.locator("tbody tr")).toHaveCount(3);

    await page
      .locator('button[role="combobox"]')
      .filter({ hasText: "جميع الأدوار" })
      .click();
    await page.getByRole("option", { name: "سائق", exact: true }).click();

    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.getByText("mona@example.com")).toBeVisible();
    await expect(page.getByText("ahmed@example.com")).toHaveCount(0);
  });

  test("clicking a row opens the user detail modal", async ({
    page,
    backend,
  }) => {
    await backend.authenticate(page);
    await page.goto("/users");

    await page
      .locator("tbody tr")
      .filter({ hasText: "ahmed@example.com" })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("ahmed@example.com")).toBeVisible();
    await expect(dialog.getByText("+201001112223")).toBeVisible();
  });
});
