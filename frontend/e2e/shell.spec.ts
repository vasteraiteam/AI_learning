import { expect, test } from "@playwright/test";

test("stage 1: five destinations and a persistent Mia entry", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "打开 Mia" })).toBeVisible();
  for (const [name, url] of [
    ["课程", "/courses"],
    ["工具", "/tools"],
    ["空间", "/space"],
    ["成长", "/growth"],
    ["今日", "/"],
  ]) {
    const link = page
      .getByRole("navigation", { name: "主导航" })
      .getByRole("link", { name, exact: true });
    await link.click();
    await expect(page).toHaveURL(new RegExp(url === "/" ? "\\/$" : `${url}$`));
    await expect(page.getByRole("button", { name: "打开 Mia" })).toBeVisible();
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
});
