import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { generateTool, getSpace, saveArtifact } from "../../api/client";
import type {
  ArtifactContent,
  SourceContext,
  ToolResult,
} from "../../api/contracts";
import { toolSamples } from "../../mocks/toolSamples";
import { sourceFromSearch, sourceHref } from "../learning/sourceNavigation";
import { useMiaStore } from "../mia/store";
import "./tool-workbench.css";

type Tool = { id: string; title: string };

function sameSource(a: SourceContext, b: SourceContext) {
  return (
    a.courseId === b.courseId &&
    (a.materialId
      ? a.materialId === b.materialId &&
        a.page === b.page &&
        a.selectionId === b.selectionId
      : !!a.activityId &&
        a.activityId === b.activityId &&
        a.unitId === b.unitId)
  );
}

function SourceLink({ source }: { source: SourceContext }) {
  return (
    <Link
      className="student-inline-link"
      to={sourceHref(source, { focusSelection: true })}
    >
      返回来源
      {source.page
        ? ` · 第 ${source.page} 页`
        : source.activityTitle
          ? ` · ${source.activityTitle}`
          : ""}
    </Link>
  );
}

export function ToolWorkbench({ tool }: { tool: Tool }) {
  const [params] = useSearchParams();
  const reopen = params.get("reopen");
  const query = useQuery({
    queryKey: ["space"],
    queryFn: getSpace,
    enabled: !!reopen,
  });
  const found = reopen
    ? query.data?.find((item) => item.id === reopen && item.kind === tool.id)
    : undefined;
  if (reopen && !found)
    return (
      <section className="surface-card student-workbench">
        <h2>{tool.title}</h2>
        <p role={query.isPending ? "status" : "alert"}>
          {query.isPending
            ? "正在打开成果…"
            : query.isError
              ? "无法读取成果，请重试。"
              : "没有找到此成果。"}
        </p>
        {query.isError && (
          <button
            className="action-secondary"
            onClick={() => void query.refetch()}
          >
            重试
          </button>
        )}
        <Link className="student-inline-link" to="/space">
          返回空间
        </Link>
      </section>
    );
  return (
    <Workbench
      key={`${tool.id}:${reopen ?? params.toString()}`}
      tool={tool}
      initial={found}
      reopen={reopen}
      linked={sourceFromSearch(params)}
    />
  );
}

