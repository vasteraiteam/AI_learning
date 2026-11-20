import { expect, test } from "@playwright/test";

test("math unit links the reader and both practices; Today resumes the exact problem", async ({
  page,
}) => {
  await page.goto("/courses/math-7");
  await page.getByRole("link", { name: "进入单元" }).click();
  await expect(page).toHaveURL(/\/units\/equations$/);
  await expect(page.getByRole("heading", { name: "学习目标" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "阅读导学" })).toBeVisible();

  await page.getByRole("link", { name: /校准观测站的刻度/ }).click();
  await expect(
    page.getByRole("heading", { name: "校准观测站的刻度" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "切回普通练习" }).click();
  await expect(
    page.getByRole("heading", { name: "解一元一次方程" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "返回单元" }).click();

  await page.getByRole("link", { name: /一元一次方程\.pdf/ }).click();
  const next = page.getByRole("button", { name: "下一页" });
  await expect(page).toHaveURL(/page=1/);
  await next.click();
  const exercise = page.getByRole("button", { name: "选择例题 02" });
  await exercise.click();
  const summary = new URL(
    (await page.getByRole("link", { name: "生成摘要" }).getAttribute("href")) ??
      "",
    page.url(),
  );
  expect(summary.pathname).toBe("/tools");
  expect(summary.searchParams.get("materialId")).toBe("equations-1");
  expect(summary.searchParams.get("page")).toBe("2");
  expect(summary.searchParams.get("selection")).toBe("example-02");

  await page.goto("/");
  await page.getByRole("link", { name: "接着学" }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname.endsWith("/materials/equations-1") &&
      url.searchParams.get("page") === "2" &&
      url.searchParams.get("selection") === "example-02",
  );
  await expect(exercise).toHaveAttribute("aria-pressed", "true");
});

const choices = [
  {
    course: "science-7",
    unit: "plants",
    exercise: "比较两盆植物",
    wrong: "两盆一样，因为都有水和空气。",
    answer: "有光处的植物，因为光提供能量。",
    feedback: "光给光合作用提供能量",
    hint: "找出唯一发生变化的条件",
  },
  {
    course: "english-pet",
    unit: "dialogue",
    exercise: "在图书馆借笔",
    passage: "Could I borrow your pen, please?",
    wrong: "Ask the librarian to fill in a form.",
    answer: "Borrow a pen from the librarian.",
    feedback: "原文“Could I borrow your pen, please?”",
    hint: "先区分背景和请求",
  },
];

for (const example of choices) {
  test(`${example.course} exercise checks the answer, carries Mia context, and returns to the unit`, async ({
    page,
  }) => {
    await page.goto(`/courses/${example.course}`);
    await page.getByRole("link", { name: "进入单元" }).click();
    await page
      .getByRole("link", { name: new RegExp(example.exercise) })
      .click();
    if (example.passage)
      await expect(page.getByText(example.passage)).toBeVisible();
    await page.getByRole("radio", { name: example.wrong }).check();
    await page.getByRole("button", { name: "核对答案" }).click();
    await expect(page.getByRole("status")).toContainText("这个选项还不合适");
    await page.getByRole("radio", { name: example.answer }).check();
    await page.getByRole("button", { name: "核对答案" }).click();
    await expect(page.getByRole("status")).toContainText(example.feedback);

    await page.getByRole("button", { name: "问 Mia" }).click();
    const panel = page.getByRole("dialog", { name: "Mia" });
    await expect(panel.getByLabel("学习上下文", { exact: true })).toContainText(
      example.exercise,
    );
    await panel.getByRole("button", { name: "开始分步辅导" }).click();
    await expect(panel.getByText(new RegExp(example.hint))).toBeVisible();
    await panel.getByRole("button", { name: "关闭 Mia" }).click();
    await page.getByRole("link", { name: "返回单元" }).click();
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === `/courses/${example.course}/units/${example.unit}` &&
        !url.search,
    );
    await expect(page.getByRole("heading", { name: "学习目标" })).toBeVisible();
  });
}
