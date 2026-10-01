import { expect, test } from "./helpers/fixtures";
import { ADMIN_ID } from "./helpers/backend";

test.describe("complaints admin flow", () => {
  test("renders the complaints list", async ({ page, backend }) => {
    await backend.authenticate(page);
    await page.goto("/complaints");

    await expect(page.getByText("Driver arrived late")).toBeVisible();
    await expect(page.getByText("Wrong fare charged")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(2);
  });

  test("status change round-trip: PENDING -> IN_PROGRESS -> RESOLVED", async ({
    page,
    backend,
  }) => {
    await backend.authenticate(page);
    await page.goto("/complaints");
    const row = page.locator("tbody tr").filter({ hasText: "cpl-2001" });
    await expect(row).toBeVisible();

    // step 1: open the detail modal and move the complaint to IN_PROGRESS
    await row.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Driver arrived late")).toBeVisible();
    await expect(
      dialog.getByText("We are checking the trip timeline."),
    ).toBeVisible();

    await dialog.locator('button[role="combobox"]').click();
    await page.getByRole("option", { name: "قيد المعالجة" }).click();
    await dialog.getByRole("button", { name: "تحديث الحالة" }).click();

    // success toast + the PATCH body round-trips status and assignee
    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible();
    let patches = backend.recorded(
      "PATCH",
      /\/admin\/complaints\/cpl-2001\/status$/,
    );
    expect(patches).toHaveLength(1);
    expect(patches[0].body).toEqual({
      status: "IN_PROGRESS",
      assignedTo: ADMIN_ID,
    });

    // the list refetches and reflects the new badge
    await page.keyboard.press("Escape");
    await expect(row.getByText("قيد المعالجة")).toBeVisible();

    // step 2: reopen and resolve with a resolution note (>= 10 chars required)
    await row.click();
    await expect(dialog).toBeVisible();
    await dialog.locator('button[role="combobox"]').click();
    await page.getByRole("option", { name: "محلول" }).click();
    await dialog
      .getByPlaceholder("ملاحظات الحل...")
      .fill("Refunded the late fee to the rider.");
    await dialog.getByRole("button", { name: "تحديث الحالة" }).click();

    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible();
    patches = backend.recorded(
      "PATCH",
      /\/admin\/complaints\/cpl-2001\/status$/,
    );
    expect(patches).toHaveLength(2);
    expect(patches[1].body).toEqual({
      status: "RESOLVED",
      assignedTo: ADMIN_ID,
      resolution: "Refunded the late fee to the rider.",
    });

    await page.keyboard.press("Escape");
    await expect(row.getByText("محلول", { exact: true })).toBeVisible();
  });

  test("the status filter narrows the complaints list", async ({
    page,
    backend,
  }) => {
    await backend.authenticate(page);
    await page.goto("/complaints");
    await expect(page.locator("tbody tr")).toHaveCount(2);

    await page
      .locator('button[role="combobox"]')
      .filter({ hasText: "جميع الحالات" })
      .click();
    await page.getByRole("option", { name: "قيد الانتظار" }).click();

    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.getByText("Driver arrived late")).toBeVisible();
    await expect(page.getByText("Wrong fare charged")).toHaveCount(0);
  });
});
