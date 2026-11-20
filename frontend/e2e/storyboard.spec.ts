import { expect, test, type Page } from "@playwright/test";
import type { Artifact } from "../src/api/contracts";

const exampleRoute =
  "/courses/math-7/materials/equations-1?page=2&selection=example-02";
const editedNarration = "把等式两边想成天平的两端，先说出括号外的乘数。";

async function savedStoryboards(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/space");
    if (!response.ok)
      throw new Error(`Failed to read Space: ${response.status}`);
    const artifacts: Artifact[] = await response.json();
    return artifacts.filter(({ kind }) => kind === "storyboard");
  });
}

test("B1: retry and preview a simulated storyboard before saving it with its original source", async ({
  page,
}) => {
  await page.goto(exampleRoute);
  const example = page.getByRole("button", { name: "选择例题 02" });
  const launcher = page.getByRole("button", { name: "打开 Mia" });
  const panel = page.getByRole("dialog", { name: "Mia" });
  const source = panel.locator('[aria-label="学习上下文"]');
  const storyboard = panel.getByRole("region", { name: "讲解分镜（演示）" });
  const firstScene = storyboard.getByRole("heading", { name: "展示原题" });

  await expect(example).toHaveAttribute("aria-pressed", "true");
  await launcher.click();
  await expect(source).toContainText("第 2 页 · 3(x − 2) = 12");
  await storyboard.getByRole("button", { name: "预览分镜脚本" }).click();
  const narration = storyboard.getByRole("textbox", { name: "第 1 幕旁白" });
  await expect(narration).not.toHaveValue("");
  await narration.fill(editedNarration);
  await expect(storyboard.getByRole("status")).toHaveCount(0);
  expect(await savedStoryboards(page)).toHaveLength(0);
  await storyboard.getByRole("checkbox", { name: "模拟首次失败" }).check();
  await storyboard.getByRole("button", { name: "确认生成分镜" }).click();
  await expect(storyboard.getByRole("status")).toContainText("已排队");
  await expect(storyboard.getByRole("status")).toContainText("正在生成");
  await expect(
    storyboard.getByRole("button", { name: "确认生成分镜" }),
  ).toHaveCount(0);
  await expect(storyboard.getByRole("alert")).toContainText("模拟生成失败");
  await expect(
    storyboard.getByText(editedNarration, { exact: false }),
  ).toBeVisible();
  await expect(
    storyboard.getByRole("button", { name: "保存到空间" }),
  ).toHaveCount(0);
  expect(await savedStoryboards(page)).toHaveLength(0);

  await storyboard.getByRole("button", { name: "重试" }).click();
  const sessions = panel.getByRole("combobox", { name: "切换辅导会话" });
  const exampleOption = await sessions.inputValue();
  await sessions.selectOption({ label: "通用对话" });
  await expect(storyboard).toBeHidden();
  await expect(source).toBeHidden();
  await sessions.selectOption(exampleOption);
  await expect(firstScene).toBeVisible();
  await expect(storyboard.getByText("画面 3(x − 2) = 12")).toBeVisible();
  await expect(
    storyboard.getByText(editedNarration, { exact: false }),
  ).toBeVisible();
  await storyboard.getByRole("button", { name: "下一幕" }).click();
  await expect(
    storyboard.getByRole("heading", { name: "看清条件" }),
  ).toBeVisible();
  await storyboard.getByRole("button", { name: "上一幕" }).click();
  await expect(firstScene).toBeVisible();
  expect(await savedStoryboards(page)).toHaveLength(0);

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(launcher).toBeFocused();
  await launcher.click();
  await expect(firstScene).toBeVisible();
  await expect(source).toContainText("第 2 页 · 3(x − 2) = 12");

  await page.reload();
  await expect(example).toHaveAttribute("aria-pressed", "true");
  await launcher.click();
  await expect(firstScene).toBeVisible();
  await expect(source).toContainText("第 2 页 · 3(x − 2) = 12");
  await expect(
    storyboard.getByText(editedNarration, { exact: false }),
  ).toBeVisible();
  expect(await savedStoryboards(page)).toHaveLength(0);
  await storyboard.getByRole("button", { name: "保存到空间" }).click();
  await expect(storyboard.getByRole("status")).toHaveText("已保存到空间");

  const saved = await savedStoryboards(page);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({
    body: expect.stringContaining(editedNarration),
    content: {
      type: "storyboard",
      scenes: expect.arrayContaining([
        expect.objectContaining({
          title: "展示原题",
          visual: "3(x − 2) = 12",
          narration: editedNarration,
        }),
      ]),
    },
    source: {
      courseId: "math-7",
      materialId: "equations-1",
      page: 2,
      selectionId: "example-02",
    },
  });
  await storyboard.getByRole("link", { name: "前往空间" }).click();
  await expect(page).toHaveURL(/\/space\?artifact=/);
  const preview = page.getByRole("region", { name: "成果预览" });
  await expect(
    preview.getByRole("heading", { name: saved[0].title }),
  ).toBeVisible();
  await expect(preview.getByText("模拟分镜，未生成视频。")).toBeVisible();
  await expect(preview.getByRole("link", { name: /第 2 页/ })).toHaveAttribute(
    "href",
    `${exampleRoute}#material-exercise`,
  );
});