function Workbench({
  tool,
  initial,
  reopen,
  linked,
}: {
  tool: Tool;
  initial?: ToolResult;
  reopen: string | null;
  linked?: SourceContext;
}) {
  const client = useQueryClient();
  const heading = useRef<HTMLHeadingElement>(null);
  const navigate = useNavigate();
  const photo = tool.id === "photo";
  const linkedSample =
    linked && toolSamples.find((sample) => sameSource(sample.source, linked));
  const [sampleId, setSampleId] = useState(
    initial?.sampleId ?? (linkedSample ? linkedSample.id : ""),
  );
  const [input, setInput] = useState(
    linkedSample ? linkedSample.input : (linked?.activityPrompt ?? ""),
  );
  const [draft, setDraft] = useState<ToolResult | null>(initial ?? null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [fileError, setFileError] = useState("");
  const [editing, setEditing] = useState(false);
  const [revision, setRevision] = useState(0);
  const example = toolSamples.find((item) => item.id === sampleId);
  const setContext = useMiaStore((state) => state.setContext);
  const setOpen = useMiaStore((state) => state.setOpen);

  useEffect(() => heading.current?.focus(), []);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const generation = useMutation({
    mutationFn: () =>
      generateTool({
        toolId: tool.id,
        input: input.trim(),
        sampleId: example?.id,
        source: example?.source ?? (!linkedSample ? linked : undefined),
      }),
    onSuccess: (result) => {
      setDraft(result);
      setSavedId(null);
      setEditing(false);
      setRevision((value) => value + 1);
    },
  });
  const saving = useMutation({
    mutationFn: (reviewed: ToolResult) =>
      saveArtifact({
        kind: reviewed.kind,
        title: reviewed.title.trim(),
        body: reviewed.body.trim(),
        source: reviewed.source,
        content: reviewed.content,
        sampleId: reviewed.sampleId,
      }),
    onSuccess: (artifact) => {
      setSavedId(artifact.id);
      void client.invalidateQueries({ queryKey: ["space"] });
    },
  });
  const pending = generation.isPending || saving.isPending;
  const locked = pending || !!savedId;
  const origin = draft?.source ?? example?.source ?? linked;

  function chooseSample(id: string) {
    setSampleId(id);
    setInput(toolSamples.find((item) => item.id === id)?.input ?? "");
  }

  return (
    <div className="student-two-column tool-workbench">
      <section
        className="surface-card student-workbench"
        aria-labelledby="student-tool-title"
      >
        <div className="tool-header">
          <h2 id="student-tool-title" ref={heading} tabIndex={-1}>
            {tool.title}
          </h2>
          <span className="tool-badge">
            {photo ? "无真实 OCR" : "模拟演示"}
          </span>
        </div>
        {initial && (
          <p className="student-help">
            已打开空间成果；再次保存将创建新版本，保留原件。
          </p>
        )}
        <form
          className="student-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!pending && input.trim()) {
              saving.reset();
              generation.mutate();
            }
          }}
        >
          {photo && (
            <div className="tool-photo">
              <label>
                <span>
                  <ImagePlus size={16} aria-hidden="true" /> 本地图片
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const selected = event.currentTarget.files?.[0];
                    if (!selected) return;
                    if (
                      !selected.type.startsWith("image/") ||
                      selected.size > 10 * 1024 * 1024
                    ) {
                      setFileError("请选择不超过 10 MB 的图片。");
                      return;
                    }
                    setFileError("");
                    setFile(selected);
                    setPreview("");
                    chooseSample("");
                  }}
                />
              </label>
              {fileError && (
                <p className="student-error" role="alert">
                  {fileError}
                </p>
              )}
              {file && preview && (
                <>
                  <img src={preview} alt="本地题目图片预览" />
                  <p className="student-help">
                    图片仅在本页预览，不上传、不识别。
                  </p>
                </>
              )}
            </div>
          )}
          <label>
            资料来源
            <select
              value={sampleId}
              onChange={(event) => chooseSample(event.currentTarget.value)}
            >
              <option value="">
                {linked && !linkedSample ? "当前来源 · 手动输入" : "手动输入"}
              </option>
              {toolSamples
                .filter((sample) => !photo || sample.id === "pdf-example-02")
                .map((sample) => (
                  <option key={sample.id} value={sample.id}>
                    {sample.label}
                  </option>
                ))}
            </select>
          </label>
          {origin && !draft?.source && <SourceLink source={origin} />}
          <label>
            {photo ? "题目文字" : "材料或知识点"}
            <textarea
              value={input}
              onChange={(event) => {
                setInput(event.currentTarget.value);
                if (event.currentTarget.value !== example?.input)
                  setSampleId("");
              }}
              maxLength={5000}
              required
            />
          </label>
          <div className="student-actions">
            <button
              type="submit"
              className="action-primary"
              disabled={!input.trim() || pending}
            >
              <Sparkles size={16} aria-hidden="true" />{" "}
              {generation.isPending ? "正在生成…" : "生成草稿"}
            </button>
            {photo && (
              <button
                type="button"
                className="action-secondary"
                disabled={pending}
                onClick={() => chooseSample("pdf-example-02")}
              >
                载入示例题目（模拟）
              </button>
            )}
          </div>
          {generation.isError && (
            <p className="student-error" role="alert">
              {generation.error.message}
            </p>
          )}
        </form>
      </section>
      <section
        className="surface-card student-workbench"
        aria-labelledby="student-tool-review"
      >
        <div className="tool-header">
          <h2 id="student-tool-review">草稿预览</h2>
          {draft && <span className="tool-badge">模拟生成</span>}
        </div>
        {draft ? (
          <form
            className="student-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!locked && draft.title.trim() && draft.body.trim())
                saving.mutate(draft);
            }}
          >
            <label>
              草稿标题
              <input
                value={draft.title}
                readOnly={locked}
                required
                maxLength={120}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.currentTarget.value })
                }
              />
            </label>
            {draft.content && (
              <>
                {(draft.content.type === "flashcards" ||
                  draft.content.type === "quiz") && (
                  <button
                    type="button"
                    className="action-secondary"
                    disabled={locked}
                    onClick={() => setEditing(!editing)}
                  >
                    {editing
                      ? "完成编辑"
                      : draft.content.type === "flashcards"
                        ? "编辑卡片"
                        : "编辑题目"}
                  </button>
                )}
                <ContentEditor
                  key={revision}
                  content={draft.content}
                  locked={locked}
                  editing={editing}
                  onChange={(content) => setDraft({ ...draft, content })}
                />
                {draft.source && <SourceLink source={draft.source} />}
              </>
            )}
            <details open={!draft.content || undefined}>
              <summary>附注</summary>
              <label>
                草稿内容
                <textarea
                  value={draft.body}
                  readOnly={locked}
                  required
                  maxLength={8000}
                  onChange={(event) =>
                    setDraft({ ...draft, body: event.currentTarget.value })
                  }
                />
              </label>
            </details>
            <div className="student-actions">
              {!savedId && (
                <button
                  type="submit"
                  className="action-primary"
                  disabled={locked || !draft.title.trim() || !draft.body.trim()}
                >
                  <Check size={16} aria-hidden="true" />{" "}
                  {saving.isPending ? "正在保存…" : "确认保存到空间"}
                </button>
              )}
              {photo &&
                draft.source &&
                draft.content?.type === "photo" &&
                draft.content.equation && (
                  <button
                    type="button"
                    className="action-secondary"
                    onClick={() => {
                      const source = draft.source!;
                      navigate(sourceHref(source, { focusSelection: true }));
                      setContext(source);
                      setOpen(true);
                    }}
                  >
                    用示例原题问 Mia
                  </button>
                )}
            </div>
            {saving.isError && (
              <p className="student-error" role="alert">
                {saving.error.message}
              </p>
            )}
            {savedId && (
              <p className="student-status" role="status">
                已保存到空间{" "}
                <Link
                  className="student-inline-link"
                  to={`/space?artifact=${encodeURIComponent(savedId)}`}
                >
                  查看成果 <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </p>
            )}
          </form>
        ) : (
          <p className="student-help">
            {generation.isPending ? "正在准备草稿…" : "暂无草稿。"}
          </p>
        )}
        {initial && reopenLink(reopen)}
      </section>
    </div>
  );
}

