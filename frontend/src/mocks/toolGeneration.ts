import type { ArtifactContent, ToolInput, ToolResult } from "../api/contracts";
import { petLibraryDialogue } from "../features/courses/activities";
import { material } from "./fixtures";
import { toolSamples } from "./toolSamples";

type Profile = {
  topic: string;
  prompt: string;
  quizPrompt?: string;
  clue: string;
  steps: [string, string, string];
  correct: string;
  distractors: [string, string];
};

const math: Profile = {
  topic: "一元一次方程",
  prompt: material.exercise.equation,
  clue: "括号外的 3 乘的是整个括号。",
  steps: [
    "等式两边同除以 3，得到 x − 2 = 4。",
    "等式两边同加 2，得到 x = 6。",
    "把 6 代回原式，两边都是 12。",
  ],
  correct: "等式两边都除以 3。",
  distractors: ["只把左边除以 3。", "等式两边都减 3。"],
};

const profiles: Record<string, Profile> = {
  "pdf-example-02": math,
  "science-plant-observation": {
    topic: "植物与光合作用",
    prompt: "有光处与暗处，哪一盆植物更容易制造有机物？",
    clue: "两盆植物得到的水和空气相同，光照是这个例子中改变的条件。",
    steps: [
      "比较两组条件，找出唯一改变的变量：光照。",
      "光为光合作用提供能量，有光处的植物更容易制造有机物。",
      "对照两组植物的观察结果，区分实际观察和由此作出的解释。",
    ],
    correct: "选择有光处的一盆，因为光提供能量。",
    distractors: [
      "选择暗处的一盆，因为光合作用不需要光。",
      "两盆一定相同，因为得到相同的水。",
    ],
  },
  [petLibraryDialogue.id]: {
    topic: petLibraryDialogue.title,
    prompt: petLibraryDialogue.prompt,
    quizPrompt: `${petLibraryDialogue.passage}\n\n${petLibraryDialogue.prompt}`,
    clue: petLibraryDialogue.explanation,
    steps: [
      "先读开头，找到 Maya 需要填表却忘了带笔这一背景。",
      "找到 Maya 向图书馆员提出的请求，划出请求中的动作。",
      "回到原文用一句证据说明 Maya 的主要目的。",
    ],
    correct: petLibraryDialogue.choices[petLibraryDialogue.answer],
    distractors: [petLibraryDialogue.choices[0], petLibraryDialogue.choices[2]],
  },
};

const toolLabels = {
  photo: "拍题识别预览",
  explain: "讲解",
  summary: "摘要",
  mindmap: "导图大纲",
  podcast: "播客脚本",
  flashcards: "闪卡",
  quiz: "自测题",
  storyboard: "讲解分镜",
} satisfies Record<ArtifactContent["type"], string>;

function scaffold(input: string): Profile {
  const topic = Array.from(input.replace(/\s+/g, " ")).slice(0, 36).join("");
  return {
    topic,
    prompt: input,
    clue: "从输入中找出正在学习的概念、已知条件和待解决的问题。",
    steps: [
      "用自己的话重述输入，保留其中的关键条件。",
      "从原材料找一条依据，并说明它怎样支持你对问题的理解。",
      "回到输入核对用词、数字和结论，补上还没验证的部分。",
    ],
    correct: "把自己的解释同原材料中的证据进行核对。",
    distractors: ["只复制材料标题。", "把尚未验证的猜测记为结论。"],
  };
}

