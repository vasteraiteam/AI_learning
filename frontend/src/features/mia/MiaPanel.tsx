import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Camera,
  CheckCircle2,
  FileText,
  Link2Off,
  Mic,
  Send,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { FormEvent } from "react";
import { Link, useMatch, useSearchParams } from "react-router-dom";
import {
  approveAction,
  checkGuidedAnswer,
  createRecap,
  interruptTurn,
  startSession,
  streamTurn,
} from "../../api/client";
import type { SourceContext, TurnInput } from "../../api/contracts";
import { canGenerateStoryboard } from "../../mocks/storyboardProvider";
import { hasMockTutor } from "../../mocks/tutorSamples";
import { sourceHref } from "../learning/sourceNavigation";
import { MiaStoryboard } from "./MiaStoryboard";
import { initialMiaState, miaReducer } from "./miaReducer";
import { ReviewSuggestion } from "./ReviewSuggestion";
import { contextKey, useMiaStore } from "./store";
import "./mia.css";

type ActiveTurn = { id: string; controller: AbortController; started: boolean };
type MediaMode = "microphone" | "camera";
const sampleQuestions: Record<MediaMode, string> = {
  microphone: "为什么能在等式两边同时除以 3？",
  camera: "这张题目是 3(x − 2) = 12，可以帮我看第一步吗？",
};

const desktopQuery = "(min-width: 1024px)";
const isDesktop = () => window.matchMedia(desktopQuery).matches;
function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const sourceNames: Record<string, string> = {
  "math-7": "初中数学", "science-7": "初中科学", "english-pet": "PET 英语",
  equations: "一元一次方程", plants: "植物与光合作用", dialogue: "日常情境对话", reading: "短文主旨",
};

function sourceTitle(context: SourceContext | null) {
  if (!context) return "通用对话";
  return context.activityTitle ?? context.materialTitle ??
    (context.unitId ? sourceNames[context.unitId] : undefined) ?? sourceNames[context.courseId] ?? "带入的课程";
}

function sessionLabel(context: SourceContext | null) {
  const title = sourceTitle(context);
  if (!context) return title;
  const detail = [context.page ? `第 ${context.page} 页` : undefined, context.selectionText].filter(Boolean).join(" · ");
  return detail ? `${title} · ${detail}` : title;
}

