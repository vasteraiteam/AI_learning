import { useId, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, ClipboardCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { getReviewPractice, submitReviewAnswer } from "../../api/client";
import type { SourceContext } from "../../api/contracts";
import "./review-practice.css";

type ReviewData = Awaited<ReturnType<typeof getReviewPractice>>;

function matchesReviewedExample(
  source: SourceContext,
  savedSource?: SourceContext,
) {
  return Boolean(
    savedSource?.materialId &&
    savedSource.selectionId &&
    savedSource.page !== undefined &&
    savedSource.courseId === source.courseId &&
    savedSource.materialId === source.materialId &&
    savedSource.page === source.page &&
    savedSource.selectionId === source.selectionId,
  );
}

function ReviewAnswerForm({ practice }: { practice: ReviewData }) {
  const queryClient = useQueryClient();
  const answerId = useId();
  const [answer, setAnswer] = useState("");
  const taskId = practice.task.id;
  const submission = useMutation({
    mutationFn: (value: string) => submitReviewAnswer(taskId, value),
    onSuccess: (result) => {
      if (!result.correct) return;
      queryClient.setQueryData<ReviewData>(
        ["review-practice", taskId],
        (previous) =>
          previous
            ? { ...previous, task: { ...previous.task, completed: true } }
            : previous,
      );
      void queryClient.invalidateQueries({ queryKey: ["today"] });
      void queryClient.invalidateQueries({ queryKey: ["growth"] });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (answer.trim() && !submission.isPending && !practice.task.completed)
      submission.mutate(answer.trim());
  }

  return (
    <form className="review-practice__form" onSubmit={submit}>
      <label htmlFor={answerId}>你的 x 值</label>
      <input
        id={answerId}
        className="review-practice__answer"
        value={answer}
        inputMode="decimal"
        autoComplete="off"
        maxLength={32}
        readOnly={submission.isPending}
        onChange={(event) => {
          setAnswer(event.currentTarget.value);
          submission.reset();
        }}
        required
      />
      <button
        className="action-primary"
        type="submit"
        disabled={!answer.trim() || submission.isPending}
      >
        <ClipboardCheck size={16} aria-hidden="true" />
        {submission.isPending ? "正在提交…" : "提交答案"}
      </button>
      {submission.data && !submission.data.correct ? (
        <p className="review-practice__error" role="status">
          {submission.data.message}
        </p>
      ) : null}
      {submission.isError ? (
        <p className="review-practice__error" role="alert">
          暂时无法核对答案，请重新提交。
        </p>
      ) : null}
    </form>
  );
}

export function ReviewPractice({
  taskId,
  source,
}: {
  taskId: string;
  source: SourceContext;
}) {
  const headingId = useId();
  const practice = useQuery({
    queryKey: ["review-practice", taskId],
    queryFn: ({ signal }) => getReviewPractice(taskId, signal),
    retry: false,
  });
  const data = practice.data;
  const valid =
    data &&
    data.task.id === taskId &&
    matchesReviewedExample(source, data.task.source);

  return (
    <section
      className="surface-card review-practice"
      aria-labelledby={headingId}
    >
      <h2 className="review-practice__heading" id={headingId}>
        <ClipboardCheck size={16} aria-hidden="true" /> 独立变式练习
      </h2>
      {practice.isPending ? <p role="status">正在读取练习…</p> : null}
      {practice.isError ? (
        <>
          <p role="status">暂时无法打开这项练习。</p>
          <button
            type="button"
            className="action-secondary"
            onClick={() => void practice.refetch()}
          >
            重试
          </button>
        </>
      ) : null}
      {practice.isSuccess ? (
        valid ? (
          <>
            <p className="review-practice__question">{data.question}</p>
            {data.task.completed ? (
              <>
                <p className="review-practice__success" role="status">
                  <CheckCircle2 size={16} aria-hidden="true" /> 独立练习已完成
                </p>
                <Link
                  className="review-practice__link"
                  to={`/growth?courseId=${encodeURIComponent(source.courseId)}`}
                >
                  查看成长记录 <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </>
            ) : (
              <ReviewAnswerForm key={taskId} practice={data} />
            )}
          </>
        ) : (
          <>
            <p role="status">当前页或选区与复习任务不匹配。</p>
            <Link className="review-practice__link" to="/">
              返回今日 <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </>
        )
      ) : null}
    </section>
  );
}
