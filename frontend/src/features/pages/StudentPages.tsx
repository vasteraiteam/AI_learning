import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Compass,
  Eye,
  EyeOff,
  FileText,
  FolderOpen,
  GraduationCap,
  Layers,
  Mic,
  Network,
  Plus,
  ScanText,
  SlidersHorizontal,
  Sparkles,
  Target,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  getCourse,
  getCourses,
  getGrowth,
  getSpace,
  getToday,
  rescheduleReviewTask,
  updateTask,
} from "../../api/client";
import type {
  Artifact,
  Course,
  Evidence,
  SourceContext,
  Task,
} from "../../api/contracts";
import { ReviewSuggestion } from "../mia/ReviewSuggestion";
import { useMiaStore } from "../mia/store";
import { CourseExercise } from "../courses/CourseExercise";
import {
  activitySource,
  currentUnit,
  getUnitLearning,
  type CourseActivity,
} from "../courses/activities";
import {
  readResume,
  recordResume,
  sourceHref,
} from "../learning/sourceNavigation";
import { ArtifactContentView } from "../tools/ArtifactContentView";
import { ToolWorkbench } from "../tools/ToolWorkbench";
import "./pages.css";
import "./records.css";

type Tone = "violet" | "blue" | "green" | "amber";

function IconBox({
  icon: Icon,
  tone = "violet",
}: {
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <span aria-hidden="true" className="student-icon" data-tone={tone}>
      <Icon size={19} strokeWidth={1.85} />
    </span>
  );
}

function Pill({ children, tone }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className="student-pill" data-tone={tone}>
      {children}
    </span>
  );
}

