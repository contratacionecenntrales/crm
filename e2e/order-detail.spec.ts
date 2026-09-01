import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/testDb";

test.beforeEach(() => resetDb());

async function openOrder(page: import("@playwright/test").Page, orderNumber: string) {
  await page.goto("/labs");
  await page.getByRole("link", { name: orderNumber }).click();
  await expect(page.getByRole("heading", { name: new RegExp(orderNumber) })).toBeVisible();
}

test.describe("Order detail page", () => {
  test("updates status and reflects it immediately", async ({ page }) => {
    await openOrder(page, "LO-E2E-001"); // seeded as PENDING

    await expect(page.getByRole("button", { name: "Pending", exact: true })).toBeDisabled();

    await page.getByRole("button", { name: "In progress", exact: true }).click();
    await expect(page.getByRole("button", { name: "In progress", exact: true })).toBeDisabled();

    // Status badge in the header should update too.
    await expect(page.locator("header").getByText("In progress")).toBeVisible();

    // The change should survive a reload (persisted server-side).
    await page.reload();
    await expect(page.getByRole("button", { name: "In progress", exact: true })).toBeDisabled();
  });

  test("recording a result marks the order completed", async ({ page }) => {
    await openOrder(page, "LO-E2E-001"); // seeded as PENDING, no result yet

    await expect(page.getByRole("heading", { name: "Record result" })).toBeVisible();

    await page.getByLabel("Summary").fill("All panels within normal limits.");
    await page.getByLabel("Flag").selectOption("NORMAL");
    await page.getByLabel("Reported by").fill("Dr. Test Author");
    await page.getByRole("button", { name: "Save result & mark completed" }).click();

    await expect(page.getByRole("button", { name: "Completed", exact: true })).toBeDisabled();
    await expect(page.getByText("All panels within normal limits.")).toBeVisible();
    await expect(page.getByText(/Reported .* by Dr\. Test Author/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Update result" })).toBeVisible();
  });

  test("rejects an empty result summary client-side", async ({ page }) => {
    await openOrder(page, "LO-E2E-001");
    await page.getByRole("button", { name: "Save result & mark completed" }).click();
    await expect(page.getByText("Result summary is required")).toBeVisible();
    // Status must not have changed as a side effect of the rejected submit.
    await expect(page.getByRole("button", { name: "Pending", exact: true })).toBeDisabled();
  });

  test("hides the result form for a cancelled order", async ({ page }) => {
    await openOrder(page, "LO-E2E-004"); // seeded as CANCELLED
    await expect(page.getByRole("heading", { name: "Record result" })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Update result" })).not.toBeVisible();
  });

  test("shows a pre-existing result and allows updating it", async ({ page }) => {
    await openOrder(page, "LO-E2E-003"); // seeded as COMPLETED with a CRITICAL result

    await expect(page.getByTestId("result-summary-display")).toHaveText(
      "TSH elevated significantly."
    );
    await expect(page.getByText(/Reported .* by Dr\. Elena Vasquez/)).toBeVisible();

    await page.getByLabel("Summary").fill("Repeat panel confirms normal TSH.");
    await page.getByLabel("Flag").selectOption("NORMAL");
    await page.getByRole("button", { name: "Save result & mark completed" }).click();

    await expect(page.getByTestId("result-summary-display")).toHaveText(
      "Repeat panel confirms normal TSH."
    );
  });

  test("returns a 404 page for an unknown order id", async ({ page }) => {
    const response = await page.goto("/labs/does-not-exist");
    expect(response?.status()).toBe(404);
  });
});
