import { setupServer } from "msw/node";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  createRecap,
  generateTool,
  startSession,
  streamTurn,
} from "../api/client";
import type { SourceContext } from "../api/contracts";
import { handlers } from "./handlers";
import { runMockStoryboard } from "./storyboardProvider";
import { toolSamples } from "./toolSamples";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

it("uses registered samples for subject-specific output and preserves their source", async () => {
  const [math, science, english] = toolSamples;
  const [mathResult, scienceResult, englishResult, edited] = await Promise.all([
    generateTool({
      toolId: "storyboard",
      input: math.input,
      sampleId: math.id,
    }),
    generateTool({
      toolId: "flashcards",
      input: science.input,
      sampleId: science.id,
    }),
    generateTool({
      toolId: "quiz",
      input: english.input,
      sampleId: english.id,
    }),
    generateTool({
      toolId: "summary",
      input: "另一个问题",
      sampleId: math.id,
      source: math.source,
    }),
  ]);
  expect(mathResult).toMatchObject({
    kind: "storyboard",
    content: { type: "storyboard" },
    source: math.source,
    sampleId: math.id,
  });
  expect(scienceResult).toMatchObject({
    content: { type: "flashcards" },
    source: science.source,
  });
  expect(scienceResult.body).toContain("光照");
  expect(englishResult).toMatchObject({
    content: { type: "quiz" },
    source: english.source,
  });
  expect(englishResult.body).toContain("Could I borrow your pen");
  expect(edited.source).toBeUndefined();
  expect(edited.sampleId).toBeUndefined();
  expect(edited.title).toContain("另一个问题");
});

it("scripts the storyboard failure and retry and supports cancellation", async () => {
  const [{ source }] = toolSamples;
  const controller = new AbortController();
  const cancelled = runMockStoryboard({ source, signal: controller.signal });
  controller.abort();
  await expect(cancelled).rejects.toMatchObject({ name: "AbortError" });

  await expect(
    runMockStoryboard({ source, scenario: "fail-once" }),
  ).rejects.toThrow("本次模拟生成失败");
  const retry = await runMockStoryboard({
    source,
    scenario: "fail-once",
    attempt: 2,
  });
  expect(retry.content.scenes).toHaveLength(4);
  expect(retry.source).toEqual(source);
  await expect(
    runMockStoryboard({ source: { ...source, page: 1 } }),
  ).rejects.toThrow("当前来源没有模拟讲解分镜");
});

it("switches scripts with teaching source and leaves the independent answer to the review page", async () => {
  const [math, science, english] = toolSamples;
  const hint = async (context: SourceContext, message = "请给个提示") => {
    const { id } = await startSession(context);
    const text = await streamTurn(id, {
      clientTurnId: crypto.randomUUID(),
      mode: "hint",
      context,
      message,
    });
    return { id, text };
  };
  const [plant, pet, p1, blocked] = await Promise.all([
    hint(science.source),
    hint(english.source),
    hint({
      ...math.source,
      page: 1,
      selectionId: undefined,
      selectionText: undefined,
    }),
    hint(math.source, "能帮我解 ５（ｘ－２）＝３０ 吗？"),
  ]);
  expect(plant.text).toContain("同样的水和空气");
  expect(pet.text).toContain("先区分背景和请求");
  expect(pet.text).toContain("Could I");
  expect(p1.text).toContain("2x + 3 = 9");
  expect(blocked.text).toContain("独立复习");
  const recap = await createRecap(plant.id, science.source);
  expect(recap.body).toContain("有光和无光");
  expect(recap.body).not.toContain("括号外的系数");
  await expect(createRecap(blocked.id, math.source)).rejects.toThrow(
    "请先完成一轮辅导",
  );
});
