import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import type { CourseActivity } from "./activities";
import "./course-learning.css";

export function CourseExercise({
  activity,
  onAsk,
}: {
  activity: CourseActivity;
  onAsk: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [attempt, setAttempt] = useState<string | null>(null);
  const correct = attempt !== null && Number(attempt) === activity.answer;
  const feedback = correct
    ? activity.kind === "numeric"
      ? `${activity.success} ${activity.explanation}`
      : `答对了。${activity.explanation}`
    : activity.kind === "numeric"
      ? `代入这个数，两边还不相等。${activity.hint}`
      : `这个选项还不合适。${activity.explanation}`;

  return (
    <section className="surface-card student-workbench course-exercise">
      <span
        className="student-pill"
        data-tone={activity.id === "math-observatory" ? "amber" : "violet"}
      >
        {activity.badge}
      </span>
      <h2>{activity.title}</h2>
      {activity.kind === "numeric" && activity.introduction ? (
        <p className="student-help">{activity.introduction}</p>
      ) : null}
      {activity.kind === "numeric" ? (
        <div className="student-content">{activity.equation}</div>
      ) : activity.passage ? (
        <div className="student-content">
          <p lang={activity.language}>{activity.passage}</p>
        </div>
      ) : null}
      <form
        className="student-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (answer.trim()) setAttempt(answer.trim());
        }}
      >
        {activity.kind === "numeric" ? (
          <label>
            你的 x 值
            <input
              value={answer}
              inputMode="decimal"
              onChange={(event) => {
                setAnswer(event.currentTarget.value);
                setAttempt(null);
              }}
              placeholder="填写数值"
              required
            />
          </label>
        ) : (
          <fieldset className="course-choices">
            <legend lang={activity.language}>{activity.prompt}</legend>
            {activity.choices.map((choice, index) => (
              <label className="course-choice" key={choice}>
                <input
                  type="radio"
                  name={activity.id}
                  value={index}
                  checked={answer === String(index)}
                  onChange={(event) => {
                    setAnswer(event.currentTarget.value);
                    setAttempt(null);
                  }}
                  required
                />
                <span lang={activity.language}>{choice}</span>
              </label>
            ))}
          </fieldset>
        )}
        <div className="student-actions">
          <button
            type="submit"
            className="action-primary"
            disabled={!answer.trim()}
          >
            <Check size={16} aria-hidden="true" /> 核对答案
          </button>
          <button type="button" className="action-secondary" onClick={onAsk}>
            <Sparkles size={16} aria-hidden="true" /> 问 Mia
          </button>
        </div>
      </form>
      {attempt !== null ? (
        <p
          className={correct ? "student-status" : "student-error"}
          role="status"
        >
          {feedback}
        </p>
      ) : null}
    </section>
  );
}
