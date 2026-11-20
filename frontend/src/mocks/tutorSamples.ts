import type { SourceContext, TurnInput } from "../api/contracts";
import { material } from "./fixtures";

type Script = { hint: string; recap: string; practice?: string };

const example02: Script = {
  hint: "先看括号外的 3，它乘的是整个括号。\n\n如果等式两边都除以 3，左边会剩下什么？先写出这一步，不用急着求 x。",
  recap:
    "本次练习：从括号外的系数入手，先尝试把等式两边同除以 3。\n\n复习建议：独立完成一题变式，并解释为什么必须对等式两边做相同的运算。",
  practice:
    "独立练习：4(x − 1) = 20。\n\n试着写出第一步和你选择它的理由。这一次先不看提示。",
};
const example01: Script = {
  hint: "观察知识回顾里的 2x + 3 = 9。先想想：两边同时减去哪个数，左边就只剩下 2x？",
  recap: "回顾了 2x + 3 = 9，先对等式两边同时减 3，再想怎样把 x 的系数化成 1。",
};
const mathUnit: Script = {
  hint: "这节学习等式的性质。选一个变化，解释为什么等式两边要做相同的运算。",
  recap:
    "回顾了等式两边进行同样运算的理由。接下来可以带着这个问题看讲义中的具体例题。",
};
const plantActivity: Script = {
  hint: "两盆植物得到同样的水和空气。先对比两个位置，找出唯一发生变化的条件，再想它能给植物提供什么。",
  recap:
    "练习比较有光和无光两组植物，分清两组相同的条件、改变的条件，以及观察能支持的解释。",
};
const petActivity: Script = {
  hint: "先区分背景和请求。填表和忘带笔说明了事情的缘由。找到以 Could I 开头的那句话，再看 Maya 真正想做什么。",
  recap:
    "读了图书馆里的简短对话。用原文里的请求句判断说话人的主要目的，并区分目的和背景细节。",
};

const activities = new Map<string, Script>([
  [
    "math-7:equations:math-equations-practice",
    {
      hint: "看 3(x − 2) = 2x + 1。用分配律处理左边时，3 不仅乘 x，也乘 −2。展开以后，先试着把含 x 的项归到同一边。",
      recap: "练习了 3(x − 2) = 2x + 1，重点是分配律和归并等式两侧含 x 的项。",
    },
  ],
  [
    "math-7:equations:math-observatory",
    {
      hint: "看观测站的两个读数 2(x − 1) 和 3x − 5。先把左边展开，再把两个公式写在同一个等式中比较。",
      recap: "观测站挑战把两个读数设为相等，练习了展开括号和检查两边读数。",
    },
  ],
  ["science-7:plants:science-photosynthesis", plantActivity],
  ["english-pet:dialogue:pet-polite-request", petActivity],
]);

const units = new Map<string, Script>([
  ["math-7:equations", mathUnit],
  ["science-7:plants", plantActivity],
  ["english-pet:dialogue", petActivity],
  [
    "english-pet:reading",
    {
      hint: "先找一句能概括整段意思的话，再对照其他句子，看看它们是在支持这个主旨，还是只提供了一个细节。",
      recap:
        "回顾了识别短文主旨的方法：从反复出现的内容找共同点，并分清中心意思和单个细节。",
    },
  ],
]);

function resolveTutor(
  source: SourceContext | null | undefined,
): Script | undefined {
  if (!source) return mathUnit;
  if (source.materialId) {
    if (
      source.courseId !== material.courseId ||
      source.materialId !== material.id
    )
      return;
    if (
      source.page === 1 &&
      (!source.selectionId || source.selectionId === "example-01")
    )
      return example01;
    if (
      source.page === material.exercisePage &&
      (!source.selectionId || source.selectionId === material.exercise.id)
    )
      return example02;
    if (!source.selectionId && source.page === 3)
      return {
        hint: "这一页有两道巩固练习。先选择一道，说明你准备在等式两边做哪一种相同的运算。",
        recap: "回看了讲义的巩固练习，重点是说明两边同做一种运算的依据。",
      };
    return source.page === undefined && !source.selectionId
      ? mathUnit
      : undefined;
  }
  if (source.activityId)
    return activities.get(
      `${source.courseId}:${source.unitId ?? ""}:${source.activityId}`,
    );
  if (source.unitId) return units.get(`${source.courseId}:${source.unitId}`);
  if (source.courseId === material.courseId) return mathUnit;
}

export const hasMockTutor = (source: SourceContext | null | undefined) =>
  Boolean(resolveTutor(source));
export const mockRecap = (source: SourceContext | null | undefined) =>
  resolveTutor(source)?.recap;
export const isIndependentReviewPrompt = (message: string) =>
  message
    .normalize("NFKC")
    .replace(/\s/g, "")
    .replaceAll("−", "-")
    .toLowerCase()
    .includes("5(x-2)=30");

export function mockTutorResponse({ context, mode, message }: TurnInput) {
  if (isIndependentReviewPrompt(message)) {
    return "这道题用于独立复习。请先在复习页独立作答并核对答案。";
  }
  const script = resolveTutor(context);
  if (!script)
    return "这门课程暂未配置模拟辅导，或当前来源没有登记的演示题。请回到课程并选择已登记的单元或活动。";

  if (mode === "practice")
    return (
      script.practice ??
      "请先独立完成当前活动，写下你的理由，再用活动里的核对功能查看反馈。"
    );
  if (
    mode === "reply" &&
    (!context || script === example02) &&
    /x\s*[-−]\s*2\s*=\s*4|x\s*=\s*6/i.test(message)
  ) {
    return "你抓住了等式两边做相同运算的要点。再试着解释：为什么除数不能为零？";
  }
  if (!context && mode === "hint")
    return "先指出你想练习的题目，或者打开资料并选择例题。我会从第一步开始和你一起推理。";
  return script.hint;
}
