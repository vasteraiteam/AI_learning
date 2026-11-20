import type { ArtifactContent } from "../../api/contracts";
import "./artifact-content.css";

type TextEntry = { title: string; text: string };

function TextEntries({ entries }: { entries: TextEntry[] }) {
  return (
    <ol className="artifact-content-list">
      {entries.map((entry, index) => (
        <li key={index}>
          <strong>{entry.title}</strong>
          <p>{entry.text}</p>
        </li>
      ))}
    </ol>
  );
}

export function ArtifactContentView({ content }: { content: ArtifactContent }) {
  switch (content.type) {
    case "photo":
      return (
        <div className="artifact-content">
          <strong className="artifact-content__prompt">
            {content.equation}
          </strong>
          <ul className="artifact-content-list">
            {content.checks.map((check, index) => (
              <li key={index}>{check}</li>
            ))}
          </ul>
        </div>
      );
    case "explain":
      return <TextEntries entries={content.steps} />;
    case "summary":
      return <TextEntries entries={content.sections} />;
    case "mindmap":
      return (
        <div className="artifact-content">
          <strong className="artifact-content__prompt">{content.root}</strong>
          <ul className="artifact-content-list">
            {content.branches.map((branch, index) => (
              <li key={index}>
                <strong>{branch.label}</strong>
                <ul className="artifact-content-list__nested">
                  {branch.children.map((child, childIndex) => (
                    <li key={childIndex}>{child}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      );
    case "podcast":
      return (
        <div className="artifact-content">
          <p className="artifact-content__note">模拟脚本，未生成音频。</p>
          <dl className="artifact-content-transcript">
            {content.lines.map((line, index) => (
              <div key={index}>
                <dt>{line.speaker}</dt>
                <dd>{line.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      );
    case "flashcards":
      return (
        <ol className="artifact-content-list">
          {content.cards.map((card, index) => (
            <li key={index}>
              <details className="artifact-content-reveal">
                <summary>{card.front}</summary>
                <p>{card.back}</p>
              </details>
            </li>
          ))}
        </ol>
      );
    case "quiz":
      return (
        <ol className="artifact-content-list">
          {content.questions.map((question, index) => (
            <li key={index}>
              <strong className="artifact-content__prompt">
                {question.prompt}
              </strong>
              <ol className="artifact-content-list__nested">
                {question.choices.map((choice, choiceIndex) => (
                  <li key={choiceIndex}>{choice}</li>
                ))}
              </ol>
              <details className="artifact-content-reveal">
                <summary>查看参考答案</summary>
                <p>
                  <strong>{question.choices[question.correctIndex]}</strong>
                </p>
                <p>{question.explanation}</p>
              </details>
            </li>
          ))}
        </ol>
      );
    case "storyboard":
      return (
        <div className="artifact-content">
          <p className="artifact-content__note">模拟分镜，未生成视频。</p>
          <ol className="artifact-content-list">
            {content.scenes.map((scene, index) => (
              <li key={index}>
                <strong>
                  镜头 {index + 1}：{scene.title}
                </strong>
                <dl className="artifact-content-transcript">
                  <div>
                    <dt>画面</dt>
                    <dd>{scene.visual}</dd>
                  </div>
                  <div>
                    <dt>旁白</dt>
                    <dd>{scene.narration}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        </div>
      );
  }
}
