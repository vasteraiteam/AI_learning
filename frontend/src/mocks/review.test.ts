import { setupServer } from "msw/node";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import {
  approveAction,
  checkGuidedAnswer,
  createRecap,
  decideReviewProposal,
  getGrowth,
  getReviewPractice,
  getReviewProposal,
  getToday,
  rescheduleReviewTask,
  saveArtifact,
  startSession,
  streamTurn,
  submitReviewAnswer,
  updateTask,
} from "../api/client";
import type { Artifact, Evidence, SourceContext } from "../api/contracts";
import { material, starterArtifacts, starterEvidence, today } from "./fixtures";
import { handlers } from "./handlers";

const server = setupServer(...handlers);
const example: SourceContext = {
  courseId: material.courseId,
  materialId: material.id,
  materialTitle: material.title,
  page: material.exercisePage,
  selectionId: material.exercise.id,
  selectionText: material.exercise.equation,
};
const oldRecap: Artifact = {
  id: "old-recap",
  kind: "recap",
  title: "旧复盘",
  body: "已保存的示例复盘。",
  source: example,
  createdAt: "2026-11-18T06:00:00.000Z",
  simulated: true,
};
const oldConfirmation: Evidence = {
  id: oldRecap.id,
  title: "已确认：旧复盘",
  body: "学生确认保存的模拟辅导复盘。",
  kind: "creation",
  basis: "student-confirmed",
  createdAt: oldRecap.createdAt,
  source: example,
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
beforeEach(() => {
  localStorage.setItem(
    "aixueji-v1-demo",
    JSON.stringify({
      tasks: today.tasks,
      artifacts: [oldRecap, ...starterArtifacts],
      evidence: [oldConfirmation, ...starterEvidence],
    }),
  );
});

it("persists the first decision for an already saved V1 recap and gates completion on a correct variant", async () => {
  const proposal = await getReviewProposal(oldRecap.id);
  expect(proposal).toMatchObject({ status: "pending", source: example });
  if (!proposal) throw new Error("Expected a proposal for the saved recap");
  await expect(getReviewProposal(starterArtifacts[0].id)).resolves.toBeNull();

  const title = "我的独立复习计划";
  const dueDate = "2026-12-01";
  await expect(
    decideReviewProposal(proposal.id, {
      decision: "confirm",
      dueDate: "2026-02-30",
    }),
  ).rejects.toThrow("请选择有效的复习日期");
  const confirmed = await decideReviewProposal(proposal.id, {
    decision: "confirm",
    title,
    dueDate,
  });
  expect(confirmed).toMatchObject({ status: "confirmed", title, dueDate });
  if (!confirmed.taskId) throw new Error("Expected a review task");
  await expect(getReviewProposal(oldRecap.id)).resolves.toEqual(confirmed);
  await expect(
    decideReviewProposal(proposal.id, { decision: "reject" }),
  ).resolves.toEqual(confirmed);
  await expect(
    decideReviewProposal(proposal.id, {
      decision: "confirm",
      title: "另一个标题",
    }),
  ).resolves.toEqual(confirmed);
  expect(
    (await getToday()).tasks.filter(
      (task) => task.reviewProposalId === proposal.id,
    ),
  ).toHaveLength(1);

  await expect(getReviewPractice(confirmed.taskId)).resolves.toMatchObject({
    task: {
      id: confirmed.taskId,
      title,
      dueDate,
      source: example,
      completed: false,
    },
    question: "5(x − 2) = 30",
  });
  const movedDate = "2026-12-02";
  await expect(
    rescheduleReviewTask(confirmed.taskId, "2026-02-30"),
  ).rejects.toThrow("请选择有效的复习日期");
  await expect(
    rescheduleReviewTask(confirmed.taskId, movedDate),
  ).resolves.toMatchObject({
    id: confirmed.taskId,
    dueDate: movedDate,
    source: example,
  });
  expect((await getReviewProposal(oldRecap.id))?.dueDate).toBe(movedDate);
  expect(
    (await getToday()).tasks.find((task) => task.id === confirmed.taskId)
      ?.dueDate,
  ).toBe(movedDate);
  await expect(updateTask(confirmed.taskId, true)).rejects.toThrow(
    "请通过独立练习",
  );
  await expect(
    submitReviewAnswer(confirmed.taskId, "6"),
  ).resolves.toMatchObject({ correct: false });
  expect((await getReviewPractice(confirmed.taskId)).task.completed).toBe(
    false,
  );
  expect(
    (await getGrowth()).some((entry) => entry.taskId === confirmed.taskId),
  ).toBe(false);

  const result = await submitReviewAnswer(confirmed.taskId, "x = 8");
  expect(result).toMatchObject({
    correct: true,
    evidence: { practiceMode: "independent", taskId: confirmed.taskId },
  });
  const repeat = await submitReviewAnswer(confirmed.taskId, "8");
  expect(repeat.evidence).toEqual(result.evidence);
  expect(
    (await getToday()).tasks.find((task) => task.id === confirmed.taskId)
      ?.completed,
  ).toBe(true);
  expect(
    (await getGrowth()).filter((entry) => entry.taskId === confirmed.taskId),
  ).toHaveLength(1);
  await expect(rescheduleReviewTask(confirmed.taskId, dueDate)).rejects.toThrow(
    "已完成的复习任务不能改期",
  );
});

it("keeps a rejection in effect and does not create a task", async () => {
  const proposal = await getReviewProposal(oldRecap.id);
  if (!proposal) throw new Error("Expected a proposal for the saved recap");
  const rejected = await decideReviewProposal(proposal.id, {
    decision: "reject",
  });
  expect(rejected).toMatchObject({ status: "rejected" });
  await expect(getReviewProposal(oldRecap.id)).resolves.toEqual(rejected);
  await expect(
    decideReviewProposal(proposal.id, { decision: "confirm" }),
  ).resolves.toEqual(rejected);
  expect((await getToday()).tasks).toEqual(today.tasks);
});

it("requires a completed contextual hint and records each source only once", async () => {
  const first = await startSession(example);
  const hint = (id: string) =>
    streamTurn(id, {
      clientTurnId: crypto.randomUUID(),
      message: "请给我提示",
      mode: "hint",
      context: example,
    });

  await expect(checkGuidedAnswer(first.id, "x = 6")).resolves.toMatchObject({
    correct: false,
  });
  await hint(first.id);
  const draft = await createRecap(first.id, example);
  const saved = await approveAction(draft.actionId, {
    title: draft.title,
    body: draft.body,
  });
  await expect(getReviewProposal(saved.id)).resolves.toMatchObject({
    status: "pending",
  });
  const generic = await saveArtifact({
    kind: "recap",
    title: "通用保存",
    body: "未通过复盘确认",
    source: example,
  });
  await expect(getReviewProposal(generic.id)).resolves.toBeNull();

  await expect(checkGuidedAnswer(first.id, "4")).resolves.toMatchObject({
    correct: false,
  });
  expect((await getGrowth()).some((entry) => entry.practiceMode)).toBe(false);
  const assisted = await checkGuidedAnswer(first.id, "ｘ＝６");
  expect(assisted).toMatchObject({
    correct: true,
    evidence: { practiceMode: "assisted", source: example },
  });

  const second = await startSession(example);
  await expect(checkGuidedAnswer(second.id, "6")).resolves.toMatchObject({
    correct: false,
  });
  await hint(second.id);
  expect((await checkGuidedAnswer(second.id, "6")).evidence).toEqual(
    assisted.evidence,
  );
  expect(
    (await getGrowth()).filter((entry) => entry.practiceMode === "assisted"),
  ).toHaveLength(1);
});
