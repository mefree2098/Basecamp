import { expect, test } from "@playwright/test";

test("home page exposes the simplified founder navigator", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Founder’s Navigator" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  await expect(page.getByText("Startup State assistant")).toBeVisible();
  await expect(page.getByText("Recommended pages open here")).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
  await expect(page.getByRole("link", { name: "AI" })).toHaveCount(0);
  await expect(page.getByText("Guided")).toHaveCount(0);
  await expect(page.getByText("Manual")).toHaveCount(0);
  await expect(page.locator('img[src*="basecamp-guide-avatar"]')).toHaveCount(0);
});
