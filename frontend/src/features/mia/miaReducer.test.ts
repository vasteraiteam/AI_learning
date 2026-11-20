import { describe, expect, it } from "vitest";
import { initialMiaState, miaReducer } from "./miaReducer";

describe("Mia response cancellation", () => {
  it("keeps a stopped response and ignores its late events during the next turn", () => {
    let state = miaReducer(initialMiaState, {
      type: "turn/start",
      id: "first",
      mode: "hint",
      message: "开始辅导",
    });
    state = miaReducer(state, {
      type: "turn/delta",
      id: "first",
      text: "先观察括号",
    });
    state = miaReducer(state, { type: "turn/stop", id: "first" });
    state = miaReducer(state, {
      type: "turn/start",
      id: "second",
      mode: "reply",
      message: "下一步是什么？",
    });

    expect(
      miaReducer(state, {
        type: "turn/delta",
        id: "first",
        text: "迟到的提示",
      }),
    ).toBe(state);
    expect(
      miaReducer(state, {
        type: "turn/complete",
        id: "first",
        text: "迟到的完整回复",
      }),
    ).toBe(state);

    state = miaReducer(state, {
      type: "turn/complete",
      id: "second",
      text: "等式两边都除以 3",
    });
    expect(state.messages).toEqual([
      { id: "first", role: "mia", text: "先观察括号", stopped: true },
      { id: "second-question", role: "student", text: "下一步是什么？" },
      { id: "second", role: "mia", text: "等式两边都除以 3" },
    ]);
    expect(state.completedTurns).toBe(1);
    expect(state.activeTurnId).toBeNull();
    expect(state.hasCompletedHint).toBe(false);

    state = miaReducer(state, {
      type: "turn/start",
      id: "third",
      mode: "hint",
      message: "开始分步辅导",
    });
    expect(state.hasCompletedHint).toBe(false);
    state = miaReducer(state, {
      type: "turn/complete",
      id: "third",
      text: "等式两边都除以 3，看看左边剩下什么。",
    });
    expect(state.hasCompletedHint).toBe(true);
  });
});
