import { expect, test, type Page } from "@playwright/test";

const original =
  "/courses/math-7/materials/equations-1?page=2&selection=example-02";
const taskTitle = "重练例题 02 · 我的复习计划";

const miaDialog = (page: Page) => page.getByRole("dialog", { name: "Mia" });
const originalExercise = (page: Page) =>
  page.getByRole("button", { name: "选择例题 02" });
const todayMenu = (page: Page) =>
  page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("link", { name: "今日", exact: true });

function localDate(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function waitForDecision(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/api\/review\/proposals\/[^/]+\/decision$/.test(response.url()),
  );
}

async function openMia(page: Page) {
  await page.getByRole("button", { name: "打开 Mia" }).click();
  const panel = miaDialog(page);
  await expect(
    panel.getByText("第 2 页 · 3(x − 2) = 12", { exact: true }),
  ).toBeVisible();
  return panel;
}

async function saveRecap(page: Page, withGuidedAnswer = false) {
  await page.goto(original);
  await expect(originalExercise(page)).toHaveAttribute("aria-pressed", "true");
  const panel = await openMia(page);
  await panel.getByRole("button", { name: "开始分步辅导" }).click();
  await expect(
    panel.getByText(/等式两边都除以 3，左边会剩下什么/),
  ).toBeVisible();
  if (withGuidedAnswer) {
    const answer = panel.getByRole("textbox", { name: "辅导答案" });
    const check = panel.getByRole("button", { name: "核对辅导答案" });
    await answer.fill("5");
    await check.click();
    await expect(panel.getByText(/可以代回原式检查/)).toBeVisible();
    await expect(panel.getByText("已记录：在提示下完成")).toHaveCount(0);
    await answer.fill("6");
    await check.click();
    await expect(panel.getByText("已记录：在提示下完成")).toBeVisible();
  }
  await panel.getByRole("button", { name: "查看复盘" }).click();
  await expect(panel.getByRole("textbox", { name: "复盘内容" })).toHaveValue(
    withGuidedAnswer ? /提示后提交了 x = 6/ : /本次尚未核对原题答案/,
  );
  await panel.getByRole("button", { name: "确认保存" }).click();
  await expect(panel.getByRole("status")).toContainText("已保存到空间");
  return panel.getByRole("region", { name: "复习建议" });
}

test("V1.1: confirm once, reopen the original exercise, and distinguish practice evidence", async ({
  page,
  context,
}, testInfo) => {
  const proposal = await saveRecap(page, true);
  const date = localDate(2);
  await expect(proposal.getByLabel("复习日期")).toHaveValue(localDate(1));
  await proposal.getByRole("textbox", { name: "复习标题" }).fill(taskTitle);
  await proposal.getByLabel("复习日期").fill(date);

  const otherTab = await context.newPage();
  await otherTab.goto("/");
  await expect(
    otherTab.getByText("复习 PET 词汇", { exact: true }),
  ).toBeVisible();
  await expect(otherTab.getByRole("link", { name: "开始复习" })).toHaveCount(0);
  await otherTab.close();

  const decision = waitForDecision(page);
  await proposal.getByRole("button", { name: "确认安排复习" }).click();
  const response = await decision;
  expect(response.ok()).toBeTruthy();
  const confirmed = await response.json();
  expect(confirmed).toMatchObject({
    status: "confirmed",
    title: taskTitle,
    dueDate: date,
  });
  await expect(proposal.getByText("已安排复习", { exact: true })).toBeVisible();
  await expect(
    proposal.getByRole("button", { name: "确认安排复习" }),
  ).toHaveCount(0);
  const retries = await page.evaluate(
    async ({ url, date }) => {
      const retry = () =>
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: "confirm",
            title: "不能覆盖原任务",
            dueDate: date,
          }),
        }).then(async (response) => ({
          ok: response.ok,
          body: await response.json(),
        }));
      return Promise.all([retry(), retry()]);
    },
    { url: response.url(), date },
  );
  expect(retries).toEqual([0, 1].map(() => ({ ok: true, body: confirmed })));

  await proposal.getByRole("link", { name: "查看今日" }).click();
  await page.reload();
  await expect(page.getByText(taskTitle, { exact: true })).toHaveCount(1);
  await expect(page.locator(`time[datetime="${date}"]`)).toBeVisible();
  await expect(page.getByText("不能覆盖原任务", { exact: true })).toHaveCount(
    0,
  );
  const start = page.getByRole("link", { name: "开始复习" });
  await expect(start).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("v1.1-today.png") });
  await start.click();
  await expect(page).toHaveURL(/\/courses\/math-7\/materials\/equations-1\?/);
  const url = new URL(page.url());
  expect(url.pathname).toBe(new URL(original, url.origin).pathname);
  expect(url.searchParams.get("page")).toBe("2");
  expect(url.searchParams.get("selection")).toBe("example-02");
  expect(url.searchParams.get("reviewTask")).toBe(confirmed.taskId);
  await expect(originalExercise(page)).toHaveAttribute("aria-pressed", "true");
  const practice = page.getByRole("region", { name: "独立变式练习" });
  await expect(
    practice.getByText("5(x − 2) = 30", { exact: true }),
  ).toBeVisible();
  const answer = practice.getByRole("textbox", { name: "你的 x 值" });
  const submit = practice.getByRole("button", { name: "提交答案" });
  await answer.fill("7");
  await submit.click();
  await expect(practice.getByText(/这个值还不能使等式两边相等/)).toBeVisible();
  await expect(practice.getByText("独立练习已完成")).toHaveCount(0);
  const growthTab = await context.newPage();
  await growthTab.goto("/growth");
  await expect(
    growthTab.getByText("有提示练习", { exact: true }),
  ).toBeVisible();
  await expect(growthTab.getByText("独立练习", { exact: true })).toHaveCount(0);
  await growthTab.close();

  await answer.fill("8");
  await submit.click();
  await expect(practice.getByText("独立练习已完成")).toBeVisible();
  await page.reload();
  await expect(practice.getByText("独立练习已完成")).toBeVisible();
  await practice.getByRole("link", { name: "查看成长记录" }).click();
  await page.reload();
  const assisted = page.getByRole("listitem").filter({
    has: page.getByText("有提示练习", { exact: true }),
  });
  const independent = page.getByRole("listitem").filter({
    has: page.getByText("独立练习", { exact: true }),
  });
  await expect(assisted).toHaveCount(1);
  await expect(independent).toHaveCount(1);
  await expect(assisted).toContainText("不代表独立掌握");
  await expect(independent).toContainText("不是掌握判定");
  await page.getByRole("button", { name: "掌握", exact: true }).click();
  await expect(assisted).toHaveCount(0);
  await expect(independent).toHaveCount(0);
  await page.getByRole("button", { name: "练习", exact: true }).click();
  await expect(assisted).toHaveCount(1);
  await expect(independent).toHaveCount(1);
  await expect(independent.getByRole("link")).toHaveAttribute(
    "href",
    /reviewTask=/,
  );
  await page.screenshot({ path: testInfo.outputPath("v1.1-growth.png") });
  await todayMenu(page).click();
  await expect(page.getByRole("link", { name: "查看复习" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "开始复习" })).toHaveCount(0);
});

