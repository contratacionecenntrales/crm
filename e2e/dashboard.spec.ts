import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/testDb";

test.beforeAll(() => resetDb());

test.describe("Labs Command Center dashboard", () => {
  test("shows stat tiles reflecting the seeded orders", async ({ page }) => {
    await page.goto("/labs");
    await expect(page.getByRole("heading", { name: "Labs Command Center 360" })).toBeVisible();

    await expect(page.getByTestId("stat-total-value")).toHaveText("4");
    await expect(page.getByTestId("stat-pending-value")).toHaveText("1");
    await expect(page.getByTestId("stat-in-progress-value")).toHaveText("1");
    await expect(page.getByTestId("stat-completed-value")).toHaveText("1");
    await expect(page.getByTestId("stat-cancelled-value")).toHaveText("1");
    await expect(page.getByTestId("stat-critical-value")).toHaveText("1");
  });

  test("lists all four seeded orders by default", async ({ page }) => {
    await page.goto("/labs");
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(4);
    await expect(page.getByRole("link", { name: "LO-E2E-001" })).toBeVisible();
    await expect(page.getByRole("link", { name: "LO-E2E-002" })).toBeVisible();
    await expect(page.getByRole("link", { name: "LO-E2E-003" })).toBeVisible();
    await expect(page.getByRole("link", { name: "LO-E2E-004" })).toBeVisible();
  });

  test("filters the table by status", async ({ page }) => {
    await page.goto("/labs");

    await page.getByRole("button", { name: "Completed", exact: true }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "LO-E2E-003" })).toBeVisible();

    await page.getByRole("button", { name: "Cancelled", exact: true }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "LO-E2E-004" })).toBeVisible();

    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(4);
  });

  test("searches across order number, test name, and patient name", async ({ page }) => {
    await page.goto("/labs");
    const search = page.getByPlaceholder("Search order #, test, or patient...");

    await search.fill("Ana Torres");
    await expect(page.locator("table tbody tr")).toHaveCount(2);

    await search.fill("Thyroid");
    await expect(page.locator("table tbody tr")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "LO-E2E-003" })).toBeVisible();

    await search.fill("LO-E2E-004");
    await expect(page.locator("table tbody tr")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "LO-E2E-004" })).toBeVisible();

    await search.fill("no-such-order-xyz");
    await expect(page.getByText("No lab orders match your filters.")).toBeVisible();
  });

  test("navigates to order detail from the table", async ({ page }) => {
    await page.goto("/labs");
    await page.getByRole("link", { name: "LO-E2E-001" }).click();
    await expect(page).toHaveURL(/\/labs\/[^/]+$/);
    await expect(page.getByRole("heading", { name: /LO-E2E-001/ })).toBeVisible();
  });
});