function reopenLink(id: string | null) {
  return (
    <Link
      className="student-inline-link"
      to={id ? `/space?artifact=${encodeURIComponent(id)}` : "/space"}
    >
      返回空间成果
    </Link>
  );
}

type EditorProps = {
  content: ArtifactContent;
  editing: boolean;
  locked: boolean;
  onChange: (content: ArtifactContent) => void;
};

function EditList({
  items,
  noun,
  locked,
  onChange,
}: {
  items: { title: string; text: string }[];
  noun: string;
  locked: boolean;
  onChange: (items: { title: string; text: string }[]) => void;
}) {
  return (
    <div className="tool-content">
      {items.map((item, index) => (
        <fieldset key={index} disabled={locked} className="tool-item">
          <legend>
            {noun} {index + 1}
          </legend>
          <label>
            {noun}标题 {index + 1}
            <input
              value={item.title}
              onChange={(event) =>
                onChange(
                  items.map((entry, i) =>
                    i === index
                      ? { ...entry, title: event.currentTarget.value }
                      : entry,
                  ),
                )
              }
              required
            />
          </label>
          <label>
            {noun}内容 {index + 1}
            <textarea
              value={item.text}
              onChange={(event) =>
                onChange(
                  items.map((entry, i) =>
                    i === index
                      ? { ...entry, text: event.currentTarget.value }
                      : entry,
                  ),
                )
              }
              required
            />
          </label>
          {items.length > 1 && (
            <button
              type="button"
              className="action-secondary"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <Trash2 size={15} aria-hidden="true" /> 删除{noun} {index + 1}
            </button>
          )}
        </fieldset>
      ))}
      {!locked && (
        <button
          type="button"
          className="action-secondary"
          onClick={() => onChange([...items, { title: "", text: "" }])}
        >
          <Plus size={15} aria-hidden="true" /> 添加{noun}
        </button>
      )}
    </div>
  );
}

