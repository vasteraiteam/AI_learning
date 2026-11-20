import { expect, test, type Locator, type Page } from "@playwright/test";

const mathSource = {
  sample: "pdf-example-02",
  href: "/courses/math-7/materials/equations-1?page=2&selection=example-02#material-exercise",
  link: /方程\.pdf.*第 2 页/,
};
const scienceSource = {
  sample: "science-plant-observation",
  href: "/courses/science-7/units/plants?tab=practice",
  link: "植物与光合作用",
};
const englishSource = {
  sample: "pet-polite-request",
  href: "/courses/english-pet/units/dialogue?tab=practice",
  link: "在图书馆借笔",
};

type ToolSource = { sample: string; href: string; link: string | RegExp };

function draft(page: Page) {
  return page.getByRole("region", { name: "草稿预览" });
}

async function generate(page: Page, tool: string, source: ToolSource) {
  await page.goto("/tools");
  await page.getByRole("button", { name: new RegExp(`^${tool}`) }).click();
  const input = page.getByRole("region", { name: tool, exact: true });
  await input
    .getByRole("combobox", { name: "资料来源" })
    .selectOption(source.sample);
  await input.getByRole("button", { name: "生成草稿" }).click();
  const preview = draft(page);
  await expect(preview.getByText("模拟生成", { exact: true })).toBeVisible();
  await expect(preview.getByRole("link", { name: /返回来源/ })).toHaveAttribute(
    "href",
    source.href,
  );
  return preview;
}

