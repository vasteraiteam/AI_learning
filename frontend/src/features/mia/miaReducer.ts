import type {
  Artifact,
  PracticeResult,
  Recap,
  TurnInput,
} from "../../api/contracts";

export type MiaMessage = {
  id: string;
  role: "student" | "mia";
  text: string;
  stopped?: boolean;
};

export type MiaState = {
  messages: MiaMessage[];
  activeTurnId: string | null;
  activeTurnMode: TurnInput["mode"] | null;
  completedTurns: number;
  hasCompletedHint: boolean;
  guidedAnswer: PracticeResult | null;
  recap: Recap | null;
  receipt: Artifact | null;
  view: "chat" | "recap";
  pending: "recap" | "save" | "guided" | null;
  error: string | null;
};

export const initialMiaState: MiaState = {
  messages: [],
  activeTurnId: null,
  activeTurnMode: null,
  completedTurns: 0,
  hasCompletedHint: false,
  guidedAnswer: null,
  recap: null,
  receipt: null,
  view: "chat",
  pending: null,
  error: null,
};

export type MiaAction =
  | { type: "turn/start"; id: string; message: string; mode: TurnInput["mode"] }
  | { type: "turn/delta"; id: string; text: string }
  | { type: "turn/complete"; id: string; text: string }
  | { type: "turn/stop"; id: string }
  | { type: "turn/fail"; id: string }
  | { type: "guided/request" }
  | { type: "guided/ready"; result: PracticeResult }
  | { type: "recap/request" }
  | { type: "recap/ready"; recap: Recap }
  | { type: "recap/edit"; field: "title" | "body"; value: string }
  | { type: "recap/save" }
  | { type: "recap/saved"; receipt: Artifact }
  | { type: "recap/show" | "chat/show" }
  | { type: "request/fail"; message: string };

function updateTurn(
  state: MiaState,
  id: string,
  update: (message: MiaMessage) => MiaMessage,
) {
  return state.messages.map((message) =>
    message.id === id ? update(message) : message,
  );
}

export function miaReducer(state: MiaState, action: MiaAction): MiaState {
  switch (action.type) {
    case "turn/start":
      if (state.activeTurnId) return state;
      return {
        ...state,
        activeTurnId: action.id,
        activeTurnMode: action.mode,
        error: null,
        messages: [
          ...state.messages,
          ...(action.mode === "hint"
            ? []
            : [
                {
                  id: `${action.id}-question`,
                  role: "student" as const,
                  text: action.message,
                },
              ]),
          { id: action.id, role: "mia", text: "" },
        ],
      };
    case "turn/delta":
      if (state.activeTurnId !== action.id) return state;
      return {
        ...state,
        messages: updateTurn(state, action.id, (message) => ({
          ...message,
          text: message.text + action.text,
        })),
      };
    case "turn/complete":
      if (state.activeTurnId !== action.id) return state;
      return {
        ...state,
        activeTurnId: null,
        activeTurnMode: null,
        completedTurns: state.completedTurns + 1,
        hasCompletedHint:
          state.hasCompletedHint || state.activeTurnMode === "hint",
        messages: updateTurn(state, action.id, (message) => ({
          ...message,
          text: action.text,
        })),
      };
    case "turn/stop":
      if (state.activeTurnId !== action.id) return state;
      return {
        ...state,
        activeTurnId: null,
        activeTurnMode: null,
        messages: updateTurn(state, action.id, (message) => ({
          ...message,
          stopped: true,
        })),
      };
    case "turn/fail":
      if (state.activeTurnId !== action.id) return state;
      return {
        ...state,
        activeTurnId: null,
        activeTurnMode: null,
        messages: state.messages.filter((message) => message.id !== action.id),
        error: "Mia 暂时无法回复，请重试。",
      };
    case "guided/request":
      return { ...state, pending: "guided", guidedAnswer: null, error: null };
    case "guided/ready":
      return { ...state, pending: null, guidedAnswer: action.result };
    case "recap/request":
      return { ...state, pending: "recap", error: null };
    case "recap/ready":
      return { ...state, pending: null, recap: action.recap, view: "recap" };
    case "recap/edit":
      return state.recap && !state.pending && !state.receipt
        ? { ...state, recap: { ...state.recap, [action.field]: action.value } }
        : state;
    case "recap/save":
      return { ...state, pending: "save", error: null };
    case "recap/saved":
      return { ...state, pending: null, receipt: action.receipt };
    case "recap/show":
      return { ...state, view: "recap", error: null };
    case "chat/show":
      return { ...state, view: "chat", error: null };
    case "request/fail":
      return { ...state, pending: null, error: action.message };
  }
}
