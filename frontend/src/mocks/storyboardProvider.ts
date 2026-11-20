import type {
  ArtifactContent,
  SourceContext,
  ToolResult,
} from "../api/contracts";
import { mockToolResult } from "./toolGeneration";
import { toolSamples } from "./toolSamples";

type StoryboardRequest = {
  source: SourceContext;
  script?: StoryboardScene[];
  scenario?: "success" | "fail-once";
  attempt?: number;
  signal?: AbortSignal;
};

type StoryboardResult = ToolResult & {
  kind: "storyboard";
  content: Extract<ArtifactContent, { type: "storyboard" }>;
  source: SourceContext;
};
export type StoryboardScene = StoryboardResult["content"]["scenes"][number];
export const storyboardFieldLimits = {
  title: 40,
  visual: 140,
  narration: 220,
} as const;

const mathSample = toolSamples.find(({ id }) => id === "pdf-example-02");

export function canGenerateStoryboard(
  source: SourceContext | null | undefined,
) {
  const registered = mathSample?.source;
  return Boolean(
    source &&
    registered &&
    source.courseId === registered.courseId &&
    source.materialId === registered.materialId &&
    source.page === registered.page &&
    source.selectionId === registered.selectionId,
  );
}

export function previewMockStoryboard(source: SourceContext): StoryboardResult {
  if (!canGenerateStoryboard(source) || !mathSample) {
    throw new Error("当前来源没有模拟讲解分镜。");
  }
  const result = mockToolResult({
    toolId: "storyboard",
    input: mathSample.input,
    sampleId: mathSample.id,
  });
  if (
    result?.kind !== "storyboard" ||
    result.content?.type !== "storyboard" ||
    !result.source
  ) {
    throw new Error("无法读取讲解分镜样例。");
  }
  return {
    ...result,
    kind: "storyboard",
    content: result.content,
    source: result.source,
  };
}

export function isStoryboardScript(value: unknown): value is StoryboardScene[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 4 &&
    value.every((scene: unknown) => {
      if (typeof scene !== "object" || !scene) return false;
      return Object.entries(storyboardFieldLimits).every(([field, limit]) => {
        const text = (scene as Record<string, unknown>)[field];
        return (
          typeof text === "string" &&
          Boolean(text.trim()) &&
          text.length <= limit
        );
      });
    })
  );
}

export async function runMockStoryboard({
  source,
  script,
  scenario = "success",
  attempt = 1,
  signal,
}: StoryboardRequest): Promise<StoryboardResult> {
  signal?.throwIfAborted();
  const result = previewMockStoryboard(source);
  if (
    script &&
    (!isStoryboardScript(script) ||
      script.length !== result.content.scenes.length)
  ) {
    throw new Error("请填写完整的分镜脚本。");
  }
  const scenes = (script ?? result.content.scenes).map(
    ({ title, visual, narration }) => ({
      title: title.trim(),
      visual: visual.trim(),
      narration: narration.trim(),
    }),
  );

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", cancel);
      resolve();
    }, 650);
    function cancel() {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    }
    signal?.addEventListener("abort", cancel, { once: true });
  });
  signal?.throwIfAborted();
  if (scenario === "fail-once" && attempt === 1) {
    throw new Error("本次模拟生成失败，请重试。");
  }
  const preview = scenes
    .map(
      ({ title, visual, narration }, index) =>
        `${index + 1}. ${title}\n画面：${visual}\n旁白：${narration}`,
    )
    .join("\n\n");
  return {
    ...result,
    body: `模拟示例 · 非真实 AI 处理\n\n${preview}`,
    content: { type: "storyboard", scenes },
  };
}
