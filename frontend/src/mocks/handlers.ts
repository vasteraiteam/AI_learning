import { delay, http, HttpResponse } from "msw";
import type {
  Artifact,
  ArtifactInput,
  Evidence,
  PracticeResult,
  Recap,
  ReviewDecisionInput,
  ReviewPractice,
  ReviewProposal,
  SourceContext,
  Task,
  ToolInput,
  TurnInput,
} from "../api/contracts";
import {
  courses,
  material,
  starterArtifacts,
  starterEvidence,
  today,
} from "./fixtures";
import { mockToolResult } from "./toolGeneration";
import {
  isIndependentReviewPrompt,
  mockRecap,
  mockTutorResponse,
} from "./tutorSamples";

type Database = {
  tasks: Task[];
  artifacts: Artifact[];
  evidence: Evidence[];
  reviewProposals: ReviewProposal[];
};
const storageKey = "aixueji-v1-demo";
const fresh = (): Database =>
  structuredClone({
    tasks: today.tasks,
    artifacts: starterArtifacts,
    evidence: starterEvidence,
    reviewProposals: [],
  });
let fallback = fresh();
const read = (): Database => {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null") as
      | (Omit<Database, "reviewProposals"> &
          Pick<Partial<Database>, "reviewProposals">)
      | null;
    return stored
      ? { ...stored, reviewProposals: stored.reviewProposals ?? [] }
      : fallback;
  } catch {
    return fallback;
  }
};
const write = (db: Database) => {
  fallback = db;
  try {
    localStorage.setItem(storageKey, JSON.stringify(db));
  } catch {
    /* Preview remains usable when storage is disabled. */
  }
};

const sessions = new Map<string, SourceContext | null>();
const draftById = new Map<string, Recap>();
const savedByAction = new Map<string, Artifact>();
const activeTurns = new Map<string, () => void>();
const finishedSessions = new Set<string>();
const hintedSessions = new Set<string>();
const checkedGuidedSessions = new Set<string>();

const selectedExample: SourceContext = {
  courseId: material.courseId,
  materialId: material.id,
  materialTitle: material.title,
  page: material.exercisePage,
  selectionId: material.exercise.id,
  selectionText: material.exercise.equation,
};
const reviewQuestion = "5(x − 2) = 30";

function hasSelectedExample(source: SourceContext | null | undefined) {
  return (
    source?.courseId === selectedExample.courseId &&
    source.materialId === selectedExample.materialId &&
    source.page === selectedExample.page &&
    source.selectionId === selectedExample.selectionId
  );
}

function tomorrowFrom(iso: string) {
  const day = new Date(iso);
  day.setDate(day.getDate() + 1);
  return [day.getFullYear(), day.getMonth() + 1, day.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function getProposal(db: Database, artifactId: string): ReviewProposal | null {
  const artifact = db.artifacts.find((entry) => entry.id === artifactId);
  if (
    artifact?.kind !== "recap" ||
    !hasSelectedExample(artifact.source) ||
    !db.evidence.some(
      ({ id, kind, basis }) =>
        id === artifact.id &&
        kind === "creation" &&
        basis === "student-confirmed",
    )
  )
    return null;

  const id = "review-" + artifact.id;
  return (
    db.reviewProposals.find((proposal) => proposal.id === id) ?? {
      id,
      title: "独立复习 · 一元一次方程",
      dueDate: tomorrowFrom(artifact.createdAt),
      source: selectedExample,
      status: "pending",
    }
  );
}

function reviewTask(db: Database, id: string) {
  return db.tasks.find((task) => task.id === id && task.reviewProposalId);
}

function numericAnswer(input: unknown) {
  if (typeof input !== "string") return NaN;
  const text = input
    .normalize("NFKC")
    .trim()
    .replace(/^x\s*=\s*/i, "");
  return /^[+\-−]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)
    ? Number(text.replace("−", "-"))
    : NaN;
}

function addArtifact(input: ArtifactInput, evidence = false) {
  const db = read();
  const artifact: Artifact = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    simulated: true,
  };
  db.artifacts = [artifact, ...db.artifacts];
  if (evidence) {
    db.evidence = [
      {
        id: artifact.id,
        artifactId: artifact.id,
        title: "已确认：" + artifact.title,
        body: "学生确认保存的模拟辅导复盘；不代表知识点已掌握。",
        kind: "creation",
        basis: "student-confirmed",
        createdAt: artifact.createdAt,
        source: artifact.source,
      },
      ...db.evidence,
    ];
    const proposal = getProposal(db, artifact.id);
    if (proposal) db.reviewProposals.push(proposal);
  }
  write(db);
  return artifact;
}

