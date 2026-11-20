import { create } from "zustand";
import type { SourceContext } from "../../api/contracts";

interface MiaStore {
  open: boolean;
  opener: HTMLElement | null;
  setOpen: (open: boolean) => void;
  openFromPage: () => void;
  context: SourceContext | null;
  contexts: (SourceContext | null)[];
  contextPinned: boolean;
  setContext: (context: SourceContext | null) => void;
  pageContext: SourceContext | null;
  setPageContext: (context: SourceContext | null) => void;
}

export function contextKey(context: SourceContext | null) {
  return context
    ? JSON.stringify([
        context.courseId,
        context.unitId,
        context.activityId,
        context.materialId,
        context.page,
        context.selectionId,
      ])
    : "";
}

function addContext(
  contexts: MiaStore["contexts"],
  context: SourceContext | null,
) {
  return contexts.some((entry) => contextKey(entry) === contextKey(context))
    ? contexts
    : [...contexts, context];
}

function getOpener(current: HTMLElement | null, wasOpen: boolean) {
  if (wasOpen) return current;
  const element =
    typeof document === "undefined" ? null : document.activeElement;
  return element instanceof HTMLElement && element !== document.body
    ? element
    : null;
}

export const useMiaStore = create<MiaStore>((set) => ({
  open: false,
  opener: null,
  setOpen: (open) =>
    set((state) =>
      open ? { open, opener: getOpener(state.opener, state.open) } : { open },
    ),
  openFromPage: () =>
    set((state) => {
      const context = state.contextPinned
        ? state.context
        : (state.context ?? state.pageContext);
      return {
        open: true,
        opener: getOpener(state.opener, state.open),
        context,
        contexts: addContext(state.contexts, context),
      };
    }),
  context: null,
  contexts: [null],
  contextPinned: false,
  setContext: (context) =>
    set((state) =>
      state.contextPinned && contextKey(context) === contextKey(state.context)
        ? state
        : {
            context,
            contextPinned: true,
            contexts: addContext(state.contexts, context),
          },
    ),
  pageContext: null,
  setPageContext: (pageContext) =>
    set((state) =>
      contextKey(pageContext) === contextKey(state.pageContext)
        ? state
        : { pageContext },
    ),
}));
