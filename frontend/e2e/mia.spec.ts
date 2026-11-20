import { expect, test } from "@playwright/test";

test("stage 4: carried context can be cleared and other courses do not get algebra results", async ({
  page,
}) => {
  await page.goto(
    "/courses/math-7/materials/equations-1?selection=example-02&page=2",
  );
  await expect(
    page.getByRole("heading", { name: "第 3 章 · 一元一次方程.pdf" }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "主导航" });
  const panel = page.getByRole("dialog", { name: "Mia" });
  await page.getByRole("button", { name: "打开 Mia" }).click();
  await expect(
    panel.getByText("第 2 页 · 3(x − 2) = 12", { exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "关闭 Mia" }).click();
  await nav.getByRole("link", { name: "今日", exact: true }).click();
  await page.getByRole("button", { name: "打开 Mia" }).click();
  await expect(
    panel.getByText("第 2 页 · 3(x − 2) = 12", { exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "清除带入的学习上下文" }).click();
  await expect(panel).toBeVisible();
  await expect(panel.locator('[aria-label="学习上下文"]')).toHaveCount(0);
  await panel.getByRole("button", { name: "关闭 Mia" }).click();

  await nav.getByRole("link", { name: "课程", exact: true }).click();
  await page.getByRole("link", { name: /初中科学/ }).click();
  await page
    .getByRole("navigation", { name: "课程视图" })
    .getByRole("button", { name: "Tutor" })
    .click();
  await page.getByRole("button", { name: "进入 Tutor" }).click();
  await panel.getByRole("button", { name: "开始分步辅导" }).click();
  await expect(panel.getByText(/这门课程暂未配置模拟辅导/)).toBeVisible();
  await expect(panel.getByRole("button", { name: "查看复盘" })).toHaveCount(0);
});

test("stage 4: mock media can be denied and text tutoring still works", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (navigator.mediaDevices) {
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        value: () => {
          throw new Error("Demo must not access real media devices");
        },
      });
    }
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "打开 Mia" }).click();
  const panel = page.getByRole("dialog", { name: "Mia" });
  await expect(panel.getByText("模拟演示", { exact: true })).toBeVisible();
  const input = panel.getByRole("textbox", { name: "输入你的问题" });

  await panel.getByRole("button", { name: "模拟语音输入" }).click();
  await panel.getByRole("button", { name: "模拟拒绝" }).click();
  await expect(panel.getByText("模拟权限已拒绝，仍可输入文字。")).toBeVisible();
  await expect(input).toBeFocused();
  await panel.getByRole("button", { name: "模拟拍题" }).click();
  await panel.getByRole("button", { name: "填入演示内容" }).click();
  await expect(input).toHaveValue(/3\(x − 2\) = 12/);
  await input.fill("我得到 x - 2 = 4");
  await panel.getByRole("button", { name: "发送" }).click();
  await expect(
    panel.getByText(/你抓住了等式两边做相同运算的要点/),
  ).toBeVisible();
  await expect(panel.getByRole("button", { name: "查看复盘" })).toBeEnabled();
  expect(errors).toEqual([]);
});

test("stage 4: stopping a mock reply leaves the conversation usable", async ({
  page,
}) => {
  await page.goto(
    "/courses/math-7/materials/equations-1?selection=example-02&page=2",
  );
  await page.getByRole("button", { name: "打开 Mia" }).click();
  const panel = page.getByRole("dialog", { name: "Mia" });
  await panel.getByRole("button", { name: "开始分步辅导" }).click();
  await panel.getByRole("button", { name: "停止回复" }).click();
  await expect(
    panel.getByText("已停止当前回复", { exact: true }),
  ).toBeVisible();
  await expect(panel.getByRole("button", { name: "查看复盘" })).toHaveCount(0);

  const input = panel.getByRole("textbox", { name: "输入你的问题" });
  await input.fill("我得到 x - 2 = 4");
  await panel.getByRole("button", { name: "发送" }).click();
  await expect(
    panel.getByText(/你抓住了等式两边做相同运算的要点/),
  ).toBeVisible();
  await expect(panel.getByRole("button", { name: "查看复盘" })).toBeEnabled();
  await expect(
    panel.getByText("已停止当前回复", { exact: true }),
  ).toBeVisible();
});
