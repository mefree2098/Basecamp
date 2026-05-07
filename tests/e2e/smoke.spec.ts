import { expect, test } from "@playwright/test";

test("home page exposes the simplified founder navigator", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What are you trying to do?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Find my first stop" })).toBeVisible();
  await expect(page.getByLabel("Basecamp guide status: Basecamp guide ready")).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
  await expect(page.getByRole("link", { name: "AI" })).toHaveCount(0);
  await expect(page.locator('img[src*="basecamp-guide-avatar"]')).toHaveCount(0);
});