function Heading({
  title,
  subtitle,
  eyebrow,
  action,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <header className="student-heading">
      <div>
        {eyebrow ? <p className="student-eyebrow">{eyebrow}</p> : null}
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="student-section">
      <div className="student-section__head">
        <h2>{title}</h2>
        {meta ? <div className="student-section__meta">{meta}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Message({
  children,
  retry,
}: {
  children: ReactNode;
  retry?: () => void;
}) {
  return (
    <div className="student-message" role="status">
      {children}
      {retry ? (
        <button className="action-secondary" type="button" onClick={retry}>
          重试
        </button>
      ) : null}
    </div>
  );
}

function useOpenMia() {
  const setContext = useMiaStore((store) => store.setContext);
  const setOpen = useMiaStore((store) => store.setOpen);
  return (context?: SourceContext) => {
    if (context) setContext(context);
    setOpen(true);
  };
}

function coursePath(courseId: string) {
  return `/courses/${encodeURIComponent(courseId)}`;
}

function materialPath(courseId: string, materialId: string) {
  return `${coursePath(courseId)}/materials/${encodeURIComponent(materialId)}`;
}

function sourcePath(source: SourceContext, reviewTaskId?: string) {
  return sourceHref(source, { reviewTaskId, focusSelection: !reviewTaskId });
}

function sourceLabel(source: SourceContext) {
  if (!source.materialId) return source.activityTitle ?? "查看关联课程";
  const page = source.page ? ` · 第 ${source.page} 页` : "";
  return `${source.materialTitle ?? "查看资料"}${page}`;
}

function reviewDateLabel(dateOnly: string) {
  const date = new Date(`${dateOnly}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? dateOnly
    : new Intl.DateTimeFormat("zh-CN", {
        year:
          date.getFullYear() === new Date().getFullYear()
            ? undefined
            : "numeric",
        month: "long",
        day: "numeric",
      }).format(date);
}

const taskStatuses = {
  today: { label: "今日到期", tone: "violet" },
  upcoming: { label: "即将到期", tone: "blue" },
  overdue: { label: "已逾期", tone: "amber" },
  unscheduled: { label: "未安排日期", tone: undefined },
  completed: { label: "已完成", tone: "green" },
} as const;

function calendarDate(date: Date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");
}

function getTaskStatus(task: Task, today: string): keyof typeof taskStatuses {
  if (task.completed) return "completed";
  if (!task.dueDate) return "unscheduled";
  if (task.dueDate < today) return "overdue";
  return task.dueDate === today ? "today" : "upcoming";
}

function TaskTiming({ task, today }: { task: Task; today: string }) {
  const status = taskStatuses[getTaskStatus(task, today)];
  return (
    <span className="student-task-timing">
      <Pill tone={status.tone}>{status.label}</Pill>
      {task.dueDate ? (
        <time dateTime={task.dueDate}>{reviewDateLabel(task.dueDate)}</time>
      ) : null}
    </span>
  );
}

function updateSearchParam(
  params: URLSearchParams,
  key: string,
  value?: string,
) {
  const next = new URLSearchParams(params);
  if (value) next.set(key, value);
  else next.delete(key);
  return next;
}

function TaskDetail({
  task,
  today,
  onClose,
}: {
  task: Task;
  today: string;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const heading = useRef<HTMLHeadingElement>(null);
  const [dueDate, setDueDate] = useState(task.dueDate ?? today);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const reschedule = useMutation({
    mutationFn: () => rescheduleReviewTask(task.id, dueDate),
    onSuccess: (updated) => {
      client.setQueryData<Awaited<ReturnType<typeof getToday>>>(
        ["today"],
        (old) =>
          old
            ? {
                ...old,
                tasks: old.tasks.map((item) =>
                  item.id === task.id ? updated : item,
                ),
              }
            : old,
      );
      void client.invalidateQueries({ queryKey: ["review-practice", task.id] });
      void client.invalidateQueries({ queryKey: ["review-proposal"] });
    },
  });
  const source =
    task.source ?? (task.courseId ? { courseId: task.courseId } : undefined);

  return (
    <section className="student-record-detail" aria-label="任务详情">
      <div className="student-record-detail__head">
        <div>
          <p className="student-eyebrow">
            {task.reviewProposalId ? "复习任务" : "学习任务"}
          </p>
          <h3 ref={heading} tabIndex={-1}>
            {task.title}
          </h3>
        </div>
        <button
          className="student-icon-button"
          type="button"
          onClick={onClose}
          aria-label="关闭任务详情"
          title="关闭详情"
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>
      <TaskTiming task={task} today={today} />
      {source ? (
        <Link
          className="student-inline-link"
          to={sourcePath(source, task.reviewProposalId ? task.id : undefined)}
        >
          <BookOpen size={16} aria-hidden="true" /> {sourceLabel(source)}{" "}
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      ) : null}
      {task.reviewProposalId && !task.completed ? (
        <form
          className="student-record-date"
          onSubmit={(event) => {
            event.preventDefault();
            if (dueDate && dueDate !== task.dueDate) reschedule.mutate();
          }}
        >
          <label htmlFor="student-review-reschedule">调整复习日期</label>
          <div>
            <input
              id="student-review-reschedule"
              type="date"
              value={dueDate}
              required
              disabled={reschedule.isPending}
              onChange={(event) => {
                setDueDate(event.currentTarget.value);
                if (reschedule.isSuccess || reschedule.isError)
                  reschedule.reset();
              }}
            />
            <button
              className="action-secondary"
              type="submit"
              disabled={
                reschedule.isPending || !dueDate || dueDate === task.dueDate
              }
            >
              <CalendarDays size={16} aria-hidden="true" />{" "}
              {reschedule.isPending ? "正在保存…" : "保存日期"}
            </button>
          </div>
          {reschedule.isSuccess ? (
            <p className="student-help" role="status">
              复习日期已更新。
            </p>
          ) : null}
          {reschedule.isError ? (
            <p className="student-error" role="alert">
              未能更新日期，请重试。
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}

export function TodayPage() {
  const today = useQuery({ queryKey: ["today"], queryFn: getToday });
  const client = useQueryClient();
  const openMia = useOpenMia();
  const [params, setParams] = useSearchParams();
  const [dismissed, setDismissed] = useState(false);
  const completion = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      updateTask(id, completed),
    onSuccess: (task) => {
      client.setQueryData<Awaited<ReturnType<typeof getToday>>>(
        ["today"],
        (old) =>
          old
            ? {
                ...old,
                tasks: old.tasks.map((item) =>
                  item.id === task.id ? task : item,
                ),
              }
            : old,
      );
    },
  });
  const tasks = today.data?.tasks ?? [];
  const resume = today.data?.continueCourse;
  const lastSource = readResume();
  const lastCourseId = lastSource?.courseId;
  const resumeCourse = useQuery({
    queryKey: ["course", lastCourseId],
    queryFn: () => getCourse(lastCourseId ?? ""),
    enabled: Boolean(lastCourseId && lastCourseId !== resume?.id),
  });
  const resumeContextCourse =
    !lastCourseId || lastCourseId === resume?.id ? resume : resumeCourse.data;
  const resumeContextUnit = lastSource?.unitId
    ? resumeContextCourse?.units.find((unit) => unit.id === lastSource.unitId)
    : undefined;
  const resumeTitle =
    lastSource?.activityTitle ??
    lastSource?.materialTitle ??
    resumeContextUnit?.title ??
    resumeContextCourse?.currentUnit ??
    "上次的学习位置";
  const resumeCourseTitle = resumeContextCourse?.title;
  const resumeDetails = [
    resumeCourseTitle,
    lastSource?.page ? `第 ${lastSource.page} 页` : null,
    lastSource?.selectionText,
  ]
    .filter(Boolean)
    .join(" · ");
  const suggestion = dismissed ? null : today.data?.suggestion;
  const done = tasks.filter((task) => task.completed).length;
  const now = new Date();
  const day = calendarDate(now);
  const statusFilter = params.get("status");
  const activeFilter =
    statusFilter && Object.hasOwn(taskStatuses, statusFilter)
      ? statusFilter
      : null;
  const visibleTasks = activeFilter
    ? tasks.filter((task) => getTaskStatus(task, day) === activeFilter)
    : tasks;
  const selectedTaskId = params.get("task");
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const dateLabel = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(now);

  return (
    <div className="page-content student-page">
      <Heading
        title="今天学什么？"
        subtitle="从一个小目标开始。"
        eyebrow={dateLabel}
      />
      {today.isPending ? <Message>正在打开今日计划…</Message> : null}
      {today.isError ? (
        <Message retry={() => void today.refetch()}>
          暂时无法读取今日计划。
        </Message>
      ) : null}
      {today.isSuccess ? (
        <>
          <div className="student-today-intro">
            {resume ? (
              <section className="student-resume" aria-label="继续学习">
                <Pill tone="violet">
                  <BookOpen size={12} aria-hidden="true" /> 继续学习
                </Pill>
                <h2>{resumeTitle}</h2>
                {lastSource ? (
                  resumeDetails ? (
                    <p className="student-resume-location">{resumeDetails}</p>
                  ) : null
                ) : (
                  <p>
                    {resume.title} · 已完成 {resume.progress}%
                  </p>
                )}
                <Link
                  className="action-primary"
                  to={
                    lastSource ? sourcePath(lastSource) : coursePath(resume.id)
                  }
                >
                  接着学 <ArrowRight size={15} aria-hidden="true" />
                </Link>
                {!lastSource && resume.id === "math-7" ? (
                  <div className="student-resume__motif" aria-hidden="true">
                    2( x − 1 ) = 3x − 5
                  </div>
                ) : null}
              </section>
            ) : null}
            {suggestion ? (
              <section
                className="surface-card student-suggestion"
                aria-label="Mia 建议"
              >
                <button
                  type="button"
                  className="student-icon-button"
                  aria-label="忽略这条 Mia 建议"
                  title="忽略建议"
                  onClick={() => setDismissed(true)}
                >
                  <X size={16} aria-hidden="true" />
                </button>
                <span className="student-suggestion-label">
                  <Sparkles size={15} aria-hidden="true" /> Mia 的建议
                </span>
                <h2>{suggestion.title}</h2>
                <p>{suggestion.body}</p>
                <button
                  type="button"
                  className="student-inline-link"
                  onClick={() => openMia({ courseId: suggestion.courseId })}
                >
                  和 Mia 聊聊 <ArrowRight size={14} aria-hidden="true" />
                </button>
              </section>
            ) : null}
          </div>
          <Section title="今日事项" meta={`已完成 ${done} / ${tasks.length}`}>
            {tasks.length ? (
              <div
                className="student-filter"
                role="group"
                aria-label="任务状态筛选"
              >
                <button
                  type="button"
                  aria-pressed={activeFilter === null}
                  onClick={() =>
                    setParams(updateSearchParam(params, "status"), {
                      replace: true,
                    })
                  }
                >
                  全部
                </button>
                {Object.entries(taskStatuses).map(([id, status]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={activeFilter === id}
                    onClick={() =>
                      setParams(updateSearchParam(params, "status", id), {
                        replace: true,
                      })
                    }
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            ) : null}
            {selectedTask ? (
              <TaskDetail
                key={selectedTask.id}
                task={selectedTask}
                today={day}
                onClose={() =>
                  setParams(updateSearchParam(params, "task"), {
                    replace: true,
                  })
                }
              />
            ) : selectedTaskId ? (
              <Message>找不到这项任务。</Message>
            ) : null}
            {visibleTasks.length ? (
              <div className="surface-card student-today-list">
                {visibleTasks.map((task) => {
                  const isReview = Boolean(task.reviewProposalId);
                  const StatusIcon = task.completed ? Check : CalendarDays;
                  return (
                    <div
                      className={`student-task${isReview ? " student-review-task" : ""}`}
                      key={task.id}
                    >
                      {isReview ? (
                        <span
                          className="student-review-task__icon"
                          aria-hidden="true"
                        >
                          <StatusIcon size={16} />
                        </span>
                      ) : (
                        <input
                          id={`student-task-${task.id}`}
                          type="checkbox"
                          checked={task.completed}
                          aria-labelledby={`student-task-title-${task.id}`}
                          disabled={completion.isPending}
                          onChange={(event) =>
                            completion.mutate({
                              id: task.id,
                              completed: event.currentTarget.checked,
                            })
                          }
                        />
                      )}
                      <div className="student-task__label">
                        {isReview ? (
                          <strong>{task.title}</strong>
                        ) : (
                          <label
                            htmlFor={`student-task-${task.id}`}
                            id={`student-task-title-${task.id}`}
                          >
                            <strong>{task.title}</strong>
                          </label>
                        )}
                        <TaskTiming task={task} today={day} />
                      </div>
                      <div className="student-record-actions student-task-actions">
                        {isReview && task.source ? (
                          <Link
                            className="student-inline-link student-review-task__action"
                            to={sourcePath(task.source, task.id)}
                          >
                            {task.completed ? "查看复习" : "开始复习"}{" "}
                            <ChevronRight size={15} aria-hidden="true" />
                          </Link>
                        ) : task.courseId ? (
                          <Link
                            className="student-icon-button"
                            to={coursePath(task.courseId)}
                            aria-label={`打开课程：${task.title}`}
                            title="打开课程"
                          >
                            <BookOpen size={16} aria-hidden="true" />
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          className="student-icon-button"
                          aria-label={`任务详情：${task.title}`}
                          title="任务详情"
                          aria-expanded={selectedTask?.id === task.id}
                          onClick={() =>
                            setParams(
                              updateSearchParam(
                                params,
                                "task",
                                selectedTask?.id === task.id
                                  ? undefined
                                  : task.id,
                              ),
                              { replace: true },
                            )
                          }
                        >
                          <Eye size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Message>
                {tasks.length ? "这个状态暂时没有任务。" : "现在没有待办事项。"}
              </Message>
            )}
            {completion.isError ? (
              <p className="student-error" role="alert">
                没有更新成功，请重新勾选。
              </p>
            ) : null}
          </Section>
        </>
      ) : null}
      <Section title="快速开始">
        <div className="student-action-grid">
          <button
            className="surface-card student-card-link student-action-tile"
            type="button"
            onClick={() => openMia()}
          >
            <IconBox icon={Sparkles} />
            <span>问 Mia</span>
          </button>
          <Link
            className="surface-card student-card-link student-action-tile"
            to="/tools?tool=photo"
          >
            <IconBox icon={Camera} tone="blue" />
            <span>拍题</span>
          </Link>
          <Link
            className="surface-card student-card-link student-action-tile"
            to="/courses"
          >
            <IconBox icon={BookOpen} tone="green" />
            <span>看课程</span>
          </Link>
          <Link
            className="surface-card student-card-link student-action-tile"
            to="/space"
          >
            <IconBox icon={FolderOpen} tone="amber" />
            <span>找资料</span>
          </Link>
        </div>
      </Section>
    </div>
  );
}

function courseTone(index: number): Tone {
  const tones: Tone[] = ["violet", "blue", "green", "amber"];
  return tones[index % tones.length];
}

function Progress({ value, title }: { value: number; title: string }) {
  return (
    <div className="student-progress">
      <progress max={100} value={value} aria-label={`${title}进度`} />
      <span>已完成 {value}%</span>
    </div>
  );
}

export function CoursesPage() {
  const courses = useQuery({ queryKey: ["courses"], queryFn: getCourses });
  return (
    <div className="page-content student-page">
      <Heading title="课程" subtitle="学习路径、资料和练习，都从这里继续。" />
      {courses.isPending ? <Message>正在读取课程…</Message> : null}
      {courses.isError ? (
        <Message retry={() => void courses.refetch()}>
          暂时无法读取课程。
        </Message>
      ) : null}
      {courses.isSuccess ? (
        <Section title="我的课程" meta={`${courses.data.length} 门`}>
          {courses.data.length ? (
            <div className="student-card-grid">
              {courses.data.map((course, index) => (
                <Link
                  className="surface-card student-card-link student-course-card"
                  key={course.id}
                  to={coursePath(course.id)}
                >
                  <div className="student-card-top">
                    <IconBox icon={BookOpen} tone={courseTone(index)} />
                    <Pill>{course.subject}</Pill>
                  </div>
                  <h2>{course.title}</h2>
                  <p className="student-help">{course.description}</p>
                  <div className="student-card-top student-help">
                    <span>{course.currentUnit}</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </div>
                  <Progress value={course.progress} title={course.title} />
                </Link>
              ))}
            </div>
          ) : (
            <Message>还没有课程。</Message>
          )}
        </Section>
      ) : null}
    </div>
  );
}

const courseTabs = [
  { id: "path", label: "学习路径" },
  { id: "materials", label: "材料" },
  { id: "practice", label: "练习" },
  { id: "tutor", label: "Tutor" },
  { id: "world", label: "学习世界" },
] as const;

type CourseTab = (typeof courseTabs)[number]["id"];

function CoursePath({ course }: { course: Course }) {
  const labels = { done: "已完成", current: "正在学习", next: "待学习" };
  return (
    <Section title="知识点与进度" meta={`已完成 ${course.progress}%`}>
      <div className="student-stack">
        {course.units.map((unit) => (
          <div className="surface-card student-row" key={unit.id}>
            <IconBox
              icon={
                unit.status === "done"
                  ? Check
                  : unit.status === "current"
                    ? Target
                    : BookOpen
              }
              tone={
                unit.status === "done"
                  ? "green"
                  : unit.status === "next"
                    ? "blue"
                    : "violet"
              }
            />
            <span className="student-row__copy">
              <strong>{unit.title}</strong>
              <small>{labels[unit.status]}</small>
            </span>
            {getUnitLearning(course.id, unit.id) ? (
              <Link
                className="student-inline-link"
                to={sourceHref({ courseId: course.id, unitId: unit.id })}
              >
                进入单元 <ArrowRight size={14} aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </Section>
  );
}

function CourseMaterials({ course }: { course: Course }) {
  return (
    <Section title="课程材料" meta={`${course.materials.length} 份`}>
      {course.materials.length ? (
        <div className="student-stack">
          {course.materials.map((material) => (
            <Link
              className="surface-card student-card-link student-row"
              to={materialPath(course.id, material.id)}
              key={material.id}
            >
              <IconBox icon={FileText} tone="blue" />
              <span className="student-row__copy">
                <strong>{material.title}</strong>
                <small>{material.description}</small>
              </span>
              <Pill>共 {material.pages} 页</Pill>
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          ))}
        </div>
      ) : (
        <Message>这一门课还没有材料。</Message>
      )}
    </Section>
  );
}

function useCourseActivityContext(
  courseId: string,
  unitId: string | undefined,
  activity?: CourseActivity,
) {
  const setPageContext = useMiaStore((state) => state.setPageContext);
  useEffect(() => {
    if (!unitId) return;
    const source = activity
      ? activitySource(courseId, unitId, activity)
      : { courseId, unitId };
    setPageContext(source);
    recordResume(source);
    return () => setPageContext(null);
  }, [activity, courseId, setPageContext, unitId]);
}

function CoursePractice({
  course,
  unitId,
  activity,
  world = false,
}: {
  course: Course;
  unitId?: string;
  activity?: CourseActivity;
  world?: boolean;
}) {
  const openMia = useOpenMia();
  if (!activity || !unitId) {
    return (
      <Message>
        {world ? "这一门课还没有学习世界。" : "这一门课还没有演示练习。"}
      </Message>
    );
  }
  return (
    <CourseExercise
      key={activity.id}
      activity={activity}
      onAsk={() => openMia(activitySource(course.id, unitId, activity))}
    />
  );
}

export function CourseUnitPage() {
  const { courseId = "", unitId = "" } = useParams();
  const [params] = useSearchParams();
  const course = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => getCourse(courseId),
    enabled: Boolean(courseId),
  });
  const openMia = useOpenMia();
  const learning = getUnitLearning(courseId, unitId);
  const unit = course.data?.units.find((item) => item.id === unitId);
  const materials =
    course.data?.materials.filter((material) =>
      learning?.materialIds?.includes(material.id),
    ) ?? [];
  const source = { courseId, unitId };
  const practiceSource =
    learning && activitySource(courseId, unitId, learning.practice);
  const worldSource =
    learning?.world && activitySource(courseId, unitId, learning.world);
  const tab = params.get("tab");
  const activity =
    tab === "practice"
      ? learning?.practice
      : tab === "world"
        ? learning?.world
        : undefined;
  useCourseActivityContext(
    courseId,
    unit && learning ? unitId : undefined,
    activity,
  );

  return (
    <div className="page-content student-page course-unit">
      <Link className="student-inline-link" to={coursePath(courseId)}>
        <ArrowLeft size={15} aria-hidden="true" /> 返回课程
      </Link>
      {course.isPending ? <Message>正在打开单元…</Message> : null}
      {course.isError ? (
        <Message retry={() => void course.refetch()}>
          暂时无法打开单元。
        </Message>
      ) : null}
      {course.isSuccess && (!unit || !learning || !practiceSource) ? (
        <Message>这个单元还没有演示内容。</Message>
      ) : null}
      {course.isSuccess && unit && learning && practiceSource ? (
        <>
          <Heading
            title={unit.title}
            eyebrow={`${course.data.title} · 学习单元`}
            subtitle={learning.introduction}
            action={
              activity ? undefined : (
                <button
                  type="button"
                  className="action-secondary"
                  onClick={() => openMia(source)}
                >
                  <Sparkles size={16} aria-hidden="true" /> 问 Mia
                </button>
              )
            }
          />
          {activity ? (
            <>
              <CoursePractice
                course={course.data}
                unitId={unitId}
                activity={activity}
              />
              <div className="student-actions">
                <Link className="action-secondary" to={sourceHref(source)}>
                  <ArrowLeft size={15} aria-hidden="true" /> 返回单元
                </Link>
                {tab === "world" ? (
                  <Link
                    className="student-inline-link"
                    to={sourceHref(practiceSource)}
                  >
                    切回普通练习 <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="course-unit__overview">
                <Section title="学习目标">
                  <ul className="course-unit__aims">
                    {learning.aims.map((goal) => (
                      <li key={goal}>{goal}</li>
                    ))}
                  </ul>
                </Section>
                <Section title="阅读导学">
                  <div className="course-unit__reading">
                    <h3>{learning.reading.title}</h3>
                    <p className="student-help">{learning.reading.text}</p>
                    {learning.reading.example ? (
                      <p className="course-unit__example">
                        {learning.reading.example}
                      </p>
                    ) : null}
                  </div>
                </Section>
              </div>
              {materials.length ? (
                <Section title="单元材料" meta={`${materials.length} 份`}>
                  <div className="student-stack course-unit__links">
                    {materials.map((material) => (
                      <Link
                        className="surface-card student-card-link student-row"
                        key={material.id}
                        to={sourceHref({
                          ...source,
                          materialId: material.id,
                          page: 1,
                        })}
                      >
                        <IconBox icon={FileText} tone="blue" />
                        <span className="student-row__copy">
                          <strong>{material.title}</strong>
                          <small>{material.description}</small>
                        </span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                </Section>
              ) : null}
              <Section title="巩固与应用">
                <div className="student-stack course-unit__links">
                  <Link
                    className="surface-card student-card-link student-row"
                    to={sourceHref(practiceSource)}
                  >
                    <IconBox icon={Target} />
                    <span className="student-row__copy">
                      <strong>{learning.practice.title}</strong>
                      <small>{learning.practice.badge}</small>
                    </span>
                    <span className="student-inline-link">
                      开始练习 <ChevronRight size={16} aria-hidden="true" />
                    </span>
                  </Link>
                  {learning.world && worldSource ? (
                    <Link
                      className="surface-card student-card-link student-row"
                      to={sourceHref(worldSource)}
                    >
                      <IconBox icon={Compass} tone="amber" />
                      <span className="student-row__copy">
                        <strong>{learning.world.title}</strong>
                        <small>{learning.world.badge}</small>
                      </span>
                      <span className="student-inline-link">
                        学习世界 <ChevronRight size={16} aria-hidden="true" />
                      </span>
                    </Link>
                  ) : null}
                </div>
              </Section>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

export function CoursePage() {
  const { courseId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const course = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => getCourse(courseId),
    enabled: !!courseId,
  });
  const openMia = useOpenMia();
  const tab =
    courseTabs.find((item) => item.id === params.get("tab"))?.id ?? "path";
  const current = course.data ? currentUnit(course.data) : undefined;
  const learning = current ? getUnitLearning(courseId, current.id) : undefined;
  const activity =
    tab === "practice"
      ? learning?.practice
      : tab === "world"
        ? learning?.world
        : undefined;
  useCourseActivityContext(
    courseId,
    activity ? current?.id : undefined,
    activity,
  );
  function setTab(next: CourseTab) {
    setParams(next === "path" ? {} : { tab: next }, { replace: true });
  }

  return (
    <div className="page-content student-page">
      <Link className="student-inline-link" to="/courses">
        <ArrowLeft size={15} aria-hidden="true" /> 所有课程
      </Link>
      {course.isPending ? <Message>正在打开课程…</Message> : null}
      {course.isError ? (
        <Message retry={() => void course.refetch()}>
          没有打开这门课程。
        </Message>
      ) : null}
      {course.isSuccess ? (
        <>
          <Heading
            title={course.data.title}
            subtitle={course.data.description}
            eyebrow={course.data.subject}
            action={
              activity ? undefined : (
                <button
                  type="button"
                  className="action-secondary"
                  onClick={() => openMia({ courseId, unitId: current?.id })}
                >
                  <Sparkles size={16} aria-hidden="true" /> 问 Mia
                </button>
              )
            }
          />
          <nav className="student-course-tabs" aria-label="课程视图">
            {courseTabs
              .filter((item) => item.id !== "world" || learning?.world)
              .map((item) => (
                <button
                  type="button"
                  aria-pressed={tab === item.id}
                  key={item.id}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
          </nav>
          {tab === "path" ? (
            <>
              <CoursePath course={course.data} />
              <div className="student-actions">
                <Link
                  className="action-secondary"
                  to={`/space?courseId=${encodeURIComponent(courseId)}`}
                >
                  <FolderOpen size={16} aria-hidden="true" /> 课程笔记与成果
                </Link>
                <Link
                  className="action-secondary"
                  to={`/growth?courseId=${encodeURIComponent(courseId)}`}
                >
                  <Target size={16} aria-hidden="true" /> 课程成长记录
                </Link>
              </div>
            </>
          ) : null}
          {tab === "materials" ? (
            <CourseMaterials course={course.data} />
          ) : null}
          {tab === "practice" ? (
            <>
              <CoursePractice
                course={course.data}
                unitId={current?.id}
                activity={activity}
              />
              {activity && current ? (
                <Link
                  className="student-inline-link"
                  to={sourceHref({ courseId, unitId: current.id })}
                >
                  <ArrowLeft size={14} aria-hidden="true" /> 返回单元
                </Link>
              ) : null}
            </>
          ) : null}
          {tab === "world" ? (
            <>
              <CoursePractice
                course={course.data}
                unitId={current?.id}
                activity={activity}
                world
              />
              <button
                type="button"
                className="student-inline-link"
                onClick={() => setTab("practice")}
              >
                <ArrowLeft size={14} aria-hidden="true" /> 切回普通练习
              </button>
            </>
          ) : null}
          {tab === "tutor" ? (
            <section className="surface-card student-workbench">
              <IconBox icon={Sparkles} />
              <h2>和 Mia 一起学</h2>
              <p className="student-help">{course.data.currentUnit}</p>
              <div className="student-actions">
                <button
                  type="button"
                  className="action-primary"
                  onClick={() => openMia({ courseId })}
                >
                  <Sparkles size={16} aria-hidden="true" /> 进入 Tutor
                </button>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

const tools = [
  {
    id: "photo",
    title: "拍题",
    description: "核对题意，再准备下一步。",
    icon: Camera,
    tone: "blue",
  },
  {
    id: "explain",
    title: "讲解",
    description: "分步骤理解一个知识点。",
    icon: CircleHelp,
    tone: "violet",
  },
  {
    id: "summary",
    title: "摘要",
    description: "提炼材料里的核心信息。",
    icon: ScanText,
    tone: "green",
  },
  {
    id: "mindmap",
    title: "思维导图",
    description: "梳理概念之间的关系。",
    icon: Network,
    tone: "violet",
  },
  {
    id: "podcast",
    title: "播客脚本",
    description: "准备一段双人对话脚本。",
    icon: Mic,
    tone: "amber",
  },
  {
    id: "flashcards",
    title: "闪卡",
    description: "把知识点改写成问与答。",
    icon: Layers,
    tone: "blue",
  },
  {
    id: "quiz",
    title: "测验",
    description: "用自测检查理解。",
    icon: ClipboardCheck,
    tone: "green",
  },
] as const satisfies readonly {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: Tone;
}[];

type StudentTool = (typeof tools)[number];
type ToolId = StudentTool["id"];
type ToolSettings = { order: ToolId[]; hidden: ToolId[] };
const toolPreferenceKey = "ixueji.demo.tools.v1";

function findTool(id: unknown) {
  return tools.find((tool) => tool.id === id);
}

function savedToolSettings(): ToolSettings {
  const order = tools.map(({ id }) => id);
  const fallback = { order, hidden: [] };
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(toolPreferenceKey) ?? "null",
    );
    if (
      typeof saved !== "object" ||
      saved === null ||
      !("order" in saved) ||
      !("hidden" in saved)
    )
      return fallback;
    const knownIds = (items: unknown) =>
      Array.isArray(items)
        ? items.flatMap((item) => findTool(item)?.id ?? [])
        : [];
    return {
      order: [...new Set([...knownIds(saved.order), ...order])],
      hidden: [...new Set(knownIds(saved.hidden))],
    };
  } catch {
    return fallback;
  }
}

export function ToolsPage() {
  const [params, setParams] = useSearchParams();
  const [customizing, setCustomizing] = useState(false);
  const [settings, setSettings] = useState(savedToolSettings);
  const selected = findTool(params.get("tool"));
  const ordered = settings.order.map((id) => findTool(id)!);
  const visible = ordered.filter((tool) => !settings.hidden.includes(tool.id));

  function setPreferences(next: ToolSettings) {
    setSettings(next);
    try {
      localStorage.setItem(toolPreferenceKey, JSON.stringify(next));
    } catch {
      // Preferences can still be used for the current page when storage is unavailable.
    }
  }

  function select(id?: ToolId) {
    const next = new URLSearchParams(params);
    next.delete("reopen");
    if (id) next.set("tool", id);
    else next.delete("tool");
    setParams(next, { replace: true });
  }

  function move(index: number, step: number) {
    const target = index + step;
    if (target < 0 || target >= settings.order.length) return;
    const order = [...settings.order];
    [order[index], order[target]] = [order[target], order[index]];
    setPreferences({ ...settings, order });
  }

  function toggle(id: ToolId) {
    const willShow = settings.hidden.includes(id);
    const hidden = willShow
      ? settings.hidden.filter((item) => item !== id)
      : [...settings.hidden, id];
    setPreferences({ ...settings, hidden });
    if (!willShow && selected?.id === id) select();
  }

  return (
    <div className="page-content student-page">
      <Heading
        title="工具"
        subtitle="做一份讲解、闪卡或自测。"
        action={
          <button
            type="button"
            className="action-secondary"
            aria-expanded={customizing}
            onClick={() => setCustomizing(!customizing)}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />{" "}
            {customizing ? "完成编辑" : "自定义工具"}
          </button>
        }
      />
      {selected ? (
        <div hidden={customizing}>
          <ToolWorkbench key={selected.id} tool={selected} />
        </div>
      ) : null}
      {customizing ? (
        <Section title="编辑常用工具">
          {ordered.map((tool, index) => {
            const hidden = settings.hidden.includes(tool.id);
            return (
              <div className="student-tool-settings" key={tool.id}>
                <span className="student-tool-settings__name">
                  {tool.title}
                  {hidden ? <Pill>已隐藏</Pill> : null}
                </span>
                <button
                  className="student-icon-button"
                  type="button"
                  title="上移"
                  aria-label={`上移${tool.title}`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
                <button
                  className="student-icon-button"
                  type="button"
                  title="下移"
                  aria-label={`下移${tool.title}`}
                  disabled={index === ordered.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={16} aria-hidden="true" />
                </button>
                <button
                  className="student-icon-button"
                  type="button"
                  title={hidden ? "添加到常用" : "从常用隐藏"}
                  aria-label={`${hidden ? "添加" : "隐藏"}${tool.title}`}
                  onClick={() => toggle(tool.id)}
                >
                  {hidden ? (
                    <Plus size={16} aria-hidden="true" />
                  ) : (
                    <EyeOff size={16} aria-hidden="true" />
                  )}
                </button>
              </div>
            );
          })}
        </Section>
      ) : (
        <Section title="常用工具">
          {visible.length ? (
            <div className="student-tool-grid">
              {visible.map((tool) => (
                <button
                  className="surface-card student-card-link student-tool-card"
                  type="button"
                  aria-pressed={selected?.id === tool.id}
                  key={tool.id}
                  onClick={() => select(tool.id)}
                >
                  <IconBox icon={tool.icon} tone={tool.tone} />
                  <h3>{tool.title}</h3>
                  <p className="student-help">{tool.description}</p>
                </button>
              ))}
            </div>
          ) : (
            <Message>没有常用工具。</Message>
          )}
        </Section>
      )}
    </div>
  );
}

const artifactLabels: Record<Artifact["kind"], string> = {
  note: "笔记",
  recap: "辅导复盘",
  summary: "摘要",
  flashcards: "闪卡",
  quiz: "测验",
  mindmap: "思维导图",
  podcast: "播客脚本",
  storyboard: "视频分镜",
  photo: "题目记录",
  explain: "讲解",
  reflection: "反思",
};
const isNote = (artifact: Artifact) =>
  ["note", "recap", "reflection"].includes(artifact.kind);
const toolArtifactKinds = new Set<Artifact["kind"]>([
  "photo",
  "explain",
  "summary",
  "mindmap",
  "podcast",
  "flashcards",
  "quiz",
]);

function dateLabel(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date);
}

export function SpacePage() {
  const items = useQuery({ queryKey: ["space"], queryFn: getSpace });
  const courses = useQuery({ queryKey: ["courses"], queryFn: getCourses });
  const [params, setParams] = useSearchParams();
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const sourceCourse = params.get("courseId");
  const sourceParam = params.get("source");
  const sourceFilter =
    sourceParam === "linked" || sourceParam === "unlinked" ? sourceParam : "";
  const kindParam = params.get("kind");
  const kindFilter =
    kindParam && Object.hasOwn(artifactLabels, kindParam) ? kindParam : "";
  const collectionParam = params.get("collection");
  const filter =
    collectionParam === "notes" || collectionParam === "works"
      ? collectionParam
      : "all";
  const requestedId = params.get("artifact");
  useEffect(() => {
    if (requestedId && items.isSuccess) previewHeading.current?.focus();
  }, [items.isSuccess, requestedId]);
  const openMia = useOpenMia();
  const allArtifacts = items.data ?? [];
  const courseNames = new Map(
    (courses.data ?? []).map((course) => [course.id, course.title]),
  );
  const filteredCollections = allArtifacts.filter(
    (artifact) =>
      filter === "all" ||
      (filter === "notes" ? isNote(artifact) : !isNote(artifact)),
  );
  const artifacts = filteredCollections.filter(
    (artifact) =>
      (!sourceCourse || artifact.source?.courseId === sourceCourse) &&
      (!kindFilter || artifact.kind === kindFilter) &&
      (!sourceFilter ||
        (sourceFilter === "linked"
          ? Boolean(artifact.source)
          : !artifact.source)),
  );
  const selected =
    artifacts.find((item) => item.id === requestedId) ?? artifacts[0];
  const allKinds = (
    Object.entries(artifactLabels) as [Artifact["kind"], string][]
  ).filter(
    ([id]) =>
      filteredCollections.some((item) => item.kind === id) || kindFilter === id,
  );
  const emptyRequested =
    requestedId &&
    !allArtifacts.some((artifact) => artifact.id === requestedId);
  const listedCourses = new Set(
    allArtifacts.flatMap((artifact) =>
      artifact.source ? [artifact.source.courseId] : [],
    ),
  );
  if (sourceCourse) listedCourses.add(sourceCourse);
  const filters = [
    { id: "all", title: "全部" },
    { id: "notes", title: "笔记" },
    { id: "works", title: "成果" },
  ] as const;

  function select(id: string) {
    setParams(updateSearchParam(params, "artifact", id), { replace: true });
  }

  function setFilter(key: string, value?: string) {
    const next = updateSearchParam(params, key, value);
    if (key === "collection") next.delete("kind");
    if (key === "courseId") next.delete("source");
    if (key === "source") next.delete("courseId");
    setParams(next, { replace: true });
  }

  return (
    <div className="page-content student-page">
      <Heading
        title="空间"
        subtitle="回看自己保存的笔记和成果。"
        action={
          <Link className="action-secondary" to="/tools">
            <Plus size={16} aria-hidden="true" /> 去工具
          </Link>
        }
      />
      <div className="student-filter" role="group" aria-label="成果筛选">
        {filters.map(({ id, title }) => (
          <button
            type="button"
            key={id}
            aria-pressed={filter === id}
            onClick={() =>
              setFilter("collection", id === "all" ? undefined : id)
            }
          >
            {title}
          </button>
        ))}
      </div>
      <div className="student-record-filters">
        <label>
          成果类型
          <select
            value={kindFilter}
            onChange={(event) => setFilter("kind", event.currentTarget.value)}
          >
            <option value="">全部类型</option>
            {allKinds.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          来源
          <select
            value={sourceCourse ? `course:${sourceCourse}` : sourceFilter}
            onChange={(event) => {
              const value = event.currentTarget.value;
              if (value.startsWith("course:"))
                setFilter("courseId", value.slice("course:".length));
              else setFilter("source", value);
            }}
          >
            <option value="">全部来源</option>
            <option value="linked">有学习来源</option>
            <option value="unlinked">未关联来源</option>
            {[...listedCourses].map((id) => (
              <option key={id} value={`course:${id}`}>
                {courseNames.get(id) ?? id}
              </option>
            ))}
          </select>
        </label>
        {sourceCourse ? (
          <button
            type="button"
            className="student-inline-link"
            onClick={() => setFilter("courseId")}
          >
            <X size={14} aria-hidden="true" /> 清除课程筛选
          </button>
        ) : null}
      </div>
      {items.isPending ? <Message>正在读取空间…</Message> : null}
      {items.isError ? (
        <Message retry={() => void items.refetch()}>暂时无法读取空间。</Message>
      ) : null}
      {items.isSuccess && emptyRequested ? (
        <Message>找不到指定成果。</Message>
      ) : null}
      {items.isSuccess ? (
        selected ? (
          <div className="student-two-column">
            <Section title="已保存" meta={`${artifacts.length} 项`}>
              <div className="student-stack">
                {artifacts.map((item) => (
                  <button
                    className="surface-card student-card-link student-row"
                    type="button"
                    key={item.id}
                    aria-pressed={selected.id === item.id}
                    onClick={() => select(item.id)}
                  >
                    <IconBox
                      icon={isNote(item) ? FileText : Layers}
                      tone={isNote(item) ? "blue" : "violet"}
                    />
                    <span className="student-row__copy">
                      <strong>{item.title}</strong>
                      <small>
                        {artifactLabels[item.kind]} ·{" "}
                        {dateLabel(item.createdAt)}
                        {item.source
                          ? ` · ${courseNames.get(item.source.courseId) ?? sourceLabel(item.source)}`
                          : ""}
                      </small>
                    </span>
                    <Eye
                      size={16}
                      className="student-muted"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </Section>
            <section
              className="surface-card student-workbench"
              aria-label="成果预览"
            >
              <Pill tone="violet">{artifactLabels[selected.kind]}</Pill>
              <h2
                className="student-preview-heading"
                ref={previewHeading}
                tabIndex={-1}
              >
                {selected.title}
              </h2>
              <p className="student-help">
                {dateLabel(selected.createdAt)}
                {selected.simulated ? " · 演示记录" : ""}
              </p>
              <div className="student-content">{selected.body}</div>
              {selected.content ? (
                <section
                  className="student-structured-preview"
                  aria-label="结构化成果"
                >
                  <h3>结构化预览</h3>
                  <ArtifactContentView
                    key={selected.id}
                    content={selected.content}
                  />
                </section>
              ) : null}
              {selected.source || toolArtifactKinds.has(selected.kind) ? (
                <div className="student-actions">
                  {toolArtifactKinds.has(selected.kind) ? (
                    <Link
                      className="action-secondary"
                      to={`/tools?${new URLSearchParams({ tool: selected.kind, reopen: selected.id })}`}
                    >
                      <Layers size={16} aria-hidden="true" /> 在工具中重新打开
                    </Link>
                  ) : null}
                  {selected.source ? (
                    <>
                      <Link
                        className="action-secondary"
                        to={sourcePath(selected.source)}
                      >
                        <BookOpen size={16} aria-hidden="true" />{" "}
                        {sourceLabel(selected.source)}
                      </Link>
                      <button
                        className="action-secondary"
                        type="button"
                        onClick={() => openMia(selected.source)}
                      >
                        <Sparkles size={16} aria-hidden="true" /> 和 Mia 继续
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
              {selected.kind === "recap" ? (
                <ReviewSuggestion
                  key={selected.id}
                  artifactId={selected.id}
                  showTodayLink
                />
              ) : null}
            </section>
          </div>
        ) : (
          <Message>
            {allArtifacts.length
              ? "没有符合这些条件的内容。"
              : "这里还没有保存的内容。"}
          </Message>
        )
      ) : null}
    </div>
  );
}

const evidenceKinds = {
  mastery: { label: "掌握", icon: Target, tone: "violet" },
  practice: { label: "练习", icon: ClipboardCheck, tone: "blue" },
  discovery: { label: "探索", icon: Compass, tone: "blue" },
  creation: { label: "创造", icon: Layers, tone: "green" },
} as const;
const evidenceBasis: Record<Evidence["basis"], { label: string; tone: Tone }> =
  {
    activity: { label: "活动记录", tone: "blue" },
    "student-confirmed": { label: "学生已确认", tone: "green" },
    "ai-inference": { label: "AI 推断", tone: "amber" },
  };
const evidencePracticeMode = {
  assisted: { label: "有提示练习", tone: "violet" },
  independent: { label: "独立练习", tone: "green" },
} as const;

function growthCategory(item: Evidence) {
  return item.practiceMode ? "practice" : item.kind;
}

function evidenceSourcePath(item: Evidence) {
  return item.source
    ? sourcePath(
        item.source,
        item.practiceMode === "independent" ? item.taskId : undefined,
      )
    : undefined;
}

function EvidenceDetail({
  item,
  onClose,
}: {
  item: Evidence;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const kind = evidenceKinds[growthCategory(item)];
  const basis = evidenceBasis[item.basis];
  const practice = item.practiceMode
    ? evidencePracticeMode[item.practiceMode]
    : undefined;
  const source = evidenceSourcePath(item);
  const explanation: Record<Evidence["basis"], string> = {
    activity: "来自一次学习活动，不是正式成绩。",
    "student-confirmed": "这条记录来自你确认或提交的内容。",
    "ai-inference": "这是 Mia 根据当前学习线索做出的推断，不代表掌握情况。",
  };

  return (
    <section className="student-record-detail" aria-label="证据详情">
      <div className="student-record-detail__head">
        <div>
          <p className="student-eyebrow">成长证据</p>
          <h2 ref={heading} tabIndex={-1}>
            {item.title}
          </h2>
        </div>
        <button
          type="button"
          className="student-icon-button"
          aria-label="关闭证据详情"
          title="关闭详情"
          onClick={onClose}
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>
      <div className="student-evidence__chips">
        <Pill tone={kind.tone}>{kind.label}</Pill>
        <Pill tone={basis.tone}>{basis.label}</Pill>
        {practice ? <Pill tone={practice.tone}>{practice.label}</Pill> : null}
        <time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time>
      </div>
      <p>{item.body}</p>
      <p className="student-help">{explanation[item.basis]}</p>
      {source || item.taskId || item.artifactId ? (
        <div className="student-record-actions">
          {source ? (
            <Link className="action-secondary" to={source}>
              <BookOpen size={15} aria-hidden="true" /> 回到原出处
            </Link>
          ) : null}
          {item.taskId ? (
            <Link
              className="action-secondary"
              to={`/?${new URLSearchParams({ task: item.taskId })}`}
            >
              <CalendarDays size={15} aria-hidden="true" /> 查看关联任务
            </Link>
          ) : null}
          {item.artifactId ? (
            <Link
              className="action-secondary"
              to={`/space?${new URLSearchParams({ artifact: item.artifactId })}`}
            >
              <FolderOpen size={15} aria-hidden="true" /> 查看关联成果
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function GrowthPage() {
  const evidence = useQuery({ queryKey: ["growth"], queryFn: getGrowth });
  const courses = useQuery({ queryKey: ["courses"], queryFn: getCourses });
  const [params, setParams] = useSearchParams();
  const sourceCourse = params.get("courseId") ?? "";
  const period = params.get("period") ?? "";
  const category = params.get("kind");
  const filter =
    category && Object.hasOwn(evidenceKinds, category) ? category : null;
  const basisParam = params.get("basis");
  const practiceParam = params.get("practice");
  const basisFilter =
    basisParam && Object.hasOwn(evidenceBasis, basisParam) ? basisParam : "";
  const practiceFilter =
    practiceParam && Object.hasOwn(evidencePracticeMode, practiceParam)
      ? practiceParam
      : "";
  const selectedId = params.get("evidence");
  const allEntries = evidence.data ?? [];
  const selected = allEntries.find((item) => item.id === selectedId);
  const periodStart = new Date();
  periodStart.setHours(0, 0, 0, 0);
  if (period === "week") periodStart.setDate(periodStart.getDate() - 6);
  if (period === "month") periodStart.setDate(periodStart.getDate() - 29);
  const filterDate = period === "week" || period === "month";
  const entries = allEntries.filter(
    (item) =>
      (!sourceCourse || item.source?.courseId === sourceCourse) &&
      (!filterDate || new Date(item.createdAt) >= periodStart) &&
      (!filter || growthCategory(item) === filter) &&
      (!basisFilter || item.basis === basisFilter) &&
      (!practiceFilter || item.practiceMode === practiceFilter),
  );
  const kinds = Object.keys(evidenceKinds) as (keyof typeof evidenceKinds)[];

  function setFilter(key: string, value?: string) {
    setParams(updateSearchParam(params, key, value), { replace: true });
  }

  return (
    <div className="page-content student-page">
      <Heading
        title="成长"
        subtitle="回看自己的练习、探索与学习成果。"
        action={<IconBox icon={GraduationCap} tone="blue" />}
      />
      <div className="student-filter" role="group" aria-label="成长记录筛选">
        <button
          type="button"
          aria-pressed={filter === null}
          onClick={() => setFilter("kind")}
        >
          全部
        </button>
        {kinds.map((kind) => (
          <button
            type="button"
            aria-pressed={filter === kind}
            key={kind}
            onClick={() => setFilter("kind", kind)}
          >
            {evidenceKinds[kind].label}
          </button>
        ))}
      </div>
      <div className="student-record-filters">
        <label>
          所属课程
          <select
            value={sourceCourse}
            onChange={(event) =>
              setFilter("courseId", event.currentTarget.value)
            }
          >
            <option value="">全部课程</option>
            {sourceCourse &&
              !courses.data?.some(({ id }) => id === sourceCourse) && (
                <option value={sourceCourse}>当前关联课程</option>
              )}
            {courses.data?.map(({ id, title }) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <label>
          记录日期
          <select
            value={filterDate ? period : ""}
            onChange={(event) => setFilter("period", event.currentTarget.value)}
          >
            <option value="">全部日期</option>
            <option value="week">最近 7 天</option>
            <option value="month">最近 30 天</option>
          </select>
        </label>
        <label>
          记录依据
          <select
            value={basisFilter}
            onChange={(event) => setFilter("basis", event.currentTarget.value)}
          >
            <option value="">全部依据</option>
            {Object.entries(evidenceBasis).map(([id, basis]) => (
              <option key={id} value={id}>
                仅{basis.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          练习方式
          <select
            value={practiceFilter}
            onChange={(event) =>
              setFilter("practice", event.currentTarget.value)
            }
          >
            <option value="">不限方式</option>
            {Object.entries(evidencePracticeMode).map(([id, mode]) => (
              <option key={id} value={id}>
                仅{mode.label}
              </option>
            ))}
          </select>
        </label>
        {sourceCourse ? (
          <button
            type="button"
            className="student-inline-link"
            onClick={() => setFilter("courseId")}
          >
            <X size={14} aria-hidden="true" /> 清除课程筛选
          </button>
        ) : null}
      </div>
      {evidence.isPending ? <Message>正在读取成长记录…</Message> : null}
      {evidence.isError ? (
        <Message retry={() => void evidence.refetch()}>
          暂时无法读取成长记录。
        </Message>
      ) : null}
      {evidence.isSuccess && selected ? (
        <EvidenceDetail
          key={selected.id}
          item={selected}
          onClose={() => setFilter("evidence")}
        />
      ) : null}
      {evidence.isSuccess && selectedId && !selected ? (
        <Message>找不到这条成长记录。</Message>
      ) : null}
      {evidence.isSuccess ? (
        <Section title="成长时间线" meta={`${entries.length} 条记录`}>
          {entries.length ? (
            <ol className="student-timeline">
              {entries.map((item) => {
                const kind = evidenceKinds[growthCategory(item)];
                const basis = evidenceBasis[item.basis];
                const practiceMode = item.practiceMode
                  ? evidencePracticeMode[item.practiceMode]
                  : undefined;
                return (
                  <li className="student-evidence" key={item.id}>
                    <IconBox icon={kind.icon} tone={kind.tone} />
                    <div className="student-evidence__text">
                      <div className="student-evidence__chips">
                        {practiceMode ? null : <Pill>{kind.label}</Pill>}
                        <Pill tone={basis.tone}>{basis.label}</Pill>
                        {practiceMode ? (
                          <Pill tone={practiceMode.tone}>
                            {practiceMode.label}
                          </Pill>
                        ) : null}
                        <time dateTime={item.createdAt}>
                          {dateLabel(item.createdAt)}
                        </time>
                      </div>
                      <h3 className="student-row-heading">{item.title}</h3>
                      <p>{item.body}</p>
                      <div className="student-record-actions">
                        {item.source ? (
                          <Link
                            className="student-inline-link"
                            to={
                              evidenceSourcePath(item) ??
                              coursePath(item.source.courseId)
                            }
                          >
                            {sourceLabel(item.source)}{" "}
                            <ChevronRight size={14} aria-hidden="true" />
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          className="student-inline-link"
                          aria-label={`证据详情：${item.title}`}
                          aria-expanded={selectedId === item.id}
                          onClick={() =>
                            setFilter(
                              "evidence",
                              selectedId === item.id ? undefined : item.id,
                            )
                          }
                        >
                          <Eye size={15} aria-hidden="true" /> 证据详情
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <Message>这一类暂时没有记录。</Message>
          )}
        </Section>
      ) : null}
    </div>
  );
}