test("V1.1: rejection survives refresh and cannot create a task on retry", async ({
  page,
}) => {
  const proposal = await saveRecap(page);
  const decision = waitForDecision(page);
  await proposal.getByRole("button", { name: "拒绝建议" }).click();
  const response = await decision;
  expect(response.ok()).toBeTruthy();
  await expect(proposal.getByText("已拒绝复习建议")).toBeVisible();
  await miaDialog(page).getByRole("link", { name: "前往空间" }).click();
  await expect(page).toHaveURL(/\/space\?artifact=/);
  await page.reload();
  const preview = page.getByRole("region", { name: "成果预览" });
  await expect(preview.getByText("已拒绝复习建议")).toBeVisible();
  await expect(
    preview.getByRole("button", { name: "确认安排复习" }),
  ).toHaveCount(0);
  const lateConfirmation = await page.evaluate(
    async ({ url, date }) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "confirm",
          title: "不应生成复习任务",
          dueDate: date,
        }),
      });
      return { ok: response.ok, body: await response.json() };
    },
    { url: response.url(), date: localDate(1) },
  );
  expect(lateConfirmation).toMatchObject({
    ok: true,
    body: { status: "rejected" },
  });
  await todayMenu(page).click();
  await expect(page.getByText("复习 PET 词汇", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "开始复习" })).toHaveCount(0);
  await expect(page.getByText("不应生成复习任务", { exact: true })).toHaveCount(
    0,
  );
});

test("V1.1: Mia keeps the original problem and text draft when the reader changes page", async ({
  page,
}, testInfo) => {
  await page.goto(original);
  await expect(originalExercise(page)).toHaveAttribute("aria-pressed", "true");
  const panel = await openMia(page);
  const draft = panel.getByRole("textbox", { name: "输入你的问题" });
  await draft.fill("为什么等式两边要同除以 3？");
  const desktop = page.viewportSize()!.width >= 1024;
  if (desktop) {
    await expect(panel).not.toHaveAttribute("aria-modal", "true");
    const readerBounds = await page.locator(".material-viewport").boundingBox();
    const panelBounds = await panel.boundingBox();
    expect(readerBounds!.x + readerBounds!.width).toBeLessThanOrEqual(
      panelBounds!.x,
    );
  } else {
    await panel.getByRole("button", { name: "关闭 Mia" }).click();
  }
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page).toHaveURL(/page=3/);
  if (!desktop) await openMia(page);
  await expect(panel.getByRole("button", { name: "使用当前页" })).toBeVisible();
  await expect(draft).toHaveValue("为什么等式两边要同除以 3？");
  await page.screenshot({ path: testInfo.outputPath("v1.1-mia.png") });
  await panel.getByRole("link", { name: "回到题目" }).click();
  await expect(page).toHaveURL(
    /page=2.*selection=example-02.*#material-exercise/,
  );
  await expect(originalExercise(page)).toHaveAttribute("aria-pressed", "true");
  if (!desktop) {
    await expect(panel).toBeHidden();
    await expect(page.locator("#material-exercise")).toBeFocused();
    await openMia(page);
  }
  await expect(draft).toHaveValue("为什么等式两边要同除以 3？");
  const { width, documentWidth } = await page.evaluate(() => ({
    width: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(documentWidth).toBeLessThanOrEqual(width);
});
