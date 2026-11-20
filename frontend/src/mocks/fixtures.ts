import type {
  Artifact,
  Course,
  Evidence,
  Material,
  Today,
} from "../api/contracts";

const math: Course = {
  id: "math-7",
  title: "初中数学",
  subject: "数学 · 七年级",
  description: "从等式的性质出发，学会解方程并解释每一步。",
  progress: 40,
  currentUnit: "一元一次方程",
  units: [
    { id: "numbers", title: "有理数与运算", status: "done" },
    { id: "algebra", title: "整式的加减", status: "done" },
    { id: "equations", title: "一元一次方程", status: "current" },
    { id: "geometry", title: "几何图形初步", status: "next" },
  ],
  materials: [
    {
      id: "equations-1",
      title: "第 3 章 · 一元一次方程.pdf",
      description: "课程讲义 · 等式性质、例题和独立练习",
      pages: 3,
    },
  ],
};

export const courses: Course[] = [
  math,
  {
    id: "science-7",
    title: "初中科学",
    subject: "科学 · 七年级",
    description: "用观察和证据解释身边的科学现象。",
    progress: 25,
    currentUnit: "植物与光合作用",
    units: [
      { id: "observation", title: "科学观察", status: "done" },
      { id: "plants", title: "植物与光合作用", status: "current" },
    ],
    materials: [],
  },
  {
    id: "english-pet",
    title: "PET 英语",
    subject: "英语 · 考试准备",
    description: "在情境中练习阅读、表达和对话。",
    progress: 15,
    currentUnit: "日常情境对话",
    units: [
      { id: "dialogue", title: "日常情境对话", status: "current" },
      { id: "reading", title: "短文主旨", status: "next" },
    ],
    materials: [],
  },
];

export const material: Material = {
  id: "equations-1",
  courseId: math.id,
  title: math.materials[0].title,
  fileUrl: "/materials/equations.pdf",
  pageCount: 3,
  exercisePage: 2,
  exercise: {
    id: "example-02",
    label: "例题 02",
    equation: "3(x − 2) = 12",
    prompt: "解下面的方程，并说明第一步的理由。",
  },
};

export const today: Today = {
  continueCourse: math,
  tasks: [
    {
      id: "math-review",
      title: "完成一元一次方程的变式练习",
      completed: false,
      courseId: math.id,
    },
    {
      id: "pet-words",
      title: "复习 PET 词汇",
      completed: false,
      courseId: "english-pet",
    },
    { id: "notes", title: "回看整式加减的课堂笔记", completed: true },
  ],
  suggestion: {
    courseId: math.id,
    title: "试试不展开括号",
    body: "从讲义的例题 02 开始，想一想能否先把等式两边同除以 3。",
  },
};

export const starterArtifacts: Artifact[] = [
  {
    id: "note-algebra",
    kind: "note",
    title: "等式的性质 · 课堂笔记",
    body: "等式两边同时加上相同的数，或同时除以相同的非零数，等式仍然成立。",
    source: {
      courseId: math.id,
      materialId: material.id,
      materialTitle: material.title,
      page: 2,
    },
    createdAt: "2026-11-18T10:00:00+08:00",
    simulated: true,
  },
];
export const starterEvidence: Evidence[] = [
  {
    id: "evidence-1",
    kind: "mastery",
    basis: "activity",
    title: "练习过等式的基本性质",
    body: "已独立完成一组等式性质练习。",
    createdAt: "2026-11-18T11:00:00+08:00",
  },
  {
    id: "evidence-2",
    kind: "discovery",
    basis: "ai-inference",
    title: "建议复习括号外的系数",
    body: "这是示例建议，不代表掌握情况或正式成绩。",
    createdAt: "2026-11-18T09:00:00+08:00",
  },
  {
    id: "evidence-3",
    kind: "creation",
    basis: "student-confirmed",
    title: "整理了整式加减笔记",
    body: "学生在示例中确认保留的学习笔记。",
    createdAt: "2026-11-17T15:00:00+08:00",
  },
];
