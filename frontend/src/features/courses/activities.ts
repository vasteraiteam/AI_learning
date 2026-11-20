import type { Course, SourceContext } from "../../api/contracts";

type BaseActivity = {
  id: string;
  title: string;
  badge: string;
  prompt: string;
  explanation: string;
};

export type CourseActivity = BaseActivity &
  (
    | {
        kind: "numeric";
        equation: string;
        answer: number;
        hint: string;
        success: string;
        introduction?: string;
      }
    | {
        kind: "choice";
        language?: "en";
        passage?: string;
        choices: string[];
        answer: number;
      }
  );

type UnitLearning = {
  introduction: string;
  aims: string[];
  reading: { title: string; text: string; example?: string };
  materialIds?: string[];
  practice: CourseActivity;
  world?: CourseActivity;
};

const penRequest = "Could I borrow your pen, please?";

export const petLibraryDialogue = {
  id: "pet-polite-request",
  title: "在图书馆借笔",
  badge: "示范练习 · 短阅读主旨",
  kind: "choice",
  language: "en",
  passage: `Maya: I need to fill in this form, but I left my pen at home. ${penRequest}\nLibrarian: Of course. Here you are.`,
  prompt: "What is Maya mainly trying to do?",
  choices: [
    "Ask the librarian to fill in a form.",
    "Borrow a pen from the librarian.",
    "Find out where to buy a pen.",
  ],
  answer: 1,
  explanation: `原文“${penRequest}”直接说明 Maya 想借笔。填表解释了她为什么需要笔，并不是她向图书馆员提出的请求。`,
} satisfies CourseActivity;

const unitLearning: Record<string, Record<string, UnitLearning>> = {
  "math-7": {
    equations: {
      introduction: "从等式的性质出发，解出未知数，并能说明每一步为什么成立。",
      aims: [
        "用分配律正确去括号，保留括号里的每一项。",
        "在等式两边做相同的运算，把含 x 的项集中到一边。",
        "把求得的 x 代回原方程，验证两边是否相等。",
      ],
      reading: {
        title: "等式两边一起变",
        text: "等式两边加上或减去同一个数，仍然相等；也可以同时乘或除以同一个非零数。遇到括号，先看看两边能否同除一个数，再决定是否要去括号。",
        example: "3(x − 2) = 12 → x − 2 = 4 → x = 6",
      },
      materialIds: ["equations-1"],
      practice: {
        id: "math-equations-practice",
        title: "解一元一次方程",
        badge: "单元练习 · 去括号与移项",
        kind: "numeric",
        prompt: "3(x − 2) = 2x + 1，求 x。",
        equation: "3(x − 2) = 2x + 1",
        answer: 7,
        success: "核对通过。代入 x = 7，两边都是 15。",
        hint: "试着先展开 3(x − 2)。",
        explanation:
          "先展开得 3x − 6 = 2x + 1，再在两边同时减去 2x、加上 6，得到 x = 7。",
      },
      world: {
        id: "math-observatory",
        title: "校准观测站的刻度",
        badge: "可选挑战 · 约 2 分钟",
        kind: "numeric",
        introduction:
          "观测站的两把尺子用不同的公式读数。找出一个刻度，让两把尺子的读数相同。",
        prompt: "2(x − 1) = 3x − 5，求两把尺子读数相同的刻度 x。",
        equation: "2(x − 1) = 3x − 5",
        answer: 3,
        success: "刻度校准成功。代入 x = 3，两边都是 4。",
        hint: "试着先展开 2(x − 1)。",
        explanation:
          "展开后是 2x − 2 = 3x − 5；两边同时减去 2x、加上 5，得到 x = 3。",
      },
    },
  },
  "science-7": {
    plants: {
      introduction: "从两盆植物的对比，理解光在光合作用中的作用。",
      aims: ["说出光给光合作用提供能量。", "从对比实验里找出唯一改变的条件。"],
      reading: {
        title: "光给植物提供什么？",
        text: "植物利用光能，把水和二氧化碳转化成有机物。在对比实验里，尽量让其他条件相同，这样才更容易看出光带来的差异。",
      },
      practice: {
        id: "science-photosynthesis",
        title: "比较两盆植物",
        badge: "示范练习 · 对比观察",
        kind: "choice",
        prompt:
          "两盆相同的植物得到同样的水和空气，一盆放在有光处，另一盆放在暗处。哪一盆更容易制造有机物？为什么？",
        choices: [
          "有光处的植物，因为光提供能量。",
          "暗处的植物，因为光会阻碍光合作用。",
          "两盆一样，因为都有水和空气。",
        ],
        answer: 0,
        explanation:
          "水和空气相同，唯一不同的条件是光。光给光合作用提供能量，因此有光处的植物更容易制造有机物。",
      },
    },
  },
  "english-pet": {
    dialogue: {
      introduction: "读一段图书馆里的简短对话，找出说话人的主要目的。",
      aims: [
        "分辨说话人的主要目的和背景细节。",
        "从原文找出能支持判断的句子。",
      ],
      reading: {
        title: "读懂说话人的目的",
        text: "先找出说话人希望对方做什么，再回头区分背景和原因。Could I…? 后面的动作，往往就是请求的重点。",
        example: "Could I use your dictionary, please?",
      },
      practice: petLibraryDialogue,
    },
  },
};

export function getUnitLearning(courseId: string, unitId: string) {
  return unitLearning[courseId]?.[unitId];
}

export function getMaterialUnit(courseId: string, materialId: string) {
  return Object.entries(unitLearning[courseId] ?? {}).find(([, unit]) =>
    unit.materialIds?.includes(materialId),
  )?.[0];
}

export function currentUnit(course: Course) {
  return course.units.find((unit) => unit.status === "current");
}

export function activitySource(
  courseId: string,
  unitId: string,
  activity: CourseActivity,
): SourceContext {
  return {
    courseId,
    unitId,
    activityId: activity.id,
    activityTitle: activity.title,
    activityPrompt:
      activity.kind === "choice" && activity.passage
        ? `${activity.passage}\n\n${activity.prompt}`
        : activity.prompt,
  };
}