function MiaSession({
  context,
  contexts,
  pageContext,
  open,
  docked,
  opener,
  onClose,
  onClearContext,
  onUsePageContext,
  onSwitchContext,
}: {
  context: SourceContext | null;
  contexts: (SourceContext | null)[];
  pageContext: SourceContext | null;
  open: boolean;
  docked: boolean;
  opener: HTMLElement | null;
  onClose: () => void;
  onClearContext: () => void;
  onUsePageContext: () => void;
  onSwitchContext: (context: SourceContext | null) => void;
}) {
  const titleId = useId();
  const [state, dispatch] = useReducer(miaReducer, initialMiaState);
  const [draft, setDraft] = useState("");
  const [answer, setAnswer] = useState("");
  const [media, setMedia] = useState<MediaMode | null>(null);
  const [mediaNotice, setMediaNotice] = useState("");
  const activeRef = useRef<ActiveTurn | null>(null);
  const recapRequestRef = useRef(false);
  const sessionRef = useRef<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const textInput = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const recapTitle = useRef<HTMLInputElement>(null);
  const guidedStatus = useRef<HTMLParagraphElement>(null);
  const queryClient = useQueryClient();
  const busy = Boolean(state.activeTurnId || state.pending);
  const unsupportedCourse = !hasMockTutor(context);
  const sourcePath = context && sourceHref(context, { focusSelection: true });
  const offeredContext =
    pageContext && contextKey(pageContext) !== contextKey(context)
      ? pageContext
      : null;
  const supportsGuidedAnswer =
    context?.courseId === "math-7" &&
    context.materialId === "equations-1" &&
    context.page === 2 &&
    context.selectionId === "example-02";

  const stop = useCallback(() => {
    const active = activeRef.current;
    if (!active) return;
    activeRef.current = null;
    active.controller.abort();
    dispatch({ type: "turn/stop", id: active.id });
    if (active.started) void interruptTurn(active.id).catch(() => {});
  }, []);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const closeControl = closeButton.current;
    if (docked) dialog.show();
    else dialog.showModal();
    closeControl?.focus();
    return () => {
      dialog.close();
      requestAnimationFrame(() => {
        if (document.querySelector(".mia-panel[open]")) return;
        const focused = document.activeElement;
        if (focused && focused !== document.body && focused !== opener && !dialog.contains(focused)) return;
        if (opener?.isConnected && !opener.hidden) {
          opener.focus();
          if (document.activeElement === opener) return;
        }
        const fallback = document.querySelector<HTMLButtonElement>(
          'button[aria-label="打开 Mia"]',
        );
        fallback?.focus();
      });
    };
  }, [docked, open, opener]);

  useEffect(
    () => () => {
      const active = activeRef.current;
      if (!active) return;
      activeRef.current = null;
      active.controller.abort();
      if (active.started) void interruptTurn(active.id).catch(() => {});
    },
    [],
  );

  useEffect(() => {
    if (open && state.view === "chat" && logRef.current) {
      logRef.current.scrollTop = state.messages.length ? logRef.current.scrollHeight : 0;
    }
  }, [open, state.messages, state.view, state.guidedAnswer]);

  useEffect(() => {
    if (open && state.view === "recap") recapTitle.current?.focus();
  }, [open, state.view]);

  useEffect(() => {
    if (open && state.guidedAnswer?.correct) guidedStatus.current?.focus();
  }, [open, state.guidedAnswer]);

  const close = useCallback(() => {
    stop();
    setMedia(null);
    setMediaNotice("");
    onClose();
  }, [onClose, stop]);

  useEffect(() => {
    if (!docked || !open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      close();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [close, docked, open]);

  async function ask(mode: TurnInput["mode"], message: string) {
    if (activeRef.current || recapRequestRef.current || !message.trim()) return;
    const id = crypto.randomUUID();
    const controller = new AbortController();
    const active: ActiveTurn = { id, controller, started: false };
    activeRef.current = active;
    dispatch({ type: "turn/start", id, mode, message });
    try {
      let sessionId = sessionRef.current;
      if (!sessionId) {
        const session = await startSession(context);
        if (controller.signal.aborted) return;
        sessionId = session.id;
        sessionRef.current = sessionId;
      }
      active.started = true;
      const text = await streamTurn(
        sessionId,
        { clientTurnId: id, message, mode, context },
        controller.signal,
        (value) => {
          dispatch({ type: "turn/delta", id, text: value });
        },
      );
      dispatch({ type: "turn/complete", id, text });
    } catch {
      if (!controller.signal.aborted) dispatch({ type: "turn/fail", id });
    } finally {
      if (activeRef.current === active) activeRef.current = null;
    }
  }

  async function showRecap() {
    if (activeRef.current || recapRequestRef.current) return;
    if (state.recap) {
      dispatch({ type: "recap/show" });
      return;
    }
    const sessionId = sessionRef.current;
    if (!sessionId) return;
    recapRequestRef.current = true;
    dispatch({ type: "recap/request" });
    try {
      dispatch({
        type: "recap/ready",
        recap: await createRecap(sessionId, context),
      });
    } catch {
      dispatch({ type: "request/fail", message: "暂时无法生成复盘，请重试。" });
    } finally {
      recapRequestRef.current = false;
    }
  }

  async function saveRecap(event: FormEvent) {
    event.preventDefault();
    if (!state.recap || state.receipt || recapRequestRef.current) return;
    const title = state.recap.title.trim();
    const body = state.recap.body.trim();
    if (!title || !body) return;
    recapRequestRef.current = true;
    dispatch({ type: "recap/save" });
    try {
      const receipt = await approveAction(state.recap.actionId, {
        title,
        body,
      });
      dispatch({ type: "recap/saved", receipt });
      void queryClient.invalidateQueries({ queryKey: ["space"] });
      void queryClient.invalidateQueries({ queryKey: ["growth"] });
    } catch {
      dispatch({ type: "request/fail", message: "未能保存复盘，请重试。" });
    } finally {
      recapRequestRef.current = false;
    }
  }

  async function checkAnswer(event: FormEvent) {
    event.preventDefault();
    const sessionId = sessionRef.current;
    const value = answer.trim();
    if (
      !sessionId ||
      !value ||
      activeRef.current ||
      recapRequestRef.current ||
      state.guidedAnswer?.correct
    )
      return;
    recapRequestRef.current = true;
    dispatch({ type: "guided/request" });
    try {
      const result = await checkGuidedAnswer(sessionId, value);
      dispatch({ type: "guided/ready", result });
      if (result.evidence)
        void queryClient.invalidateQueries({ queryKey: ["growth"] });
    } catch {
      dispatch({ type: "request/fail", message: "暂时无法核对答案，请重试。" });
    } finally {
      recapRequestRef.current = false;
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    setDraft("");
    setMediaNotice("");
    void ask("reply", message);
  };

  const sampleMedia = () => {
    if (!media) return;
    setDraft(sampleQuestions[media]);
    setMediaNotice(
      media === "microphone" ? "模拟语音已转成文字。" : "已填入模拟拍题内容。",
    );
    setMedia(null);
    textInput.current?.focus();
  };

  return (
    <dialog
      className={`mia-panel${docked ? " mia-panel--docked" : ""}`}
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header className="mia-panel__header">
        <span className="mia-panel__mark">
          <Sparkles size={18} aria-hidden="true" />
        </span>
        <div className="mia-panel__identity">
          <h2 id={titleId}>Mia</h2>
          <p>AI 学习伙伴</p>
        </div>
        <span className="mia-panel__demo">模拟演示</span>
        <button
          className="mia-icon-button"
          type="button"
          ref={closeButton}
          aria-label="关闭 Mia"
          title="关闭 Mia"
          onClick={close}
        >
          <X size={20} />
        </button>
      </header>

      {contexts.length > 1 && (
        <label className="mia-session-picker">
          <span>辅导会话</span>
          <select aria-label="切换辅导会话" value={contextKey(context)} onChange={(event) => {
            const next = contexts.find((entry) => contextKey(entry) === event.target.value);
            if (next !== undefined) onSwitchContext(next);
          }}>
            {contexts.map((item) => <option key={contextKey(item)} value={contextKey(item)}>{sessionLabel(item)}</option>)}
          </select>
        </label>
      )}

      {context && (
        <div className="mia-panel__source" aria-label="学习上下文">
          <FileText className="mia-source-icon" size={16} aria-hidden="true" />
          <div className="mia-source-copy">
            <p>{sourceTitle(context)}</p>
            {(context.page || context.selectionText || context.activityPrompt) && (
              <span>
                {context.page ? `第 ${context.page} 页` : ""}
                {context.page && context.selectionText ? " · " : ""}
                {context.selectionText ?? context.activityPrompt}
              </span>
            )}
          </div>
          <button
            type="button"
            className="mia-icon-button mia-source-clear"
            aria-label="清除带入的学习上下文"
            title="切换到通用对话"
            disabled={busy}
            onClick={onClearContext}
          >
            <Link2Off size={16} aria-hidden="true" />
          </button>
          {sourcePath && (
            <Link
              className="mia-source-link"
              to={sourcePath}
              onClick={docked ? undefined : close}
            >
              <BookOpen size={14} aria-hidden="true" />
              {context.materialId || context.activityId ? "回到题目" : "回到课程"}
            </Link>
          )}
        </div>
      )}
      {offeredContext && (
        <div className="mia-switch-context">
          <span>
            {offeredContext.selectionText ?? (offeredContext.page
              ? `资料第 ${offeredContext.page} 页` : sourceTitle(offeredContext))}
          </span>
          <button
            type="button"
            className="mia-source-link"
            disabled={busy}
            onClick={onUsePageContext}
          >
            {offeredContext.selectionId || offeredContext.activityId ? "使用当前选题" : offeredContext.page ? "使用当前页" : "使用当前来源"}
          </button>
        </div>
      )}

      {state.view === "chat" ? (
        <>
          <div className="mia-panel__conversation" ref={logRef}>
            <div className="mia-intro">
              <p>
                {unsupportedCourse
                  ? "这门课程没有模拟辅导。"
                  : context?.selectionText
                    ? "我们一起看看这道题。你想先从哪一步开始？"
                    : "你好，今天想和我一起学什么？"}
              </p>
              {!state.hasCompletedHint &&
                !state.activeTurnId &&
                (!state.completedTurns || supportsGuidedAnswer) && (
                  <button
                    type="button"
                    className="action-primary mia-start"
                    onClick={() =>
                      void ask(
                        "hint",
                        context?.selectionText ?? context?.activityPrompt ?? "请给我分步提示",
                      )
                    }
                  >
                    <Sparkles size={15} aria-hidden="true" />
                    开始分步辅导
                  </button>
                )}
            </div>
            {context && canGenerateStoryboard(context) && (
              <MiaStoryboard source={context} onNavigate={close} />
            )}
            <div className="mia-message-list" aria-label="辅导对话">
              {state.messages.map((message) => (
                <div
                  className={`mia-message mia-message--${message.role}`}
                  key={message.id}
                >
                  <p className="mia-message__speaker">
                    {message.role === "mia" ? "Mia" : "我"}
                  </p>
                  {message.text && (
                    <p className="mia-message__text">{message.text}</p>
                  )}
                  {message.id === state.activeTurnId && !message.text && (
                    <p className="mia-message__status">Mia 正在思考…</p>
                  )}
                  {message.stopped && (
                    <p className="mia-message__status">已停止当前回复</p>
                  )}
                </div>
              ))}
            </div>
            {supportsGuidedAnswer && state.hasCompletedHint && (
              <div className="mia-guided-answer">
                {!state.guidedAnswer?.correct && (
                  <form
                    className="mia-guided-answer__form"
                    onSubmit={(event) => void checkAnswer(event)}
                  >
                    <label>
                      <span>辅导答案</span>
                      <input
                        value={answer}
                        onChange={(event) => setAnswer(event.target.value)}
                        type="text"
                        maxLength={32}
                        placeholder="x = …"
                        disabled={busy}
                      />
                    </label>
                    <button
                      className="action-secondary"
                      type="submit"
                      disabled={busy || !answer.trim()}
                    >
                      {state.pending === "guided" ? "核对中…" : "核对辅导答案"}
                    </button>
                  </form>
                )}
                {state.guidedAnswer && (
                  <p
                    className={`mia-guided-answer__result${state.guidedAnswer.correct ? " is-correct" : ""}`}
                    role="status"
                    ref={guidedStatus}
                    tabIndex={-1}
                  >
                    {state.guidedAnswer.message}
                    {state.guidedAnswer.correct &&
                      state.guidedAnswer.evidence && (
                        <span>已记录：在提示下完成</span>
                      )}
                  </p>
                )}
              </div>
            )}
            <span className="sr-only" role="status">
              {state.activeTurnId
                ? "Mia 正在回复"
                : state.completedTurns
                  ? "Mia 回复已完成"
                  : ""}
            </span>
          </div>
          <div className="mia-panel__footer">
            {state.error && (
              <p className="mia-error" role="alert">
                {state.error}
              </p>
            )}
            <div className="mia-panel__actions">
              {state.activeTurnId ? (
                <button
                  type="button"
                  className="action-secondary"
                  onClick={stop}
                >
                  <Square size={14} aria-hidden="true" />
                  停止回复
                </button>
              ) : (
                state.completedTurns > 0 &&
                !unsupportedCourse && (
                  <>
                    <button
                      type="button"
                      className="action-secondary"
                      disabled={busy}
                      onClick={() =>
                        void ask("practice", "请给我一道同类变式题。")
                      }
                    >
                      练习变式题
                    </button>
                    <button
                      type="button"
                      className="action-secondary"
                      disabled={busy}
                      onClick={() => void showRecap()}
                    >
                      {state.pending === "recap" ? "正在生成复盘…" : "查看复盘"}
                      <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  </>
                )
              )}
            </div>
            {media && (
              <div className="mia-media">
                <p>{media === "microphone" ? "模拟语音输入" : "模拟拍题"}</p>
                <button
                  type="button"
                  className="action-secondary"
                  onClick={() => {
                    setMedia(null);
                    setMediaNotice("模拟权限已拒绝，仍可输入文字。");
                    textInput.current?.focus();
                  }}
                >
                  模拟拒绝
                </button>
                <button
                  type="button"
                  className="action-secondary"
                  onClick={sampleMedia}
                >
                  填入演示内容
                </button>
              </div>
            )}
            {mediaNotice && (
              <p className="mia-media-notice" role="status">
                {mediaNotice}
              </p>
            )}
            <form className="mia-composer" onSubmit={submit}>
              <input
                ref={textInput}
                aria-label="输入你的问题"
                placeholder="输入你的问题…"
                maxLength={500}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button
                type="button"
                className="mia-icon-button"
                aria-label="模拟语音输入"
                aria-expanded={media === "microphone"}
                title="模拟语音输入"
                onClick={() => {
                  setMedia(media === "microphone" ? null : "microphone");
                  setMediaNotice("");
                }}
              >
                <Mic size={17} />
              </button>
              <button
                type="button"
                className="mia-icon-button"
                aria-label="模拟拍题"
                aria-expanded={media === "camera"}
                title="模拟拍题"
                onClick={() => {
                  setMedia(media === "camera" ? null : "camera");
                  setMediaNotice("");
                }}
              >
                <Camera size={17} />
              </button>
              <button
                type="submit"
                className="mia-icon-button mia-send"
                aria-label="发送"
                title="发送"
                disabled={!draft.trim() || busy}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </>
      ) : (
        <div className="mia-panel__recap">
          <button
            type="button"
            className="mia-recap-back"
            disabled={busy}
            onClick={() => dispatch({ type: "chat/show" })}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            返回辅导
          </button>
          <h3>本次学习复盘</h3>
          {state.receipt ? (
            <>
              <div className="mia-receipt" role="status">
                <CheckCircle2 size={21} aria-hidden="true" />
                <div>
                  <p>已保存到空间</p>
                  <span>{state.receipt.title}</span>
                  <Link
                    to={`/space?artifact=${encodeURIComponent(state.receipt.id)}`}
                    onClick={close}
                  >
                    前往空间 <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </div>
              <ReviewSuggestion
                artifactId={state.receipt.id}
                showTodayLink
                onNavigateToday={close}
              />
            </>
          ) : (
            state.recap && (
              <form
                className="mia-recap-form"
                onSubmit={(event) => void saveRecap(event)}
              >
                <label>
                  复盘标题
                  <input
                    ref={recapTitle}
                    required
                    maxLength={100}
                    value={state.recap.title}
                    disabled={busy}
                    onChange={(event) =>
                      dispatch({
                        type: "recap/edit",
                        field: "title",
                        value: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  复盘内容
                  <textarea
                    required
                    maxLength={3000}
                    rows={9}
                    value={state.recap.body}
                    disabled={busy}
                    onChange={(event) =>
                      dispatch({
                        type: "recap/edit",
                        field: "body",
                        value: event.target.value,
                      })
                    }
                  />
                </label>
                {state.error && (
                  <p className="mia-error" role="alert">
                    {state.error}
                  </p>
                )}
                <button
                  className="action-primary"
                  type="submit"
                  disabled={
                    busy ||
                    !state.recap.title.trim() ||
                    !state.recap.body.trim()
                  }
                >
                  {state.pending === "save" ? "正在保存…" : "确认保存"}
                </button>
              </form>
            )
          )}
        </div>
      )}
    </dialog>
  );
}

export function MiaPanel() {
  const open = useMiaStore((state) => state.open);
  const opener = useMiaStore((state) => state.opener);
  const context = useMiaStore((state) => state.context);
  const contexts = useMiaStore((state) => state.contexts);
  const pageContext = useMiaStore((state) => state.pageContext);
  const setOpen = useMiaStore((state) => state.setOpen);
  const setContext = useMiaStore((state) => state.setContext);
  const materialRoute = useMatch("/courses/:courseId/materials/:materialId");
  const [params] = useSearchParams();
  const independent = Boolean(materialRoute && params.has("reviewTask"));
  const desktop = useSyncExternalStore(
    subscribeDesktop,
    isDesktop,
    () => false,
  );
  const close = useCallback(() => setOpen(false), [setOpen]);
  useEffect(() => {
    if (independent && open) close();
  }, [close, independent, open]);
  return contexts.map((item) => (
    <MiaSession
      key={contextKey(item)}
      context={item}
      contexts={contexts}
      pageContext={pageContext}
      open={open && !independent && contextKey(context) === contextKey(item)}
      docked={Boolean(materialRoute && desktop)}
      opener={opener}
      onClose={close}
      onClearContext={() => setContext(null)}
      onUsePageContext={() => pageContext && setContext(pageContext)}
      onSwitchContext={setContext}
    />
  ));
}
