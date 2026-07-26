import { expect, test } from "@playwright/test";

test("owner can sign in and see the persisted perfect day", async ({ page }) => {
  const email = process.env.E2E_OWNER_EMAIL;
  const password = process.env.E2E_OWNER_PASSWORD;
  if (!email || !password) {
    throw new Error("E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD are required");
  }

  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "書斎へ入る" }).click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "本日の任務" })).toBeVisible();
  await expect(page.getByText("5/5 完了")).toBeVisible();
  await expect(page.getByText("PERFECT", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("5/5 完了")).toBeVisible();
});