const notFound = (entity: string) =>
  HttpResponse.json({ error: "找不到" + entity }, { status: 404 });
const badRequest = (error: string) =>
  HttpResponse.json({ error }, { status: 400 });

export const handlers = [
  http.get("/api/today", () =>
    HttpResponse.json({ ...today, tasks: read().tasks }),
  ),
  http.get("/api/courses", () => HttpResponse.json(courses)),
  http.get("/api/courses/:id", ({ params }) => {
    const course = courses.find((item) => item.id === params.id);
    return course ? HttpResponse.json(course) : notFound("课程");
  }),
  http.get("/api/materials/:id", ({ params }) =>
    params.id === material.id ? HttpResponse.json(material) : notFound("资料"),
  ),
  http.post("/api/tasks/:id", async ({ request, params }) => {
    const input = (await request.json()) as { completed?: boolean };
    if (typeof input.completed !== "boolean")
      return badRequest("任务状态无效。");
    const db = read();
    const item = db.tasks.find((task) => task.id === params.id);
    if (!item) return notFound("任务");
    if (item.reviewProposalId)
      return badRequest("请通过独立练习完成复习任务。");
    item.completed = input.completed;
    write(db);
    return HttpResponse.json(item);
  }),
  http.get("/api/growth", () => {
    const { artifacts, evidence } = read();
    const recaps = new Set(
      artifacts.filter(({ kind }) => kind === "recap").map(({ id }) => id),
    );
    return HttpResponse.json(
      evidence.map((entry) =>
        !entry.artifactId &&
        entry.kind === "creation" &&
        entry.basis === "student-confirmed" &&
        recaps.has(entry.id)
          ? { ...entry, artifactId: entry.id }
          : entry,
      ),
    );
  }),
  http.get("/api/space", () => HttpResponse.json(read().artifacts)),
  http.get("/api/review/proposals/:id", ({ params }) =>
    HttpResponse.json(getProposal(read(), String(params.id))),
  ),
  http.post(
    "/api/review/proposals/:id/decision",
    async ({ request, params }) => {
      const input = (await request.json()) as ReviewDecisionInput;
      const id = String(params.id);
      if (input?.decision !== "confirm" && input?.decision !== "reject")
        return badRequest("复习决定无效。");

      const db = read();
      const proposal = getProposal(
        db,
        id.startsWith("review-") ? id.slice(7) : "",
      );
      if (!proposal) return notFound("复习提案");
      if (proposal.status !== "pending") return HttpResponse.json(proposal);

      let decided: ReviewProposal;
      if (input.decision === "reject") {
        decided = { ...proposal, status: "rejected" };
      } else {
        const title =
          input.title === undefined
            ? proposal.title
            : typeof input.title === "string"
              ? input.title.trim()
              : "";
        const dueDate =
          input.dueDate === undefined ? proposal.dueDate : input.dueDate;
        if (!title || title.length > 120)
          return badRequest("请输入 1 至 120 个字符的复习标题。");
        if (typeof dueDate !== "string" || !validDate(dueDate))
          return badRequest("请选择有效的复习日期。");

        const taskId = "task-" + proposal.id;
        decided = { ...proposal, title, dueDate, taskId, status: "confirmed" };
        db.tasks.push({
          id: taskId,
          title,
          dueDate,
          completed: false,
          courseId: proposal.source.courseId,
          source: proposal.source,
          reviewProposalId: proposal.id,
        });
      }
      db.reviewProposals = db.reviewProposals
        .filter((entry) => entry.id !== proposal.id)
        .concat(decided);
      write(db);
      return HttpResponse.json(decided);
    },
  ),
  http.get("/api/review/practice/:id", ({ params }) => {
    const task = reviewTask(read(), String(params.id));
    if (!task) return notFound("独立复习任务");
    return HttpResponse.json<ReviewPractice>({
      task,
      question: reviewQuestion,
    });
  }),
  http.post(
    "/api/review/practice/:id/reschedule",
    async ({ request, params }) => {
      const input = (await request.json()) as { dueDate?: unknown };
      const date = input?.dueDate;
      if (typeof date !== "string" || !validDate(date))
        return badRequest("请选择有效的复习日期。");
      const db = read();
      const task = reviewTask(db, String(params.id));
      if (!task) return notFound("独立复习任务");
      if (task.completed) return badRequest("已完成的复习任务不能改期。");
      const proposal = db.reviewProposals.find(
        (entry) => entry.id === task.reviewProposalId,
      );
      if (task.dueDate !== date || (proposal && proposal.dueDate !== date)) {
        task.dueDate = date;
        if (proposal) proposal.dueDate = date;
        write(db);
      }
      return HttpResponse.json(task);
    },
  ),
  http.post("/api/review/practice/:id/answer", async ({ request, params }) => {
    const input = (await request.json()) as { answer?: unknown };
    const db = read();
    const task = reviewTask(db, String(params.id));
    if (!task) return notFound("独立复习任务");
    if (numericAnswer(input?.answer) !== 8) {
      return HttpResponse.json<PracticeResult>({
        correct: false,
        message: "这个值还不能使等式两边相等。请再核对一次。",
      });
    }

    const id = "independent-" + task.id;
    const recorded = db.evidence.find((entry) => entry.id === id);
    const evidence: Evidence = recorded ?? {
      id,
      title: "独立完成一元一次方程变式",
      body: "学生在没有提示的情况下正确解出这道复习变式；这是一条练习记录，不是掌握判定。",
      kind: "mastery",
      basis: "activity",
      createdAt: new Date().toISOString(),
      source: task.source,
      practiceMode: "independent",
      taskId: task.id,
    };
    if (!recorded || !task.completed) {
      if (!recorded) db.evidence.unshift(evidence);
      task.completed = true;
      write(db);
    }
    return HttpResponse.json<PracticeResult>({
      correct: true,
      message: "答案正确。代入 x = 8，两边都是 30。",
      evidence,
    });
  }),
  http.post("/api/review/guided/:id/answer", async ({ request, params }) => {
    const sessionId = String(params.id);
    if (!sessions.has(sessionId)) return notFound("辅导会话");
    if (
      !hintedSessions.has(sessionId) ||
      !hasSelectedExample(sessions.get(sessionId))
    ) {
      return HttpResponse.json<PracticeResult>({
        correct: false,
        message: "请先阅读这个例题的完整提示，再核对答案。",
      });
    }

    const input = (await request.json()) as { answer?: unknown };
    if (numericAnswer(input?.answer) !== 6) {
      return HttpResponse.json<PracticeResult>({
        correct: false,
        message: "这个值还不能使等式两边相等。可以代回原式检查。",
      });
    }

    checkedGuidedSessions.add(sessionId);
    const db = read();
    const id = `assisted-${material.courseId}-${material.id}-${material.exercise.id}`;
    const recorded = db.evidence.find((entry) => entry.id === id);
    const evidence: Evidence = recorded ?? {
      id,
      title: "在提示下完成例题核对",
      body: "学生阅读例题提示后正确核对了答案。这条记录不代表独立掌握。",
      kind: "mastery",
      basis: "activity",
      createdAt: new Date().toISOString(),
      source: selectedExample,
      practiceMode: "assisted",
    };
    if (!recorded) {
      db.evidence.unshift(evidence);
      write(db);
    }
    return HttpResponse.json<PracticeResult>({
      correct: true,
      message: "答案正确。代入 x = 6，两边都是 12。",
      evidence,
    });
  }),
  http.post("/api/space", async ({ request }) => {
    const input = (await request.json()) as ArtifactInput;
    if (!input.title?.trim() || !input.body?.trim())
      return badRequest("标题和内容不能为空。");
    return HttpResponse.json(addArtifact(input), { status: 201 });
  }),
  http.post("/api/tools/generate", async ({ request }) => {
    const input = (await request.json()) as ToolInput;
    const result = input && mockToolResult(input);
    if (!result) return badRequest("请选择工具，并填写一段学习材料。");
    await delay(250);
    return HttpResponse.json(result);
  }),
  http.post("/api/mia/sessions", async ({ request }) => {
    const { context } = (await request.json()) as {
      context: SourceContext | null;
    };
    if (
      context?.materialId &&
      (context.materialId !== material.id ||
        context.courseId !== material.courseId)
    )
      return notFound("学习资料");
    const id = crypto.randomUUID();
    sessions.set(id, context);
    return HttpResponse.json({ id }, { status: 201 });
  }),
  http.post("/api/mia/sessions/:id/turns", async ({ params, request }) => {
    const sessionId = String(params.id);
    if (!sessions.has(sessionId)) return notFound("辅导会话");
    const input = (await request.json()) as TurnInput;
    if (
      !input.clientTurnId ||
      typeof input.message !== "string" ||
      !["hint", "reply", "practice"].includes(input.mode)
    )
      return badRequest("辅导参数无效。");
    const nowActive = activeTurns.get(input.clientTurnId);
    if (nowActive) return badRequest("这一轮已在进行。");
    const context = sessions.get(sessionId) ?? null;
    const independent = isIndependentReviewPrompt(input.message);
    const parts =
      mockTutorResponse({
        ...input,
        context,
      }).match(/[\s\S]{1,9}/gu) ?? [];
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel: (() => void) | undefined;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let index = 0;
        let closed = false;
        const finish = () => {
          if (closed) return;
          closed = true;
          clearTimeout(timer);
          activeTurns.delete(input.clientTurnId);
          request.signal.removeEventListener("abort", finish);
          controller.close();
        };
        const send = (type: "delta" | "done", text?: string) => {
          controller.enqueue(
            encoder.encode(
              "data: " +
                JSON.stringify({ type, text, turnId: input.clientTurnId }) +
                "\n\n",
            ),
          );
        };
        const next = () => {
          if (closed) return;
          if (index < parts.length) {
            send("delta", parts[index++]);
            timer = setTimeout(next, 42);
          } else {
            if (!independent) finishedSessions.add(sessionId);
            if (
              !independent &&
              input.mode === "hint" &&
              hasSelectedExample(context)
            )
              hintedSessions.add(sessionId);
            send("done");
            finish();
          }
        };
        cancel = finish;
        activeTurns.set(input.clientTurnId, finish);
        request.signal.addEventListener("abort", finish, { once: true });
        timer = setTimeout(next, 270);
      },
      cancel() {
        clearTimeout(timer);
        activeTurns.delete(input.clientTurnId);
        if (cancel) request.signal.removeEventListener("abort", cancel);
      },
    });
    return new HttpResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }),
  http.post("/api/mia/turns/:id/interrupt", ({ params }) => {
    activeTurns.get(String(params.id))?.();
    return HttpResponse.json({ ok: true });
  }),
  http.post("/api/mia/sessions/:id/recap", ({ params }) => {
    const sessionId = String(params.id);
    if (!sessions.has(sessionId)) return notFound("辅导会话");
    if (!finishedSessions.has(sessionId))
      return badRequest("请先完成一轮辅导。");
    const context = sessions.get(sessionId);
    const recap = mockRecap(context);
    if (!recap) return badRequest("这门课程暂未配置模拟辅导复盘。");
    const progress = !hasSelectedExample(context)
      ? ""
      : checkedGuidedSessions.has(sessionId)
        ? "\n\n本次核对：在 Mia 的提示后提交了 x = 6，代回原式后等式成立。"
        : "\n\n本次尚未核对原题答案。";
    const unit = courses
      .find(({ id }) => id === context?.courseId)
      ?.units.find(({ id }) => id === context?.unitId);
    const draft: Recap = {
      id: crypto.randomUUID(),
      actionId: crypto.randomUUID(),
      title: `${context?.activityTitle ?? unit?.title ?? "一元一次方程"} · Mia 学习复盘`,
      body: `${recap}${progress}\n\n这是模拟复盘，不是成绩或掌握判定。`,
      source: context ?? undefined,
    };
    draftById.set(draft.actionId, draft);
    return HttpResponse.json(draft);
  }),
  http.post("/api/actions/:id/approve", async ({ params, request }) => {
    const action = String(params.id);
    const input = (await request.json()) as { title: string; body: string };
    const saved = savedByAction.get(action);
    if (saved) return HttpResponse.json(saved);
    const draft = draftById.get(action);
    if (!draft) return notFound("待确认的复盘");
    if (!input.title?.trim() || !input.body?.trim())
      return badRequest("复盘标题和内容不能为空。");
    const artifact = addArtifact(
      {
        kind: "recap",
        title: input.title.trim(),
        body: input.body.trim(),
        source: draft.source,
      },
      true,
    );
    savedByAction.set(action, artifact);
    draftById.delete(action);
    return HttpResponse.json(artifact, { status: 201 });
  }),
];
