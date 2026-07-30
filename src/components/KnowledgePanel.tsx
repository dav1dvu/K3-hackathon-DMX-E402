import type { ProcessedSlidesResponse } from "../types";

type KnowledgePanelProps = {
  processedSlides: ProcessedSlidesResponse | null;
  isProcessing: boolean;
  error: string;
  onRetry: () => void;
};

export function KnowledgePanel({
  processedSlides,
  isProcessing,
  error,
  onRetry,
}: KnowledgePanelProps) {
  if (error) {
    return (
      <div className="knowledge-status is-error" role="alert">
        <span>{error}</span>
        <button type="button" onClick={onRetry}>Thử xử lý lại</button>
      </div>
    );
  }

  if (isProcessing || !processedSlides) {
    return (
      <div className="knowledge-status" role="status" aria-live="polite">
        <div>
          <strong>Đang xử lý PDF bằng Unstructured</strong>
          <span>Kết quả sẽ được cache tại data/processed</span>
        </div>
        <span className="knowledge-progress"><span className="is-indeterminate" /></span>
      </div>
    );
  }

  const elementTypes = [...new Set(
    processedSlides.slides.flatMap((slide) => slide.element_types),
  )];
  return (
    <details className="lesson-overview">
      <summary>
        <span>
          <strong>Nội dung bài học đã sẵn sàng</strong>
          <small>{processedSlides.filename}</small>
        </span>
        <span className="overview-ready">
          {processedSlides.slides.length}/{processedSlides.total_pages} slide có văn bản
        </span>
      </summary>
      <div className="overview-content">
        <p>
          Backend đã giữ ranh giới từng trang và metadata element. Chat có thể dùng
          slide hiện tại hoặc ngữ cảnh toàn bài.
        </p>
        <div><strong>Element types</strong><div className="keyword-list">{elementTypes.map((type) => <span key={type}>{type}</span>)}</div></div>
      </div>
    </details>
  );
}
