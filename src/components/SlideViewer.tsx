import { useEffect, useRef, useState, type ComponentType } from "react";
import type { PageProps } from "react-pdf";
import { SelectionAskPopover } from "./SelectionAskPopover";

type SlideViewerProps = {
  pageNumber: number;
  zoom: number;
  PageComponent: ComponentType<PageProps>;
  onAskAboutSelection: (selectedText: string) => void;
};

export function SlideViewer({ pageNumber, zoom, PageComponent, onAskAboutSelection }: SlideViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [baseWidth, setBaseWidth] = useState(760);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const availableWidth = Math.max(280, container.clientWidth - 32);
      setBaseWidth(Math.min(920, availableWidth));
    };

    updateWidth();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="slide-viewer" aria-labelledby="current-page-title">
      <div className="viewer-label">
        <div>
          <span className="viewer-page">Trang đang đọc</span>
          <h2 id="current-page-title">Trang {pageNumber}</h2>
        </div>
        <span className="copy-hint">Bôi đen văn bản để hỏi AI hoặc sao chép</span>
      </div>
      <div className="pdf-page-stage" ref={containerRef}>
        <PageComponent
          pageNumber={pageNumber}
          width={baseWidth * zoom}
          renderTextLayer
          renderAnnotationLayer
          loading={<div className="page-loading" role="status"><span className="spinner" />Đang dựng trang...</div>}
          error={<div className="page-error" role="alert">Không thể hiển thị trang {pageNumber}.</div>}
        />
        <SelectionAskPopover containerRef={containerRef} onAsk={onAskAboutSelection} />
      </div>
    </section>
  );
}
