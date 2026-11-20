import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import {
  getCourses,
  getGrowth,
  getSpace,
  getToday,
  rescheduleReviewTask,
} from "../../api/client";
import type { Artifact, SourceContext, Task } from "../../api/contracts";
import { courses, today } from "../../mocks/fixtures";
import { recordResume } from "../learning/sourceNavigation";
import { GrowthPage, SpacePage, TodayPage } from "./StudentPages";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  getToday: vi.fn(),
  getCourses: vi.fn(),
  getSpace: vi.fn(),
  getGrowth: vi.fn(),
  rescheduleReviewTask: vi.fn(),
}));

const source: SourceContext = {
  courseId: "math-7",
  materialId: "equations-1",
  materialTitle: "方程资料",
  page: 2,
  selectionId: "example-02",
};
const review: Task = {
  id: "review-task",
  title: "核对课后复习",
  completed: false,
  dueDate: "2099-05-03",
  reviewProposalId: "proposal",
  source,
};
const preview: Artifact = {
  id: "saved-cards",
  kind: "flashcards",
  title: "等式闪卡",
  body: "学生确认的内容",
  content: {
    type: "flashcards",
    cards: [{ front: "检查什么？", back: "两边条件。" }],
  },
  source,
  createdAt: "2026-11-19T00:00:00Z",
  simulated: true,
};

afterEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});

function open(path: string, page: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>{page}</MemoryRouter>
    </QueryClientProvider>,
  );
}

it("resumes the selected PDF location and changes a review date without changing its source", async () => {
  recordResume(source);
  vi.mocked(getToday).mockResolvedValue({
    ...today,
    tasks: [...today.tasks, review],
  });
  vi.mocked(rescheduleReviewTask).mockResolvedValue({
    ...review,
    dueDate: "2099-05-04",
  });
  open("/", <TodayPage />);
  expect(await screen.findByRole("link", { name: "接着学" })).toHaveAttribute(
    "href",
    "/courses/math-7/materials/equations-1?page=2&selection=example-02#material-exercise",
  );
  expect(screen.getByRole("link", { name: "开始复习" })).toHaveAttribute(
    "href",
    "/courses/math-7/materials/equations-1?page=2&selection=example-02&reviewTask=review-task",
  );
  expect(
    screen.getByRole("checkbox", { name: "完成一元一次方程的变式练习" }),
  ).not.toBeChecked();
  expect(screen.queryByRole("checkbox", { name: review.title })).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: `任务详情：${review.title}` }),
  );
  const detail = within(screen.getByRole("region", { name: "任务详情" }));
  fireEvent.change(detail.getByLabelText("调整复习日期"), {
    target: { value: "2099-05-04" },
  });
  fireEvent.click(detail.getByRole("button", { name: "保存日期" }));
  expect(await detail.findByText("复习日期已更新。")).toBeVisible();
  expect(vi.mocked(rescheduleReviewTask)).toHaveBeenCalledWith(
    review.id,
    "2099-05-04",
  );
  expect(detail.getByRole("time")).toHaveAttribute("datetime", "2099-05-04");
  fireEvent.click(screen.getByRole("button", { name: "未安排日期" }));
  expect(screen.queryByRole("link", { name: "开始复习" })).toBeNull();
});

it("preserves structured and legacy artifacts while filtering by provenance", async () => {
  const legacy: Artifact = {
    ...preview,
    id: "old-cards",
    title: "旧成果",
    kind: "summary",
    body: "旧成果正文",
    source: undefined,
    content: undefined,
  };
  vi.mocked(getSpace).mockResolvedValue([preview, legacy]);
  vi.mocked(getCourses).mockResolvedValue(courses);
  open(`/space?artifact=${preview.id}`, <SpacePage />);
  const detail = within(
    await screen.findByRole("region", { name: "成果预览" }),
  );
  expect(detail.getByText(preview.body)).toBeVisible();
  expect(detail.getByRole("region", { name: "结构化成果" })).toBeVisible();
  expect(
    detail.getByRole("link", { name: "在工具中重新打开" }),
  ).toHaveAttribute("href", "/tools?tool=flashcards&reopen=saved-cards");
  fireEvent.change(screen.getByLabelText("来源"), {
    target: { value: "unlinked" },
  });
  expect(detail.getByText(legacy.body)).toBeVisible();
  expect(detail.queryByRole("region", { name: "结构化成果" })).toBeNull();
  expect(
    detail.getByRole("link", { name: "在工具中重新打开" }),
  ).toHaveAttribute("href", "/tools?tool=summary&reopen=old-cards");
});

it("opens evidence details and keeps its source, task, and artifact links distinct", async () => {
  vi.mocked(getCourses).mockResolvedValue(courses);
  vi.mocked(getGrowth).mockResolvedValue([
    {
      id: "independent",
      title: "独立练习证据",
      kind: "mastery",
      basis: "activity",
      practiceMode: "independent",
      body: "活动中的独立练习。",
      taskId: review.id,
      artifactId: preview.id,
      source,
      createdAt: "2020-01-01T12:00:00Z",
    },
    {
      id: "inference",
      title: "Mia 发现",
      kind: "discovery",
      basis: "ai-inference",
      body: "建议再检查。",
      createdAt: preview.createdAt,
    },
  ]);
  open("/growth", <GrowthPage />);
  fireEvent.click(
    await screen.findByRole("button", { name: "证据详情：独立练习证据" }),
  );
  const detail = within(screen.getByRole("region", { name: "证据详情" }));
  expect(detail.getByRole("link", { name: "回到原出处" })).toHaveAttribute(
    "href",
    "/courses/math-7/materials/equations-1?page=2&selection=example-02&reviewTask=review-task",
  );
  expect(detail.getByRole("link", { name: "查看关联任务" })).toHaveAttribute(
    "href",
    "/?task=review-task",
  );
  expect(detail.getByRole("link", { name: "查看关联成果" })).toHaveAttribute(
    "href",
    "/space?artifact=saved-cards",
  );
  fireEvent.change(screen.getByLabelText("记录依据"), {
    target: { value: "ai-inference" },
  });
  expect(screen.getByRole("heading", { name: "Mia 发现" })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "证据详情：独立练习证据" }),
  ).toBeNull();
  await screen.findByRole("option", { name: "初中数学" });
  fireEvent.change(screen.getByLabelText("所属课程"), {
    target: { value: "math-7" },
  });
  expect(screen.queryByRole("heading", { name: "Mia 发现" })).toBeNull();
  fireEvent.change(screen.getByLabelText("记录依据"), {
    target: { value: "" },
  });
  expect(
    screen.getByRole("button", { name: "证据详情：独立练习证据" }),
  ).toBeVisible();
  fireEvent.change(screen.getByLabelText("记录日期"), {
    target: { value: "week" },
  });
  expect(
    screen.queryByRole("button", { name: "证据详情：独立练习证据" }),
  ).toBeNull();
});