async function saveAndReopen(
  page: Page,
  options: {
    toolId: string;
    title: string;
    source: ToolSource;
    checkSaved: (structured: Locator) => Promise<void>;
  },
) {
  const { toolId, title, source, checkSaved } = options;
  const preview = draft(page);
  await preview.getByRole("textbox", { name: "草稿标题" }).fill(title);
  await preview.getByRole("button", { name: "确认保存到空间" }).click();
  await expect(
    preview.getByRole("status").filter({ hasText: "已保存到空间" }),
  ).toBeVisible();
  await preview.getByRole("link", { name: "查看成果" }).click();
  const space = page.getByRole("region", { name: "成果预览" });
  await expect(
    space.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  const savedUrl = new URL(page.url());
  expect(savedUrl.pathname).toBe("/space");
  const id = savedUrl.searchParams.get("artifact");
  expect(id).toBeTruthy();
  await page.reload();
  await expect(
    space.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(space.getByRole("link", { name: source.link })).toHaveAttribute(
    "href",
    source.href,
  );
  await checkSaved(space.getByRole("region", { name: "结构化成果" }));
  await space.getByRole("link", { name: "在工具中重新打开" }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/tools" &&
      url.searchParams.get("tool") === toolId &&
      url.searchParams.get("reopen") === id,
  );
  await expect(preview.getByRole("textbox", { name: "草稿标题" })).toHaveValue(
    title,
  );
  await expect(preview.getByRole("link", { name: /返回来源/ })).toHaveAttribute(
    "href",
    source.href,
  );
  return preview;
}

async function returnToSource(page: Page, preview: Locator, href: string) {
  await preview.getByRole("link", { name: /返回来源/ }).click();
  await expect(page).toHaveURL(new URL(href, page.url()).href);
}

test("summary saves an edited key point and returns to the exact PDF selection", async ({
  page,
}) => {
  const preview = await generate(page, "摘要", mathSource);
  const entry = "用代入原式核对结论";
  await preview.getByRole("textbox", { name: "要点标题 1" }).fill(entry);
  const reopened = await saveAndReopen(page, {
    toolId: "summary",
    title: "我的等式摘要",
    source: mathSource,
    checkSaved: async (structured) => {
      await expect(structured.getByText(entry, { exact: true })).toBeVisible();
    },
  });
  await expect(
    reopened.getByRole("textbox", { name: "要点标题 1" }),
  ).toHaveValue(entry);
  await returnToSource(page, reopened, mathSource.href);
  const selected = page.getByRole("button", { name: "选择例题 02" });
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  await expect(selected).toBeFocused();
});

test("mind map saves the edited root and branch and returns to the science exercise", async ({
  page,
}) => {
  const preview = await generate(page, "思维导图", scienceSource);
  const root = "光合作用的条件";
  const branch = "用光照作对照";
  await preview.getByRole("textbox", { name: "中心主题" }).fill(root);
  await preview.getByRole("textbox", { name: "分支标题 1" }).fill(branch);
  const reopened = await saveAndReopen(page, {
    toolId: "mindmap",
    title: "我的光合作用导图",
    source: scienceSource,
    checkSaved: async (structured) => {
      await expect(structured.getByText(root, { exact: true })).toBeVisible();
      await expect(structured.getByText(branch, { exact: true })).toBeVisible();
    },
  });
  await expect(reopened.getByRole("textbox", { name: "中心主题" })).toHaveValue(
    root,
  );
  await expect(
    reopened.getByRole("textbox", { name: "分支标题 1" }),
  ).toHaveValue(branch);
  await returnToSource(page, reopened, scienceSource.href);
  await expect(
    page.getByRole("heading", { name: "比较两盆植物" }),
  ).toBeVisible();
});

test("podcast saves the edited speaker and script without presenting audio", async ({
  page,
}) => {
  const preview = await generate(page, "播客脚本", englishSource);
  const speaker = "图书馆员";
  const line = "Of course. Here you are.";
  await expect(preview.getByText("分角色脚本 · 不生成音频")).toBeVisible();
  await preview.getByRole("textbox", { name: "台词标题 1" }).fill(speaker);
  await preview.getByRole("textbox", { name: "台词内容 1" }).fill(line);
  const reopened = await saveAndReopen(page, {
    toolId: "podcast",
    title: "我的图书馆对话",
    source: englishSource,
    checkSaved: async (structured) => {
      await expect(
        structured.getByText(speaker, { exact: true }),
      ).toBeVisible();
      await expect(structured.getByText(line, { exact: true })).toBeVisible();
      await expect(
        structured.getByText("模拟脚本，未生成音频。"),
      ).toBeVisible();
      await expect(structured.locator("audio, video")).toHaveCount(0);
    },
  });
  await expect(
    reopened.getByRole("textbox", { name: "台词标题 1" }),
  ).toHaveValue(speaker);
  await expect(
    reopened.getByRole("textbox", { name: "台词内容 1" }),
  ).toHaveValue(line);
  await returnToSource(page, reopened, englishSource.href);
  await expect(
    page.getByRole("heading", { name: "在图书馆借笔" }),
  ).toBeVisible();
});

test("flashcards persist edited cards while flip, navigation, and rating are practice-only", async ({
  page,
}) => {
  const preview = await generate(page, "闪卡", mathSource);
  const front = "等式两边可以同时除以什么数？";
  const back = "同一个非零数。";
  const secondFront = "如何验证解？";
  await preview.getByRole("button", { name: "编辑卡片" }).click();
  await preview.getByRole("textbox", { name: "卡片标题 1" }).fill(front);
  await preview.getByRole("textbox", { name: "卡片内容 1" }).fill(back);
  await preview.getByRole("button", { name: "删除卡片 2" }).click();
  await preview.getByRole("button", { name: "添加卡片" }).click();
  await preview.getByRole("textbox", { name: "卡片标题 2" }).fill(secondFront);
  await preview
    .getByRole("textbox", { name: "卡片内容 2" })
    .fill("代回原式，看两边是否相等。");
  await preview.getByRole("button", { name: "完成编辑", exact: true }).click();
  await expect(preview.getByText(front, { exact: true })).toBeVisible();
  await expect(preview.getByRole("button", { name: "上一张" })).toBeDisabled();
  await preview.getByRole("button", { name: "翻面" }).click();
  await expect(preview.getByText(back, { exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "还需复习" }).click();
  await expect(preview.getByRole("status")).toContainText("本次自评：还需复习");
  await preview.getByRole("button", { name: "下一张" }).click();
  await expect(preview.getByText(secondFront, { exact: true })).toBeVisible();
  await expect(preview.getByRole("button", { name: "下一张" })).toBeDisabled();
  await preview.getByRole("button", { name: "上一张" }).click();
  await expect(preview.getByText(front, { exact: true })).toBeVisible();
  await expect(preview.getByRole("status")).toContainText("本次自评：还需复习");

  const reopened = await saveAndReopen(page, {
    toolId: "flashcards",
    title: "我的等式闪卡练习",
    source: mathSource,
    checkSaved: async (structured) => {
      await expect(
        structured.getByText(secondFront, { exact: true }),
      ).toBeVisible();
      await structured.getByText(front, { exact: true }).click();
      await expect(structured.getByText(back, { exact: true })).toBeVisible();
    },
  });
  await expect(reopened.getByText(front, { exact: true })).toBeVisible();
  await expect(reopened.getByText("本次自评：还需复习")).toHaveCount(0);
  await reopened.getByRole("button", { name: "翻面" }).click();
  await expect(reopened.getByText(back, { exact: true })).toBeVisible();
  await returnToSource(page, reopened, mathSource.href);
});

test("quiz persists the edited question and answer key, not an attempt", async ({
  page,
}) => {
  const preview = await generate(page, "测验", englishSource);
  const prompt = "哪句话最适合在教室借一支笔？";
  const correct = "May I borrow your pen, please?";
  const explanation = "May I…? 加 please 是礼貌的借用请求。";
  await preview.getByRole("button", { name: "编辑题目" }).click();
  await preview
    .getByRole("textbox", { name: "题目 1", exact: true })
    .fill(prompt);
  await preview
    .getByRole("textbox", { name: "选项 1", exact: true })
    .fill(correct);
  await preview.getByRole("combobox", { name: "正确选项" }).selectOption("0");
  await preview.getByRole("textbox", { name: "解析" }).fill(explanation);
  await preview.getByRole("button", { name: "完成编辑", exact: true }).click();

  const submit = preview.getByRole("button", { name: "提交测验" });
  await expect(submit).toBeDisabled();
  await preview
    .getByRole("radio", { name: "Find out where to buy a pen.", exact: true })
    .check();
  await submit.click();
  await expect(preview.getByRole("status")).toContainText(
    `还需复习。 ${explanation}`,
  );
  await preview.getByRole("button", { name: "再试一次" }).click();
  await expect(submit).toBeDisabled();
  await preview.getByRole("radio", { name: correct, exact: true }).check();
  await submit.click();
  await expect(preview.getByRole("status")).toContainText(
    `答对了。 ${explanation}`,
  );

  const reopened = await saveAndReopen(page, {
    toolId: "quiz",
    title: "我的借笔自测",
    source: englishSource,
    checkSaved: async (structured) => {
      await expect(structured.getByText(prompt, { exact: true })).toBeVisible();
      await structured.getByText("查看参考答案", { exact: true }).click();
      await expect(
        structured.getByText(explanation, { exact: true }),
      ).toBeVisible();
    },
  });
  await expect(reopened.getByText(prompt, { exact: true })).toBeVisible();
  await expect(submit).toBeDisabled();
  await expect(
    reopened.getByRole("radio", { name: correct, exact: true }),
  ).not.toBeChecked();
  await reopened.getByRole("radio", { name: correct, exact: true }).check();
  await submit.click();
  await expect(reopened.getByRole("status")).toContainText(
    `答对了。 ${explanation}`,
  );
  await returnToSource(page, reopened, englishSource.href);
});

test("photo previews a local image without OCR and saves a reviewed example", async ({
  page,
}, testInfo) => {
  await page.goto("/tools?tool=photo");
  const photo = page.getByRole("region", { name: "拍题", exact: true });
  await expect(photo.getByText("无真实 OCR")).toBeVisible();
  await photo.getByLabel("本地图片").setInputFiles({
    name: "practice.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(
    photo.getByRole("img", { name: "本地题目图片预览" }),
  ).toHaveAttribute("src", /^blob:/);
  await expect(
    photo.getByText("图片仅在本页预览，不上传、不识别。"),
  ).toBeVisible();
  await expect(photo.getByRole("textbox", { name: "题目文字" })).toBeEmpty();
  await expect(photo.getByRole("button", { name: "生成草稿" })).toBeDisabled();
  await photo.getByRole("button", { name: "载入示例题目（模拟）" }).click();
  await photo.getByRole("button", { name: "生成草稿" }).click();
  const preview = draft(page);
  const editedEquation = "3(x − 2) = 12（已核对原题）";
  const equation = preview.getByRole("textbox", { name: "核对题目" });
  await expect(equation).toHaveValue("3(x − 2) = 12");
  await equation.fill(editedEquation);
  await expect(
    preview.getByRole("button", { name: "用示例原题问 Mia" }),
  ).toBeVisible();
  await preview.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("photo-checked-example.png"),
    animations: "disabled",
  });
  const reopened = await saveAndReopen(page, {
    toolId: "photo",
    title: "我的拍题核对记录",
    source: mathSource,
    checkSaved: async (structured) => {
      await expect(
        structured.getByText(editedEquation, { exact: true }),
      ).toBeVisible();
    },
  });
  await expect(reopened.getByRole("textbox", { name: "核对题目" })).toHaveValue(
    editedEquation,
  );
  await expect(
    photo.getByRole("img", { name: "本地题目图片预览" }),
  ).toHaveCount(0);
  await reopened.getByRole("button", { name: "用示例原题问 Mia" }).click();
  await expect(page).toHaveURL(new URL(mathSource.href, page.url()).href);
  await expect(page.getByRole("dialog", { name: "Mia" })).toBeVisible();
});

test("explain saves the edited steps and returns to the example it teaches", async ({
  page,
}, testInfo) => {
  const preview = await generate(page, "讲解", mathSource);
  const title = "先确定可以同除的数";
  const step = "先确认 3 不为零，再把等式两边同时除以 3。";
  await preview.getByRole("textbox", { name: "步骤标题 1" }).fill(title);
  await preview.getByRole("textbox", { name: "步骤内容 1" }).fill(step);
  await preview.getByRole("button", { name: "添加步骤" }).click();
  await preview
    .getByRole("textbox", { name: "步骤标题 4" })
    .fill("保留运算依据");
  await preview
    .getByRole("textbox", { name: "步骤内容 4" })
    .fill("按顺序记录每次对等式两边执行的运算。");
  await preview
    .getByRole("textbox", { name: "步骤标题 1" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("explain-edited-steps.png"),
    animations: "disabled",
  });
  const reopened = await saveAndReopen(page, {
    toolId: "explain",
    title: "我的方程分步讲解",
    source: mathSource,
    checkSaved: async (structured) => {
      await expect(structured.getByText(title, { exact: true })).toBeVisible();
      await expect(structured.getByText(step, { exact: true })).toBeVisible();
      await expect(
        structured.getByText("保留运算依据", { exact: true }),
      ).toBeVisible();
    },
  });
  await expect(
    reopened.getByRole("textbox", { name: "步骤内容 1" }),
  ).toHaveValue(step);
  await expect(
    reopened.getByRole("textbox", { name: "步骤标题 4" }),
  ).toHaveValue("保留运算依据");
  await returnToSource(page, reopened, mathSource.href);
});
