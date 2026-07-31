import { Document, Page, pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import type {
  ChatMessage,
  PdfSource,
  ProcessedSlidesResponse,
  SlideDocumentSummary,
} from "../types";
import { ChatPanel } from "./ChatPanel";
import { FileIcon, MenuIcon, SparkleIcon } from "./icons";
import { KnowledgePanel } from "./KnowledgePanel";
import { SlideNavigation } from "./SlideNavigation";
import { SlideViewer } from "./SlideViewer";
import { ThumbnailSidebar } from "./ThumbnailSidebar";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type TutorScreenProps = {
  documents: SlideDocumentSummary[];
  selectedDocumentId: string;
  fileName: string;
  /** null when no PDF file is available for this document (JSON-only mode) */
  pdfSource: PdfSource | null;
  currentPage: number;
  totalPages: number;
  messages: ChatMessage[];
  question: string;
  isBotTyping: boolean;
  isProcessing: boolean;
  processedSlides: ProcessedSlidesResponse | null;
  processingError: string;
  onDocumentLoad: (pdf: PDFDocumentProxy) => void;
  onSelectDocument: (documentId: string) => void;
  onSelectPage: (pageNumber: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onQuestionChange: (value: string) => void;
  onSendQuestion: (question: string) => void;
  onRetry: () => void;
};

function DocumentLoading() {
  return (
    <div className="document-state" role="status">
      <span className="spinner" />
      <strong>Đang mở tài liệu PDF...</strong>
      <p>PDF.js đang chuẩn bị trang hiển thị và lớp văn bản.</p>
    </div>
  );
}

function DocumentError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="document-state document-error" role="alert">
      <FileIcon width={38} height={38} />
      <strong>Không thể đọc tài liệu PDF</strong>
      <p>File có thể bị hỏng, được mã hóa hoặc không phải PDF hợp lệ.</p>
      <button className="button button-primary" type="button" onClick={onRetry}>
        Thử lại
      </button>
    </div>
  );
}

/** Shown when the PDF file hasn't been placed in data/slide/ yet */
function NoPdfPlaceholder({
  fileName,
  currentPage,
  totalPages,
}: {
  fileName: string;
  currentPage: number;
  totalPages: number;
}) {
  return (
    <section className="slide-viewer" aria-labelledby="current-page-title">
      <div className="viewer-label">
        <div>
          <span className="viewer-page">Trang đang đọc</span>
          <h2 id="current-page-title">Trang {currentPage} / {totalPages}</h2>
        </div>
      </div>
      <div
        className="pdf-page-stage"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "3rem 2rem",
          minHeight: 320,
        }}
      >
        <FileIcon width={52} height={52} />
        <strong style={{ fontSize: "1.05rem" }}>File PDF chưa có</strong>
        <p style={{ textAlign: "center", maxWidth: 360, color: "var(--text-muted, #888)", lineHeight: 1.6 }}>
          Đặt file <code style={{ background: "var(--surface-2,#222)", padding: "2px 6px", borderRadius: 4 }}>
            {fileName}
          </code> vào thư mục <code style={{ background: "var(--surface-2,#222)", padding: "2px 6px", borderRadius: 4 }}>
            data/slide/
          </code> rồi khởi động lại server.
        </p>
        <p style={{ textAlign: "center", color: "var(--text-muted,#888)", fontSize: "0.85rem" }}>
          AI Tutor vẫn hoạt động bình thường — nội dung bài học đã được tải từ JSON.
        </p>
      </div>
    </section>
  );
}

