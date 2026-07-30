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
  pdfSource: PdfSource;
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
        <div className="backend-source"><span className="status-dot" />data/slide</div>
      </header>

      <div className="mobile-document-bar">
        <MenuIcon /><span>{fileName}</span>
        {totalPages > 0 && <small>{totalPages} trang</small>}
      </div>

      <Document
        className="pdf-document"
        file={pdfSource}
        loading={<DocumentLoading />}
        error={<DocumentError onRetry={onRetry} />}
        onLoadSuccess={onDocumentLoad}
      >
        <div className="learning-layout">
          <ThumbnailSidebar
            totalPages={totalPages}
            currentPage={currentPage}
            onSelect={onSelectPage}
            PageComponent={Page}
          />
          <div className="viewer-column">
            <KnowledgePanel
              processedSlides={processedSlides}
              isProcessing={isProcessing}
              error={processingError}
              onRetry={onRetry}
            />
            <SlideViewer pageNumber={currentPage} PageComponent={Page} />
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
      </Document>
    </main>
  );
}
