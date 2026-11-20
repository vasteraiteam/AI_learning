import { expect, test } from "@playwright/test";

test("stage 2: today's task can be toggled and keeps its state after reload", async ({
  page,
}) => {
  await page.goto("/");
  const task = page.getByRole("checkbox", {
    name: "完成一元一次方程的变式练习",
  });
  await expect(task).not.toBeChecked();
  await expect(page.getByText("已完成 1 / 3")).toBeVisible();

  await task.click();
  await expect(task).toBeChecked();
  await expect(page.getByText("已完成 2 / 3")).toBeVisible();

  await page.reload();
  await expect(task).toBeChecked();
  await task.click();
  await expect(page.getByText("已完成 1 / 3")).toBeVisible();
  await expect(task).not.toBeChecked();
});

test("stage 2: the math course has materials, practice, and an optional challenge", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "接着学" }).click();
  await expect(page).toHaveURL(/\/courses\/math-7$/);
  await expect(page.getByRole("heading", { name: "初中数学" })).toBeVisible();
  const courseViews = page.getByRole("navigation", { name: "课程视图" });

  await courseViews.getByRole("button", { name: "材料", exact: true }).click();
  await expect(
    page.getByRole("link", { name: /一元一次方程\.pdf/ }),
  ).toHaveAttribute("href", "/courses/math-7/materials/equations-1");

  await courseViews.getByRole("button", { name: "练习", exact: true }).click();
  const answer = page.getByRole("textbox", { name: "你的 x 值" });
  const check = page.getByRole("button", { name: "核对答案" });
  await answer.fill("5");
  await check.click();
  await expect(page.getByRole("status")).toContainText("两边还不相等");
  await answer.fill("7");
  await check.click();
  await expect(page.getByRole("status")).toContainText("核对通过");

  await courseViews.getByRole("button", { name: "学习世界" }).click();
  await expect(page.getByText(/可选挑战/)).toBeVisible();
  await expect(answer).toHaveValue("");
  await answer.fill("3");
  await check.click();
  await expect(page.getByRole("status")).toContainText("刻度校准成功");
  await page.getByRole("button", { name: "切回普通练习" }).click();
  await expect(
    page.getByRole("heading", { name: "解一元一次方程" }),
  ).toBeVisible();
});

test("stage 2: an edited tool draft can be confirmed and reopened in Space", async ({
  page,
}) => {
  await page.goto("/tools");
  await page.getByRole("button", { name: /^闪卡/ }).click();
  await page.getByRole("textbox", { name: "材料或知识点" }).fill("等式的性质");
  await page.getByRole("button", { name: "生成草稿" }).click();

  const draft = page.getByRole("region", { name: "草稿预览" });
  await expect(draft.getByText("模拟生成", { exact: true })).toBeVisible();
  const title = "我的等式闪卡";
  const body = "问：等式两边同除以一个数，需要什么条件？答：除数不为零。";
  await draft.getByRole("textbox", { name: "草稿标题" }).fill(title);
  await draft.getByText("附注", { exact: true }).click();
  await draft.getByRole("textbox", { name: "草稿内容" }).fill(body);
  await draft.getByRole("button", { name: "确认保存到空间" }).click();
  await expect(draft.getByRole("status")).toContainText("已保存到空间");
  await draft.getByRole("link", { name: "查看成果" }).click();

  await expect(page).toHaveURL(/\/space\?artifact=[^&]+$/);
  const saved = page.getByRole("region", { name: "成果预览" });
  await expect(saved.getByRole("heading", { name: title })).toBeVisible();
  await expect(saved.getByText(body)).toBeVisible();
  await page.reload();
  await expect(saved.getByText(body)).toBeVisible();

  const filter = page.getByRole("group", { name: "成果筛选" });
  await filter.getByRole("button", { name: "笔记", exact: true }).click();
  await expect(saved.getByRole("heading", { name: title })).toHaveCount(0);
  await filter.getByRole("button", { name: "成果", exact: true }).click();
  await expect(saved.getByRole("heading", { name: title })).toBeVisible();
});

test("stage 2: Growth distinguishes activity, AI inference, and student confirmation", async ({
  page,
}) => {
  await page.goto("/growth");
  const timeline = page.getByRole("main").getByRole("list");
  const mastery = timeline.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: "练习过等式的基本性质" }),
  });
  const discovery = timeline.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: "建议复习括号外的系数" }),
  });
  const creation = timeline
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: "整理了整式加减笔记" }) });
  await expect(mastery.getByText("活动记录", { exact: true })).toBeVisible();
  await expect(discovery.getByText("AI 推断", { exact: true })).toBeVisible();
  await expect(discovery).toContainText("不代表掌握情况或正式成绩");
  await expect(creation.getByText("学生已确认", { exact: true })).toBeVisible();

  const filters = page.getByRole("group", { name: "成长记录筛选" });
  await filters.getByRole("button", { name: "探索", exact: true }).click();
  await expect(discovery).toBeVisible();
  await expect(mastery).toHaveCount(0);
  await expect(creation).toHaveCount(0);
});
