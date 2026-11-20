import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarPlus, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { decideReviewProposal, getReviewProposal } from "../../api/client";
import type { ReviewDecisionInput, ReviewProposal } from "../../api/contracts";
import "./mia.css";

type ReviewSuggestionProps = {
  artifactId: string;
  showTodayLink?: boolean;
  onNavigateToday?: () => void;
};

function ReviewDecision({
  proposal,
  artifactId,
  showTodayLink,
  onNavigateToday,
}: ReviewSuggestionProps & { proposal: ReviewProposal }) {
  const [title, setTitle] = useState(proposal.title);
  const [dueDate, setDueDate] = useState(proposal.dueDate);
  const result = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const decision = useMutation({
    mutationFn: (input: ReviewDecisionInput) =>
      decideReviewProposal(proposal.id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(["review-proposal", artifactId], updated);
      if (updated.status === "confirmed")
        void queryClient.invalidateQueries({ queryKey: ["today"] });
    },
  });

  useEffect(() => {
    if (decision.isSuccess) result.current?.focus();
  }, [decision.isSuccess]);

  const confirm = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !dueDate || decision.isPending) return;
    decision.mutate({ decision: "confirm", title: title.trim(), dueDate });
  };

  return (
    <section className="review-suggestion" aria-label="复习建议">
      <p className="review-suggestion__title" role="heading" aria-level={4}>
        <CalendarPlus size={17} aria-hidden="true" />
        复习建议
      </p>
      {proposal.status === "pending" ? (
        <form className="review-suggestion__form" onSubmit={confirm}>
          <label>
            复习标题
            <input
              maxLength={120}
              required
              disabled={decision.isPending}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label>
            复习日期
            <input
              type="date"
              required
              disabled={decision.isPending}
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </label>
          {decision.error && (
            <p className="mia-error" role="alert">
              {decision.error.message}
            </p>
          )}
          <div className="review-suggestion__actions">
            <button
              type="submit"
              className="action-primary"
              disabled={decision.isPending || !title.trim() || !dueDate}
            >
              确认安排复习
            </button>
            <button
              type="button"
              className="action-secondary"
              disabled={decision.isPending}
              onClick={() => decision.mutate({ decision: "reject" })}
            >
              拒绝建议
            </button>
          </div>
        </form>
      ) : (
        <div
          className="review-suggestion__result"
          aria-live="polite"
          tabIndex={-1}
          ref={result}
        >
          {proposal.status === "confirmed" ? (
            <>
              <p>
                <Check size={16} aria-hidden="true" />
                已安排复习
              </p>
              <span>
                {proposal.dueDate} · {proposal.title}
              </span>
              {showTodayLink && (
                <Link to="/" onClick={onNavigateToday}>
                  查看今日 <ArrowRight size={14} aria-hidden="true" />
                </Link>
              )}
            </>
          ) : (
            <p>已拒绝复习建议</p>
          )}
        </div>
      )}
    </section>
  );
}

export function ReviewSuggestion(props: ReviewSuggestionProps) {
  const { artifactId } = props;
  const proposal = useQuery({
    queryKey: ["review-proposal", artifactId],
    queryFn: ({ signal }) => getReviewProposal(artifactId, signal),
  });
  if (proposal.isPending)
    return (
      <p className="review-suggestion__notice" aria-live="polite">
        正在加载复习建议…
      </p>
    );
  if (proposal.isError)
    return (
      <div className="review-suggestion__notice">
        <p role="alert">暂时无法加载复习建议。</p>
        <button
          type="button"
          className="action-secondary"
          onClick={() => void proposal.refetch()}
        >
          重试
        </button>
      </div>
    );
  return proposal.data ? (
    <ReviewDecision
      key={proposal.data.id}
      proposal={proposal.data}
      {...props}
    />
  ) : null;
}
