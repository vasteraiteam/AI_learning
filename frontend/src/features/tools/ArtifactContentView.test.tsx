import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ArtifactContentView } from "./ArtifactContentView";

it("reveals the back of a saved flashcard only when opened", () => {
  render(
    <ArtifactContentView
      content={{ type: "flashcards", cards: [{ front: "题面", back: "卡背" }] }}
    />,
  );
  const front = screen.getByText("题面");
  const disclosure = front.closest("details");
  expect(disclosure).not.toHaveAttribute("open");
  fireEvent.click(front);
  expect(disclosure).toHaveAttribute("open");
  expect(screen.getByText("卡背")).toBeVisible();
});

it("retains quiz options and reveals the indexed reference answer", () => {
  render(
    <ArtifactContentView
      content={{
        type: "quiz",
        questions: [
          {
            prompt: "哪句是礼貌请求？",
            choices: ["Give me that.", "Could I borrow that, please?"],
            correctIndex: 1,
            explanation: "使用 Could I…?",
          },
        ],
      }}
    />,
  );
  const toggle = screen.getByText("查看参考答案");
  const disclosure = toggle.closest("details");
  expect(disclosure).not.toHaveAttribute("open");
  fireEvent.click(toggle);
  expect(disclosure).toHaveAttribute("open");
  expect(disclosure).toHaveTextContent("Could I borrow that, please?");
  expect(disclosure).not.toHaveTextContent("Give me that.");
});

it("identifies the storyboard as a script and does not offer media playback", () => {
  const { container } = render(
    <ArtifactContentView
      content={{
        type: "storyboard",
        scenes: [{ title: "展示原题", visual: "方程", narration: "先看条件" }],
      }}
    />,
  );
  expect(screen.getByText("模拟分镜，未生成视频。")).toBeVisible();
  expect(screen.getByText("镜头 1：展示原题")).toBeVisible();
  expect(screen.getByText("方程")).toBeVisible();
  expect(screen.getByText("先看条件")).toBeVisible();
  expect(container.querySelector("video, audio")).toBeNull();
});
