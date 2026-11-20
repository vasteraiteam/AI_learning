import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Film,
  Pencil,
  RotateCcw,
  Save,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { saveArtifact } from "../../api/client";
import type { SourceContext } from "../../api/contracts";
import {
  isStoryboardScript,
  previewMockStoryboard,
  storyboardFieldLimits,
  type StoryboardScene,
} from "../../mocks/storyboardProvider";
import { useStoryboardJob } from "./storyboardJob";

const editorLabels = {
  title: "标题",
  visual: "画面",
  narration: "旁白",
} as const;

export function MiaStoryboard({
  source,
  onNavigate,
}: {
  source: SourceContext;
  onNavigate: () => void;
}) {
  const titleId = useId();
  const job = useStoryboardJob((state) => state.job);
  const start = useStoryboardJob((state) => state.start);
  const retry = useStoryboardJob((state) => state.retry);
  const resume = useStoryboardJob((state) => state.resume);
  const markSaved = useStoryboardJob((state) => state.markSaved);
  const queryClient = useQueryClient();
  const [failOnce, setFailOnce] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [script, setScript] = useState<StoryboardScene[] | null>(null);

  useEffect(() => {
    resume();
  }, [resume]);

  const save = useMutation({
    mutationFn: (draft: NonNullable<typeof job> & { status: "ready" }) =>
      saveArtifact(draft.result),
    onSuccess: (artifact, draft) => {
      markSaved(draft.id, artifact.id);
      void queryClient.invalidateQueries({ queryKey: ["space"] });
    },
  });
  const scenes =
    job?.status === "ready" || job?.status === "saved"
      ? job.result.content.scenes
      : job?.status === "failed"
        ? job.script
        : [];
  const scene = scenes[sceneIndex];
  const editingScene = !job && script ? script[sceneIndex] : null;

  return (
    <section className="mia-storyboard" aria-labelledby={titleId}>
      <h3 id={titleId}>
        <Film size={16} aria-hidden="true" /> 讲解分镜（演示）
      </h3>
      <p>模拟分镜，未生成视频。</p>
      {!job && !script && (
        <div className="mia-storyboard__actions">
          <button
            className="action-secondary"
            type="button"
            onClick={() =>
              setScript(previewMockStoryboard(source).content.scenes)
            }
          >
            <Pencil size={15} aria-hidden="true" />
            预览分镜脚本
          </button>
        </div>
      )}
      {editingScene && script && (
        <form
          className="mia-storyboard__editor"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isStoryboardScript(script)) return;
            setSceneIndex(0);
            start(source, script, failOnce);
          }}
        >
          <fieldset className="mia-storyboard__scene">
            <legend>
              分镜脚本 · 第 {sceneIndex + 1} / {script.length} 幕
            </legend>
            {(["title", "visual", "narration"] as const).map((field) => (
              <label key={field}>
                第 {sceneIndex + 1} 幕{editorLabels[field]}
                <textarea
                  key={sceneIndex}
                  rows={field === "title" ? 1 : 2}
                  required
                  maxLength={storyboardFieldLimits[field]}
                  value={editingScene[field]}
                  onChange={(event) => {
                    const value = event.target.value;
                    setScript(
                      (current) =>
                        current?.map((item, index) =>
                          index === sceneIndex
                            ? { ...item, [field]: value }
                            : item,
                        ) ?? null,
                    );
                  }}
                />
              </label>
            ))}
          </fieldset>
          <SceneNavigation
            index={sceneIndex}
            total={script.length}
            onChange={setSceneIndex}
          />
          <div className="mia-storyboard__actions">
            <button
              className="action-primary"
              type="submit"
              disabled={!isStoryboardScript(script)}
            >
              <Film size={15} aria-hidden="true" />
              确认生成分镜
            </button>
            <label>
              <input
                type="checkbox"
                checked={failOnce}
                onChange={(event) => setFailOnce(event.target.checked)}
              />
              模拟首次失败
            </label>
          </div>
        </form>
      )}
      {job?.status === "queued" && <p role="status">已排队，等待模拟生成…</p>}
      {job?.status === "generating" && <p role="status">正在生成模拟分镜…</p>}
      {job?.status === "failed" && (
        <>
          <p className="mia-storyboard__error" role="alert">
            {job.message}
          </p>
          <button className="action-secondary" type="button" onClick={retry}>
            <RotateCcw size={15} aria-hidden="true" />
            重试
          </button>
        </>
      )}
      {scene && (
        <>
          <div className="mia-storyboard__scene" aria-live="polite">
            <p>
              第 {sceneIndex + 1} / {scenes.length} 幕
            </p>
            <h4>{scene.title}</h4>
            <p>
              <b>画面</b> {scene.visual}
            </p>
            <p>
              <b>旁白</b> {scene.narration}
            </p>
          </div>
          <SceneNavigation
            index={sceneIndex}
            total={scenes.length}
            onChange={setSceneIndex}
          />
        </>
      )}
      {job?.status === "ready" && (
        <button
          className="action-secondary"
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate(job)}
        >
          <Save size={15} aria-hidden="true" />
          {save.isPending ? "正在保存…" : "保存到空间"}
        </button>
      )}
      {save.isError && (
        <p className="mia-storyboard__error" role="alert">
          保存失败，请重试。
        </p>
      )}
      {job?.status === "saved" && (
        <div className="mia-storyboard__saved">
          <p role="status">
            <CircleCheck size={16} aria-hidden="true" />
            已保存到空间
          </p>
          <Link
            className="mia-source-link"
            to={`/space?artifact=${encodeURIComponent(job.artifactId)}`}
            onClick={onNavigate}
          >
            前往空间
          </Link>
        </div>
      )}
    </section>
  );
}

function SceneNavigation({
  index,
  total,
  onChange,
}: {
  index: number;
  total: number;
  onChange: (index: number) => void;
}) {
  return (
    <div className="mia-storyboard__actions">
      <button
        aria-label="上一幕"
        className="mia-icon-button"
        title="上一幕"
        type="button"
        disabled={index === 0}
        onClick={() => onChange(index - 1)}
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <button
        aria-label="下一幕"
        className="mia-icon-button"
        title="下一幕"
        type="button"
        disabled={index === total - 1}
        onClick={() => onChange(index + 1)}
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
      <button
        aria-label="从头预览"
        className="mia-icon-button"
        title="从头预览"
        type="button"
        disabled={index === 0}
        onClick={() => onChange(0)}
      >
        <RotateCcw size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
