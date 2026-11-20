import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Layers,
  Minus,
  Plus,
  ScanLine,
  Sparkles,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { getMaterial } from "../../api/client";
import type { SourceContext } from "../../api/contracts";
import { getMaterialUnit } from "../courses/activities";
import {
  recordResume,
  sourceHref,
  toolHref,
} from "../learning/sourceNavigation";
import { useMiaStore } from "../mia/store";
import { ReviewPractice } from "./ReviewPractice";
import "react-pdf/dist/Page/TextLayer.css";
import "./material.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).href;

const zoomLevels = [75, 100, 125, 150];
const pageTitles = ["知识回顾", "例题精讲", "巩固练习"];

export function MaterialPage() {
  const { courseId, materialId } = useParams();
  const { hash, key: locationKey } = useLocation();
  const [params, setParams] = useSearchParams();
  const [zoom, setZoom] = useState(100);
  const [showOcr, setShowOcr] = useState(false);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(500);
  const [exerciseAnchor, setExerciseAnchor] =
    useState<HTMLButtonElement | null>(null);
  const setPageContext = useMiaStore((state) => state.setPageContext);
  const setContext = useMiaStore((state) => state.setContext);
  const setOpen = useMiaStore((state) => state.setOpen);
  const materialQuery = useQuery({
    queryKey: ["material", materialId],
    queryFn: () => getMaterial(materialId ?? ""),
    enabled: Boolean(materialId),
  });
  const material =
    materialQuery.data?.courseId === courseId ? materialQuery.data : undefined;
  const reviewTaskId = params.get("reviewTask");
  const rawPage = Number(params.get("page"));
  const page =
    material && Number.isInteger(rawPage) && rawPage > 0
      ? Math.min(rawPage, material.pageCount)
      : (material?.exercisePage ?? 1);
  const selected = Boolean(
    material &&
    page === material.exercisePage &&
    params.get("selection") === material.exercise.id,
  );
  const unitId = material && getMaterialUnit(material.courseId, material.id);
  const source = useMemo<SourceContext | undefined>(
    () =>
      material && {
        courseId: material.courseId,
        unitId,
        materialId: material.id,
        materialTitle: material.title,
        page,
        ...(selected
          ? {
              selectionId: material.exercise.id,
              selectionText: material.exercise.equation,
            }
          : {}),
      },
    [material, page, selected, unitId],
  );

  useEffect(() => {
    if (!source) return;
    setPageContext(source);
    return () => setPageContext(null);
  }, [source, setPageContext]);

  useEffect(() => {
    if (source && !reviewTaskId) recordResume(source);
  }, [reviewTaskId, source]);

  useEffect(() => {
    if (!selected || !exerciseAnchor || hash !== "#material-exercise") return;
    exerciseAnchor.focus({ preventScroll: true });
    exerciseAnchor.scrollIntoView({ block: "center", inline: "nearest" });
  }, [exerciseAnchor, hash, locationKey, selected]);

  useEffect(() => {
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setViewportWidth(entry.contentRect.width);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [viewport]);

  if (materialQuery.isPending && materialId) {
    return (
      <section className="page-content">
        <p role="status">正在打开讲义…</p>
      </section>
    );
  }
  if (!material || !source) {
    return (
      <section className="page-content">
        <h1 className="page-title">资料暂时不可用</h1>
        <p className="page-subtitle">请回到课程重新打开资料。</p>
        <Link className="material-back" to="/courses">
          <ArrowLeft size={16} />
          返回课程
        </Link>
      </section>
    );
  }

  const goToPage = (nextPage: number) => {
    if (
      !Number.isInteger(nextPage) ||
      nextPage < 1 ||
      nextPage > material.pageCount ||
      nextPage === page
    )
      return;
    const next = new URLSearchParams(params);
    next.set("page", String(nextPage));
    next.delete("selection");
    setShowOcr(false);
    setParams(next);
    viewport?.scrollTo({ top: 0, left: 0 });
  };
  const selectExercise = () => {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    if (selected) {
      next.delete("selection");
      setShowOcr(false);
    } else {
      next.set("selection", material.exercise.id);
    }
    setParams(next, { replace: true });
  };

  const adjustZoom = (offset: -1 | 1) => {
    setZoom(
      (current) => zoomLevels[zoomLevels.indexOf(current) + offset] ?? current,
    );
  };
  return (
    <section className="page-content material-page">
      <nav className="material-return" aria-label="资料导航">
        <Link
          className="material-back"
          to={sourceHref({ courseId: material.courseId })}
        >
          <ArrowLeft size={16} aria-hidden="true" /> 返回课程
        </Link>
        {unitId && !reviewTaskId ? (
          <Link
            className="material-back"
            to={sourceHref({ courseId: material.courseId, unitId })}
          >
            <BookOpen size={16} aria-hidden="true" /> 返回单元
          </Link>
        ) : null}
      </nav>
      <div className="material-heading">
        <span className="material-heading__icon">
          <FileText size={23} aria-hidden="true" />
        </span>
        <div>
          <span className="material-heading__kicker">课程资料</span>
          <h1 className="page-title">{material.title}</h1>
          <p className="page-subtitle">
            数学 · 纸面讲义 · {material.pageCount} 页
          </p>
        </div>
      </div>
      {reviewTaskId && (
        <div className="material-review">
          <ReviewPractice taskId={reviewTaskId} source={source} />
        </div>
      )}
      <div className="material-layout">
        <div className="material-reader surface-card">
          <div className="material-toolbar" aria-label="阅读工具">
            <div className="material-toolbar__group">
              <button
                type="button"
                className="material-tool"
                aria-label="上一页"
                title="上一页"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <span
                className="material-toolbar__count"
                aria-label={`第 ${page} 页，共 ${material.pageCount} 页`}
              >
                {page} / {material.pageCount}
              </span>
              <button
                type="button"
                className="material-tool"
                aria-label="下一页"
                title="下一页"
                disabled={page >= material.pageCount}
                onClick={() => goToPage(page + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="material-toolbar__group">
              <button
                type="button"
                className="material-tool"
                aria-label="缩小"
                title="缩小"
                disabled={zoom === zoomLevels[0]}
                onClick={() => adjustZoom(-1)}
              >
                <Minus size={17} />
              </button>
              <button
                type="button"
                className="material-toolbar__count material-tool"
                aria-label={`当前缩放 ${zoom}%，重置缩放`}
                title="重置缩放"
                onClick={() => setZoom(100)}
              >
                {zoom}%
              </button>
              <button
                type="button"
                className="material-tool"
                aria-label="放大"
                title="放大"
                disabled={zoom === zoomLevels.at(-1)}
                onClick={() => adjustZoom(1)}
              >
                <Plus size={17} />
              </button>
            </div>
            <a
              className="material-tool material-toolbar__download"
              href={material.fileUrl}
              download={material.title}
              title="下载 PDF"
              aria-label="下载 PDF"
            >
              <Download size={17} />
            </a>
          </div>
          <Document
            file={material.fileUrl}
            className="material-document"
            loading={
              <p className="material-pdf-status" role="status">
                正在加载 PDF…
              </p>
            }
            error={
              <p className="material-pdf-status" role="alert">
                PDF 加载失败。<a href={material.fileUrl}>直接打开文件</a>
              </p>
            }
          >
            <nav className="material-thumbnails" aria-label="讲义页码">
              {Array.from({ length: material.pageCount }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  className="material-thumbnail"
                  aria-current={page === index + 1 ? "page" : undefined}
                  aria-label={`打开第 ${index + 1} 页`}
                  onClick={() => goToPage(index + 1)}
                >
                  <Page
                    pageNumber={index + 1}
                    width={55}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    loading={null}
                    aria-hidden="true"
                  />
                  <span>{index + 1}</span>
                </button>
              ))}
            </nav>
            <div
              className="material-viewport"
              ref={setViewport}
              tabIndex={0}
              aria-label="PDF 阅读区"
            >
              <div
                className="material-paper"
                style={{
                  width: Math.round(
                    (Math.min(viewportWidth, 650) * zoom) / 100,
                  ),
                }}
              >
                <Page
                  pageNumber={page}
                  width={Math.round(
                    (Math.min(viewportWidth, 650) * zoom) / 100,
                  )}
                  renderAnnotationLayer={false}
                  loading={null}
                />
                {page === material.exercisePage && (
                  <button
                    type="button"
                    id="material-exercise"
                    ref={setExerciseAnchor}
                    className="material-anchor"
                    aria-label={`选择${material.exercise.label}`}
                    aria-pressed={selected}
                    title={`选择${material.exercise.label}`}
                    onClick={selectExercise}
                  >
                    <span>
                      <ScanLine size={14} />
                      {selected ? "已选中" : "选择例题"}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </Document>
        </div>
        <aside className="material-sidebar" aria-label="资料上下文">
          <div className="material-current surface-card">
            <p className="material-card-title">
              <FileText size={17} />
              当前页
            </p>
            <p className="material-current__value">
              第 {page} 页 · {pageTitles[page - 1] ?? "课程资料"}
            </p>
          </div>
          <div className="material-selection surface-card">
            <p className="material-card-title">
              <ScanLine size={17} />
              资料选区
            </p>
            {selected ? (
              <>
                <p className="material-selection__label">
                  第 {page} 页 · {material.exercise.label}
                </p>
                <p className="material-selection__equation">
                  {material.exercise.equation}
                </p>
                <button
                  type="button"
                  className="material-text-button"
                  aria-expanded={showOcr}
                  onClick={() => setShowOcr((value) => !value)}
                >
                  {showOcr ? "收起文字识别" : "文字识别（模拟）"}
                </button>
                {showOcr && (
                  <p className="material-ocr">
                    {material.exercise.prompt} {material.exercise.equation}
                  </p>
                )}
              </>
            ) : (
              <p className="page-subtitle">
                {page === material.exercisePage
                  ? "暂无选区。"
                  : "本页暂无例题选区。"}
              </p>
            )}
            {selected && !reviewTaskId && (
              <button
                type="button"
                className="action-primary material-ask"
                onClick={() => {
                  setContext(source);
                  setOpen(true);
                }}
              >
                <Sparkles size={16} />与 Mia 讨论
              </button>
            )}
          </div>
          {!reviewTaskId ? (
            <div className="material-selection material-reader-actions surface-card">
              <p className="material-card-title">
                <Layers size={17} aria-hidden="true" /> 从
                {selected ? "例题" : "当前页"}制作
              </p>
              <div className="material-reader-actions__links">
                <Link
                  className="material-text-button"
                  to={toolHref("summary", source)}
                >
                  生成摘要
                </Link>
                <Link
                  className="material-text-button"
                  to={toolHref("flashcards", source)}
                >
                  制作闪卡
                </Link>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