function ContentEditor({ content, editing, locked, onChange }: EditorProps) {
  if (content.type === "photo")
    return (
      <>
        <label>
          核对题目
          <textarea
            value={content.equation}
            readOnly={locked}
            required
            onChange={(event) =>
              onChange({ ...content, equation: event.currentTarget.value })
            }
          />
        </label>
        <ul>
          {content.checks.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </>
    );
  if (content.type === "explain")
    return (
      <EditList
        items={content.steps}
        noun="步骤"
        locked={locked}
        onChange={(steps) => onChange({ ...content, steps })}
      />
    );
  if (content.type === "summary")
    return (
      <EditList
        items={content.sections}
        noun="要点"
        locked={locked}
        onChange={(sections) => onChange({ ...content, sections })}
      />
    );
  if (content.type === "podcast")
    return (
      <>
        <p className="student-help">分角色脚本 · 不生成音频</p>
        <EditList
          items={content.lines.map(({ speaker, text }) => ({
            title: speaker,
            text,
          }))}
          noun="台词"
          locked={locked}
          onChange={(items) =>
            onChange({
              ...content,
              lines: items.map(({ title, text }) => ({ speaker: title, text })),
            })
          }
        />
      </>
    );
  if (content.type === "mindmap")
    return (
      <div className="tool-content">
        <div className="tool-tree" aria-label="导图预览">
          <strong>{content.root || "中心主题"}</strong>
          <ul>
            {content.branches.map(({ label, children }, index) => (
              <li key={index}>
                {label || "新分支"}
                <ul>
                  {children
                    .filter((child) => child.trim())
                    .map((child, i) => (
                      <li key={i}>{child}</li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
        <label>
          中心主题
          <input
            value={content.root}
            readOnly={locked}
            required
            onChange={(e) =>
              onChange({ ...content, root: e.currentTarget.value })
            }
          />
        </label>
        <EditList
          items={content.branches.map(({ label, children }) => ({
            title: label,
            text: children.join("\n"),
          }))}
          noun="分支"
          locked={locked}
          onChange={(items) =>
            onChange({
              ...content,
              branches: items.map(({ title, text }) => ({
                label: title,
                children: text.split("\n"),
              })),
            })
          }
        />
      </div>
    );
  if (content.type === "flashcards")
    return editing ? (
      <EditList
        items={content.cards.map(({ front, back }) => ({
          title: front,
          text: back,
        }))}
        noun="卡片"
        locked={locked}
        onChange={(items) =>
          onChange({
            ...content,
            cards: items.map(({ title, text }) => ({
              front: title,
              back: text,
            })),
          })
        }
      />
    ) : (
      <Flashcards cards={content.cards} />
    );
  if (content.type === "quiz")
    return (
      <Quiz
        key={editing ? "edit" : "practice"}
        data={content}
        editing={editing}
        onChange={onChange}
      />
    );
  return null;
}

function Flashcards({
  cards,
}: {
  cards: Extract<ArtifactContent, { type: "flashcards" }>["cards"];
}) {
  const [position, setPosition] = useState(0);
  const [back, setBack] = useState(false);
  const [self, setSelf] = useState<Record<number, string>>({});
  const index = Math.min(position, cards.length - 1);
  const card = cards[index];
  if (!card) return <p>暂无卡片。</p>;
  function move(offset: number) {
    setPosition(index + offset);
    setBack(false);
  }
  return (
    <div className="tool-content">
      <div className="tool-card">
        <p className="student-help">
          第 {index + 1} / {cards.length} 张 · {back ? "背面" : "正面"}
        </p>
        <p>{back ? card.back : card.front}</p>
      </div>
      <div className="student-actions">
        <button
          type="button"
          className="action-secondary"
          disabled={index === 0}
          onClick={() => move(-1)}
        >
          <ArrowLeft size={16} aria-hidden="true" /> 上一张
        </button>
        <button
          type="button"
          className="action-secondary"
          onClick={() => setBack(!back)}
        >
          翻面
        </button>
        <button
          type="button"
          className="action-secondary"
          disabled={index === cards.length - 1}
          onClick={() => move(1)}
        >
          下一张 <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
      {back && (
        <div className="student-actions">
          {["记住了", "还需复习"].map((value) => (
            <button
              type="button"
              className="action-secondary"
              key={value}
              aria-pressed={self[index] === value}
              onClick={() => setSelf({ ...self, [index]: value })}
            >
              {value}
            </button>
          ))}
        </div>
      )}
      {self[index] && (
        <p role="status" className="student-help">
          本次自评：{self[index]}
        </p>
      )}
    </div>
  );
}

function Quiz({
  data,
  editing,
  onChange,
}: {
  data: Extract<ArtifactContent, { type: "quiz" }>;
  editing: boolean;
  onChange: EditorProps["onChange"];
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);
  const update = (index: number, next: (typeof data.questions)[number]) =>
    onChange({
      ...data,
      questions: data.questions.map((item, i) => (i === index ? next : item)),
    });
  return (
    <div className="tool-content">
      {data.questions.map((question, index) => (
        <fieldset key={index} className="tool-item">
          <legend>第 {index + 1} 题</legend>
          {editing ? (
            <>
              <label>
                题目 {index + 1}
                <input
                  value={question.prompt}
                  onChange={(e) =>
                    update(index, {
                      ...question,
                      prompt: e.currentTarget.value,
                    })
                  }
                  required
                />
              </label>
              {question.choices.map((choice, i) => (
                <label key={i}>
                  选项 {i + 1}
                  <input
                    value={choice}
                    onChange={(e) =>
                      update(index, {
                        ...question,
                        choices: question.choices.map((value, j) =>
                          i === j ? e.currentTarget.value : value,
                        ),
                      })
                    }
                    required
                  />
                </label>
              ))}
              <label>
                正确选项
                <select
                  value={question.correctIndex}
                  onChange={(e) =>
                    update(index, {
                      ...question,
                      correctIndex: Number(e.currentTarget.value),
                    })
                  }
                >
                  {question.choices.map((_, i) => (
                    <option value={i} key={i}>
                      选项 {i + 1}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                解析
                <textarea
                  value={question.explanation}
                  onChange={(e) =>
                    update(index, {
                      ...question,
                      explanation: e.currentTarget.value,
                    })
                  }
                  required
                />
              </label>
            </>
          ) : (
            <>
              <p>{question.prompt}</p>
              {question.choices.map((choice, i) => (
                <label className="tool-option" key={i}>
                  <input
                    type="radio"
                    name={`quiz-question-${index}`}
                    checked={answers[index] === i}
                    disabled={checked}
                    onChange={() => setAnswers({ ...answers, [index]: i })}
                  />
                  {choice}
                </label>
              ))}
              {checked && (
                <p role="status" className="student-help">
                  {answers[index] === question.correctIndex
                    ? "答对了。"
                    : "还需复习。"}{" "}
                  {question.explanation}
                </p>
              )}
            </>
          )}
        </fieldset>
      ))}
      {!editing &&
        (checked ? (
          <button
            type="button"
            className="action-secondary"
            onClick={() => {
              setChecked(false);
              setAnswers({});
            }}
          >
            <RotateCcw size={16} aria-hidden="true" /> 再试一次
          </button>
        ) : (
          <button
            type="button"
            className="action-primary"
            disabled={Object.keys(answers).length !== data.questions.length}
            onClick={() => setChecked(true)}
          >
            提交测验
          </button>
        ))}
    </div>
  );
}
