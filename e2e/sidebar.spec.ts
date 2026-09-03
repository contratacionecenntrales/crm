import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/testDb";

test.beforeAll(() => resetDb());

test.describe("Sidebar navigation", () => {
  test("lists all modules and marks unbuilt ones as coming soon", async ({ page }) => {
    await page.goto("/labs");
    const sidebar = page.locator("aside");

    await expect(sidebar.getByRole("link", { name: /Laboratorio/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Sales CRM/ })).toBeVisible();
    await expect(sidebar.getByText("Pronto")).not.toHaveCount(0);
  });

  test("navigates to a coming-soon module and shows its placeholder", async ({ page }) => {
    await page.goto("/labs");
    await page.locator("aside").getByRole("link", { name: /Sales CRM/ }).click();
    await expect(page).toHaveURL(/\/sales-crm$/);
    await expect(page.getByRole("heading", { name: "Sales CRM" })).toBeVisible();
    await expect(page.getByText("Próximamente")).toBeVisible();
  });

  test("keeps the sidebar visible while navigating between modules", async ({ page }) => {
    await page.goto("/sales-crm");
    await expect(page.getByText("Bóveda Labs24K")).toBeVisible();
    await page.locator("aside").getByRole("link", { name: /^Laboratorio/ }).click();
    await expect(page).toHaveURL(/\/labs$/);
    await expect(page.getByRole("heading", { name: "Laboratorio" })).toBeVisible();
  });
});