function build(
  kind: ArtifactContent["type"],
  p: Profile,
): { content: ArtifactContent; preview: string } {
  const stepNames = ["看清条件", "写出依据", "回到原题检查"];
  const steps = p.steps.map((text, index) => ({
    title: stepNames[index],
    text,
  }));

  switch (kind) {
    case "photo": {
      const checks = ["对照原题核对数字、符号和题干。", p.clue];
      return {
        content: { type: kind, equation: p.prompt, checks },
        preview: `题面：${p.prompt}\n${checks.join("\n")}`,
      };
    }
    case "explain":
      return {
        content: { type: kind, steps },
        preview: steps
          .map((step, n) => `${n + 1}. ${step.title}：${step.text}`)
          .join("\n"),
      };
    case "summary": {
      const sections = [
        { title: "核心线索", text: p.clue },
        { title: "可以怎么核对", text: p.steps[2] },
      ];
      return {
        content: { type: kind, sections },
        preview: sections
          .map((section) => `${section.title}：${section.text}`)
          .join("\n"),
      };
    }
    case "mindmap": {
      const branches = [
        { label: "先看条件", children: [p.prompt, p.clue] },
        { label: "处理过程", children: p.steps.slice(0, 2) },
        { label: "验证", children: [p.steps[2]] },
      ];
      return {
        content: { type: kind, root: p.topic, branches },
        preview: [
          p.topic,
          ...branches.map(
            ({ label, children }) =>
              `${label}\n${children.map((child) => `  · ${child}`).join("\n")}`,
          ),
        ].join("\n"),
      };
    }
    case "podcast": {
      const lines = [
        { speaker: "主持", text: p.prompt },
        { speaker: "搭档", text: p.clue },
        { speaker: "主持", text: p.steps[2] },
      ];
      return {
        content: { type: kind, lines },
        preview:
          lines.map(({ speaker, text }) => `${speaker}：${text}`).join("\n") +
          "\n仅提供模拟脚本，未生成音频。",
      };
    }
    case "flashcards": {
      const cards = [
        { front: `学习「${p.topic}」时，先注意什么？`, back: p.clue },
        { front: "如何检查自己的理解？", back: p.steps[2] },
      ];
      return {
        content: { type: kind, cards },
        preview: cards
          .map(({ front, back }) => `正面：${front}\n背面：${back}`)
          .join("\n\n"),
      };
    }
    case "quiz": {
      const questions = [
        {
          prompt: p.quizPrompt ?? `${p.prompt}\n下面哪种做法合适？`,
          choices: [p.distractors[0], p.correct, p.distractors[1]],
          correctIndex: 1,
          explanation: p.clue,
        },
      ];
      return {
        content: { type: kind, questions },
        preview: questions
          .map(
            ({ prompt, choices, explanation }) =>
              `${prompt}\n${choices.map((choice, i) => `${i + 1}. ${choice}`).join("\n")}\n参考：2。${explanation}`,
          )
          .join("\n"),
      };
    }
    case "storyboard": {
      const scenes = [
        { title: "展示原题", narration: p.clue, visual: p.prompt },
        ...steps.map(({ title, text }) => ({
          title,
          narration: text,
          visual: text,
        })),
      ];
      return {
        content: { type: kind, scenes },
        preview: scenes
          .map(
            ({ title, narration, visual }, i) =>
              `${i + 1}. ${title}\n画面：${visual}\n旁白：${narration}`,
          )
          .join("\n\n"),
      };
    }
  }
}

export function mockToolResult({
  toolId,
  input,
  sampleId,
}: ToolInput): ToolResult | null {
  if (
    typeof toolId !== "string" ||
    !Object.hasOwn(toolLabels, toolId) ||
    typeof input !== "string" ||
    !input.trim() ||
    input.length > 5000
  )
    return null;
  const kind = toolId as ArtifactContent["type"];
  const text = input.trim();
  const sample = toolSamples.find(
    (candidate) => candidate.id === sampleId && candidate.input === text,
  );
  const profile = sample ? profiles[sample.id] : scaffold(text);
  const { content, preview } = build(kind, profile);
  return {
    title: `${profile.topic} · ${toolLabels[kind]}`,
    kind,
    body: `模拟示例 · 非真实 AI 处理\n\n${preview}`,
    ...(sample && { source: sample.source, sampleId: sample.id }),
    content,
    simulated: true,
  };
}
