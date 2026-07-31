import type { DocumentKnowledge, IngestionProgress } from "../types";

type KnowledgePanelProps = {
  knowledge: DocumentKnowledge | null;
  progress: IngestionProgress | null;
  error: string;
};

const stageLabels: Record<IngestionProgress["stage"], string> = {
  extracting: "Đang trích xuất văn bản",
  ocr: "Đang OCR trang có chữ trong ảnh",
  indexing: "Đang tạo index toàn tài liệu",
  complete: "Phân tích hoàn tất",
};

export function KnowledgePanel({ knowledge, progress, error }: KnowledgePanelProps) {
  if (error) {
    return <div className="knowledge-status is-error" role="alert">{error}</div>;
  }

  if (!knowledge) {
    const percentage = progress?.totalPages
      ? Math.round((progress.processedPages / progress.totalPages) * 100)
      : 0;
    return (
      <div className="knowledge-status" role="status" aria-live="polite">
        <div>
          <strong>{progress ? stageLabels[progress.stage] : "Đang chuẩn bị phân tích tài liệu"}</strong>
          <span>{progress ? `Trang ${progress.currentPage}/${progress.totalPages}` : "Vui lòng chờ..."}</span>
        </div>
        <span className="knowledge-progress"><span style={{ width: `${percentage}%` }} /></span>
      </div>
    );
  }

  return (
    <details className="lesson-overview">
      <summary>
        <span><strong>Tổng quan bài học</strong><small>{knowledge.overview.title}</small></span>
        <span className="overview-ready">Đã lập index {knowledge.index.pages.length} trang</span>
      </summary>
      <div className="overview-content">
        <p>{knowledge.overview.summary}</p>
        <div className="overview-columns">
          <div><strong>Từ khóa</strong><div className="keyword-list">{knowledge.overview.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div></div>
          <div><strong>Các phần chính</strong><ul>{knowledge.overview.sections.map((section) => <li key={`${section.title}-${section.pageNumbers.join("-")}`}>{section.title} <span>Trang {section.pageNumbers.join(", ")}</span></li>)}</ul></div>
        </div>
      </div>
    </details>
  );
}
