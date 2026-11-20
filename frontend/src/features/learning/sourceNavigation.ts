import type { SourceContext } from "../../api/contracts";
import { activitySource, getUnitLearning } from "../courses/activities";

const resumeKey = "aixueji.learning-resume.v1";

export function sourceHref(
  source: SourceContext,
  {
    reviewTaskId,
    focusSelection = false,
  }: {
    reviewTaskId?: string;
    focusSelection?: boolean;
  } = {},
) {
  const course = `/courses/${encodeURIComponent(source.courseId)}`;
  const query = new URLSearchParams();
  if (source.materialId) {
    if (source.page) query.set("page", String(source.page));
    if (source.selectionId) query.set("selection", source.selectionId);
    if (reviewTaskId) query.set("reviewTask", reviewTaskId);
    const hash =
      focusSelection && source.selectionId ? "#material-exercise" : "";
    return `${course}/materials/${encodeURIComponent(source.materialId)}${query.size ? `?${query}` : ""}${hash}`;
  }
  if (!source.unitId) return course;
  const unit = getUnitLearning(source.courseId, source.unitId);
  if (source.activityId && source.activityId === unit?.practice.id)
    query.set("tab", "practice");
  if (source.activityId && source.activityId === unit?.world?.id)
    query.set("tab", "world");
  return `${course}/units/${encodeURIComponent(source.unitId)}${query.size ? `?${query}` : ""}`;
}

export function toolHref(toolId: string, source: SourceContext) {
  const params = new URLSearchParams({
    tool: toolId,
    courseId: source.courseId,
  });
  if (source.unitId) params.set("unitId", source.unitId);
  if (source.activityId) params.set("activityId", source.activityId);
  if (source.materialId) params.set("materialId", source.materialId);
  if (source.page) params.set("page", String(source.page));
  if (source.selectionId) params.set("selection", source.selectionId);
  return `/tools?${params}`;
}

export function sourceFromSearch(
  params: URLSearchParams,
): SourceContext | undefined {
  const courseId = params.get("courseId");
  if (!courseId) return;
  const unitId = params.get("unitId") || undefined;
  const materialId = params.get("materialId") || undefined;
  const activityId = params.get("activityId") || undefined;
  if (!materialId && unitId && activityId) {
    const learning = getUnitLearning(courseId, unitId);
    const activity = [learning?.practice, learning?.world].find(
      (item) => item?.id === activityId,
    );
    if (activity) return activitySource(courseId, unitId, activity);
  }
  const page = Number(params.get("page"));
  return {
    courseId,
    unitId,
    ...(materialId
      ? {
          materialId,
          page: Number.isSafeInteger(page) && page > 0 ? page : undefined,
          selectionId: params.get("selection") || undefined,
        }
      : {}),
  };
}

export function recordResume(source: SourceContext) {
  try {
    localStorage.setItem(resumeKey, JSON.stringify(source));
  } catch {
    // Browser storage is optional; learning routes still work without it.
  }
}

export function readResume(): SourceContext | undefined {
  try {
    const stored = localStorage.getItem(resumeKey);
    if (!stored) return;
    const source = JSON.parse(stored) as Partial<
      Record<keyof SourceContext, unknown>
    > | null;
    if (
      !source ||
      typeof source !== "object" ||
      typeof source.courseId !== "string" ||
      !source.courseId
    )
      return;
    const fields = [
      "unitId",
      "activityId",
      "activityTitle",
      "activityPrompt",
      "materialId",
      "materialTitle",
      "selectionId",
      "selectionText",
    ] as const;
    const clean: SourceContext = { courseId: source.courseId };
    for (const field of fields) {
      const value = source[field];
      if (typeof value === "string" && value) clean[field] = value;
    }
    if (
      typeof source.page === "number" &&
      Number.isSafeInteger(source.page) &&
      source.page > 0
    )
      clean.page = source.page;
    return clean;
  } catch {
    return undefined;
  }
}
