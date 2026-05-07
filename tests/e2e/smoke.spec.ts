import { expect, test } from "@playwright/test";

test("home page exposes founder navigator and map", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Basecamp Command Center" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Build my path" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Utah Startup Map" })).toBeVisible();
});
