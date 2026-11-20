import type {
  Artifact,
  ArtifactInput,
  Course,
  Evidence,
  Material,
  Recap,
  SourceContext,
  Task,
  Today,
  ToolInput,
  ToolResult,
  TurnInput,
  PracticeResult,
  ReviewDecisionInput,
  ReviewPractice,
  ReviewProposal,
} from "./contracts";

async function request<T>(
  path: string,
  init?: RequestInit,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch("/api" + path, {
    ...init,
    signal,
    headers: {
      Accept: "application/json",
      ...(init?.body && { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(error?.error ?? "请求失败，请稍后重试。");
  }
  return response.json() as Promise<T>;
}

const body = (value: unknown) => ({
  method: "POST",
  body: JSON.stringify(value),
});
const safe = encodeURIComponent;

export const getToday = () => request<Today>("/today");
export const getCourses = () => request<Course[]>("/courses");
export const getCourse = (id: string) =>
  request<Course>("/courses/" + safe(id));
export const getMaterial = (id: string) =>
  request<Material>("/materials/" + safe(id));
export const getSpace = () => request<Artifact[]>("/space");
export const getGrowth = () => request<Evidence[]>("/growth");
export const updateTask = (id: string, completed: boolean) =>
  request<Task>("/tasks/" + safe(id), body({ completed }));
export const generateTool = (input: ToolInput) =>
  request<ToolResult>("/tools/generate", body(input));
export const saveArtifact = (input: ArtifactInput) =>
  request<Artifact>("/space", body(input));
export const startSession = (context: SourceContext | null) =>
  request<{ id: string }>("/mia/sessions", body({ context }));
export const interruptTurn = (turnId: string) =>
  request<{ ok: true }>("/mia/turns/" + safe(turnId) + "/interrupt", body({}));
export const createRecap = (id: string, context: SourceContext | null) =>
  request<Recap>("/mia/sessions/" + safe(id) + "/recap", body({ context }));
export const approveAction = (
  id: string,
  input: { title: string; body: string },
) => request<Artifact>("/actions/" + safe(id) + "/approve", body(input));
export const getReviewProposal = (artifactId: string, signal?: AbortSignal) =>
  request<ReviewProposal | null>(
    "/review/proposals/" + safe(artifactId),
    undefined,
    signal,
  );
export const decideReviewProposal = (
  proposalId: string,
  input: ReviewDecisionInput,
) =>
  request<ReviewProposal>(
    "/review/proposals/" + safe(proposalId) + "/decision",
    body(input),
  );
export const getReviewPractice = (taskId: string, signal?: AbortSignal) =>
  request<ReviewPractice>(
    "/review/practice/" + safe(taskId),
    undefined,
    signal,
  );
export const rescheduleReviewTask = (taskId: string, dueDate: string) =>
  request<Task>(
    "/review/practice/" + safe(taskId) + "/reschedule",
    body({ dueDate }),
  );
export const submitReviewAnswer = (taskId: string, answer: string) =>
  request<PracticeResult>(
    "/review/practice/" + safe(taskId) + "/answer",
    body({ answer }),
  );
export const checkGuidedAnswer = (sessionId: string, answer: string) =>
  request<PracticeResult>(
    "/review/guided/" + safe(sessionId) + "/answer",
    body({ answer }),
  );

export async function streamTurn(
  sessionId: string,
  input: TurnInput,
  signal?: AbortSignal,
  onDelta?: (delta: string) => void,
): Promise<string> {
  const response = await fetch(
    "/api/mia/sessions/" + safe(sessionId) + "/turns",
    {
      ...body(input),
      signal,
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      },
    },
  );
  if (!response.ok || !response.body) throw new Error("辅导未能开始，请重试。");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let text = "";
  let buffer = "";
  let done = false;
  try {
    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += chunk.value;
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const payload = frame
          .split("\n")
          .find((line) => line.startsWith("data: "));
        if (!payload) continue;
        const event = JSON.parse(payload.slice(6)) as {
          type: "delta" | "done";
          text?: string;
          turnId: string;
        };
        if (event.turnId !== input.clientTurnId) continue;
        if (event.type === "done") {
          done = true;
          break;
        }
        if (event.text) {
          text += event.text;
          onDelta?.(event.text);
        }
      }
    }
    if (!done) throw new Error("辅导连接提前结束，请重试。");
    return text;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
