import { create } from "zustand";
import type { SourceContext } from "../../api/contracts";
import {
  canGenerateStoryboard,
  isStoryboardScript,
  previewMockStoryboard,
  runMockStoryboard,
  type StoryboardScene,
} from "../../mocks/storyboardProvider";

type StoryboardDraft = Awaited<ReturnType<typeof runMockStoryboard>>;
type StoryboardAttempt = {
  id: string;
  source: SourceContext;
  scenario: "success" | "fail-once";
  attempt: number;
  script: StoryboardScene[];
};
type StoryboardJob = StoryboardAttempt &
  (
    | { status: "queued" | "generating" }
    | { status: "failed"; message: string }
    | { status: "ready"; result: StoryboardDraft }
    | { status: "saved"; result: StoryboardDraft; artifactId: string }
  );
interface StoryboardStore {
  job: StoryboardJob | null;
  start: (
    source: SourceContext,
    script: StoryboardScene[],
    failOnce: boolean,
  ) => void;
  resume: () => void;
  retry: () => void;
  markSaved: (id: string, artifactId: string) => void;
}

const storageKey = "aixueji.mia-storyboard.v1";

function loadJob(): StoryboardJob | null {
  try {
    const raw = localStorage.getItem(storageKey);
    const job = raw ? (JSON.parse(raw) as StoryboardJob) : null;
    if (
      !job ||
      typeof job.id !== "string" ||
      !canGenerateStoryboard(job.source) ||
      !Number.isInteger(job.attempt) ||
      job.attempt < 1 ||
      (job.scenario !== "success" && job.scenario !== "fail-once")
    )
      return null;
    const script = isStoryboardScript(job.script)
      ? job.script
      : previewMockStoryboard(job.source).content.scenes;
    if (
      job.status === "queued" ||
      job.status === "generating" ||
      (job.status === "failed" && typeof job.message === "string")
    )
      return { ...job, script };
    if (
      (job.status === "ready" ||
        (job.status === "saved" && typeof job.artifactId === "string")) &&
      job.result?.content?.type === "storyboard" &&
      isStoryboardScript(job.result.content.scenes)
    )
      return { ...job, script: job.result.content.scenes };
  } catch {
    // Loading an unavailable or old demo record shouldn't block the tutor.
  }
  return null;
}

export const useStoryboardJob = create<StoryboardStore>((set, get) => {
  let runningAttempt = "";
  const commit = (job: StoryboardJob) => {
    set({ job });
    try {
      localStorage.setItem(storageKey, JSON.stringify(job));
    } catch {
      // The current tab can still display the demo when storage is unavailable.
    }
  };
  const run = (job: StoryboardAttempt, queue = true) => {
    const key = `${job.id}:${job.attempt}`;
    if (key === runningAttempt) return;
    runningAttempt = key;
    const generate = () => {
      commit({ ...job, status: "generating" });
      void runMockStoryboard(job)
        .then(
          (result) => commit({ ...job, status: "ready", result }),
          (error: unknown) =>
            commit({
              ...job,
              status: "failed",
              message:
                error instanceof Error
                  ? error.message
                  : "分镜暂未生成，请重试。",
            }),
        )
        .finally(() => {
          if (runningAttempt === key) runningAttempt = "";
        });
    };
    if (queue) {
      commit({ ...job, status: "queued" });
      setTimeout(generate, 600);
    } else generate();
  };
  return {
    job: loadJob(),
    start(source, script, failOnce) {
      if (
        get().job ||
        !canGenerateStoryboard(source) ||
        !isStoryboardScript(script)
      )
        return;
      run({
        id: `storyboard-${Date.now()}`,
        source,
        script,
        attempt: 1,
        scenario: failOnce ? "fail-once" : "success",
      });
    },
    resume() {
      const job = get().job;
      if (job?.status === "queued" || job?.status === "generating")
        run(job, job.status === "queued");
    },
    retry() {
      const job = get().job;
      if (job?.status === "failed") {
        const { id, source, script, scenario, attempt } = job;
        run({ id, source, script, scenario, attempt: attempt + 1 });
      }
    },
    markSaved(id, artifactId) {
      const job = get().job;
      if (job?.status === "ready" && job.id === id)
        commit({ ...job, status: "saved", artifactId });
    },
  };
});