/** Simple page-number button strip — replaces PDF thumbnail sidebar when no PDF */
function TextThumbnailSidebar({
  totalPages,
  currentPage,
  onSelect,
}: {
  totalPages: number;
  currentPage: number;
  onSelect: (page: number) => void;
}) {
  return (
    <aside className="thumbnail-sidebar" aria-label="Danh sách trang">
      <div className="sidebar-heading"><span>Các trang</span><span>{totalPages}</span></div>
      <div className="thumbnail-list">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
          const isActive = page === currentPage;
          return (
            <button
              key={page}
              type="button"
              className={`thumbnail-item${isActive ? " is-active" : ""}`}
              onClick={() => onSelect(page)}
              aria-current={isActive ? "page" : undefined}
              aria-label={`Mở trang ${page}`}
            >
              <span
                className="thumbnail-image-wrap"
                aria-hidden="true"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--surface-2,#1e1e2e)",
                  minHeight: 90,
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: isActive ? "var(--accent,#7c6af7)" : "var(--text-muted,#666)",
                }}
              >
                {page}
              </span>
              <span className="thumbnail-number">Trang {page}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export function TutorScreen({
  documents,
  selectedDocumentId,
  fileName,
  pdfSource,
  currentPage,
  totalPages,
  messages,
  question,
  isBotTyping,
  isProcessing,
  processedSlides,
  processingError,
  onDocumentLoad,
  onSelectDocument,
  onSelectPage,
  onPrevious,
  onNext,
  onQuestionChange,
  onSendQuestion,
  onRetry,
}: TutorScreenProps) {
  const hasPdf = pdfSource !== null;

  const sidebar = hasPdf ? (
    <ThumbnailSidebar
      totalPages={totalPages}
      currentPage={currentPage}
      onSelect={onSelectPage}
      PageComponent={Page}
    />
  ) : (
    <TextThumbnailSidebar
      totalPages={totalPages}
      currentPage={currentPage}
      onSelect={onSelectPage}
    />
  );

  const slideContent = hasPdf ? (
    <SlideViewer pageNumber={currentPage} PageComponent={Page} />
  ) : (
    <NoPdfPlaceholder
      fileName={fileName}
      currentPage={currentPage}
      totalPages={totalPages}
    />
  );

  const layout = (
    <div className="learning-layout">
      {sidebar}
      <div className="viewer-column">
        <KnowledgePanel
          processedSlides={processedSlides}
          isProcessing={isProcessing}
          error={processingError}
          onRetry={onRetry}
        />
        {slideContent}
        <SlideNavigation
          currentPage={currentPage}
          totalPages={totalPages}
          onPrevious={onPrevious}
          onNext={onNext}
        />
      </div>
      <ChatPanel
        pageNumber={currentPage}
        messages={messages}
        question={question}
        isBotTyping={isBotTyping}
        isKnowledgeReady={Boolean(processedSlides)}
        ingestionFailed={Boolean(processingError)}
        onQuestionChange={onQuestionChange}
        onSend={onSendQuestion}
        onCitationClick={onSelectPage}
      />
    </div>
  );

  return (
    <main className="tutor-screen">
      <header className="app-header">
        <div className="app-brand">
          <span className="small-brand-mark"><SparkleIcon /></span>
          <div><strong>Slidewise</strong><span>AI PDF TUTOR</span></div>
        </div>
        <div className="file-heading" title={fileName}>
          <FileIcon />
          {documents.length > 1 ? (
            <select
              aria-label="Chọn tài liệu"
              value={selectedDocumentId}
              onChange={(event) => onSelectDocument(event.target.value)}
            >
              {documents.map((document) => (
                <option key={document.id} value={document.id}>{document.filename}</option>
              ))}
            </select>
          ) : <span>{fileName}</span>}
          {totalPages > 0 && <small>{totalPages} trang</small>}
        </div>
        <div className="backend-source"><span className="status-dot" />data/processed</div>
      </header>

      <div className="mobile-document-bar">
        <MenuIcon /><span>{fileName}</span>
        {totalPages > 0 && <small>{totalPages} trang</small>}
      </div>

      {hasPdf ? (
        <Document
          className="pdf-document"
          file={pdfSource}
          loading={<DocumentLoading />}
          error={<DocumentError onRetry={onRetry} />}
          onLoadSuccess={onDocumentLoad}
        >
          {layout}
        </Document>
      ) : (
        <div className="pdf-document">
          {layout}
        </div>
      )}
    </main>
  );
}
