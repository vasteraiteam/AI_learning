import { expect, test } from "@playwright/test";

test("stage 5: review a course exercise with Mia and confirm the recap in Space", async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  const external: string[] = [];
  const origin = new URL(baseURL!).origin;
  context.on("request", (request) => {
    const url = new URL(request.url());
    if (/^https?:$/.test(url.protocol) && url.origin !== origin)
      external.push(url.origin);
  });

  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "主导航" });
  await nav.getByRole("link", { name: "课程", exact: true }).click();
  await page.getByRole("link", { name: /初中数学/ }).click();
  await expect(page).toHaveURL(/\/courses\/math-7$/);
  await page
    .getByRole("navigation", { name: "课程视图" })
    .getByRole("button", { name: "材料" })
    .click();
  await page.getByRole("link", { name: /一元一次方程\.pdf/ }).click();
  const exercise = page.getByRole("button", { name: "选择例题 02" });
  await exercise.click();
  await expect(exercise).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator('.material-viewport [data-page-number="2"] canvas'),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("01-material.png") });

  await page.getByRole("button", { name: "打开 Mia" }).click();
  const panel = page.getByRole("dialog", { name: "Mia" });
  await expect(panel.getByText("模拟演示", { exact: true })).toBeVisible();
  await expect(
    panel.getByText("第 2 页 · 3(x − 2) = 12", { exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "开始分步辅导" }).click();
  await expect(
    panel.getByText(/等式两边都除以 3，左边会剩下什么/),
  ).toBeVisible();
  await expect(panel.getByRole("button", { name: "查看复盘" })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("02-mia.png") });
  await panel.getByRole("button", { name: "查看复盘" }).click();

  const title = "我的方程复盘 · 例题 02";
  const explanation =
    "我会先在等式两边同除以 3，再检查每一步是否保持等式成立。";
  await panel.getByRole("textbox", { name: "复盘标题" }).fill(title);
  const body = panel.getByRole("textbox", { name: "复盘内容" });
  await expect(body).toHaveValue(/不是成绩或掌握判定/);
  await body.fill(explanation);

  const otherTab = await context.newPage();
  await otherTab.goto("/space");
  await expect(
    otherTab.getByRole("heading", { name: "等式的性质 · 课堂笔记" }),
  ).toBeVisible();
  await expect(
    otherTab.getByRole("button", { name: new RegExp(title) }),
  ).toHaveCount(0);
  await otherTab.close();

  await panel.getByRole("button", { name: "确认保存" }).click();
  await expect(panel.getByRole("status")).toContainText("已保存到空间");
  await panel.getByRole("link", { name: "前往空间" }).click();
  await expect(page).toHaveURL(/\/space\?artifact=/);
  await expect(panel).toBeHidden();
  const preview = page.getByRole("region", { name: "成果预览" });
  await expect(preview.getByRole("heading", { name: title })).toBeVisible();
  await expect(preview.getByText(explanation, { exact: true })).toBeVisible();
  const source = preview.getByRole("link", {
    name: /一元一次方程\.pdf.*第 2 页/,
  });
  await expect(source).toHaveAttribute(
    "href",
    /\/courses\/math-7\/materials\/equations-1/,
  );
  await page.reload();
  await expect(preview.getByRole("heading", { name: title })).toBeVisible();
  await expect(
    page.getByRole("button", { name: new RegExp(title) }),
  ).toHaveCount(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await page.screenshot({ path: testInfo.outputPath("03-space.png") });

  await nav.getByRole("link", { name: "成长", exact: true }).click();
  const evidence = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: `已确认：${title}` }) });
  await expect(evidence.getByText("学生已确认", { exact: true })).toBeVisible();
  expect(external).toEqual([]);
});
