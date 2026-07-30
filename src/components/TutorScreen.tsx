import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import type { ChatMessage, PdfSource } from "../types";
import { ChatPanel } from "./ChatPanel";
import { FileIcon, MenuIcon, RotateIcon, SparkleIcon } from "./icons";
import { SlideNavigation } from "./SlideNavigation";
import { SlideViewer } from "./SlideViewer";
import { ThumbnailSidebar } from "./ThumbnailSidebar";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type TutorScreenProps = {
  fileName: string;
  pdfSource: PdfSource | null;
  currentPage: number;
  totalPages: number;
  currentPageMessages: ChatMessage[];
  question: string;
  isBotTyping: boolean;
  onDocumentLoad: (totalPages: number) => void;
  onSelectPage: (pageNumber: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onQuestionChange: (value: string) => void;
  onSendQuestion: (question: string) => void;
  onReset: () => void;
};

function DocumentLoading() {
  return (
    <div className="document-state" role="status">
      <span className="spinner" />
      <strong>Đang mở tài liệu PDF...</strong>
      <p>PDF.js đang chuẩn bị nội dung và lớp văn bản.</p>
    </div>
  );
}

function DocumentError({ onReset }: { onReset: () => void }) {
  return (
    <div className="document-state document-error" role="alert">
      <FileIcon width={38} height={38} />
      <strong>Không thể đọc tài liệu PDF</strong>
      <p>File có thể bị hỏng, được mã hóa hoặc không phải PDF hợp lệ.</p>
      <button className="button button-primary" type="button" onClick={onReset}>
        Chọn file khác
      </button>
    </div>
  );
}

export function TutorScreen({
  fileName,
  pdfSource,
  currentPage,
  totalPages,
  currentPageMessages,
  question,
  isBotTyping,
  onDocumentLoad,
  onSelectPage,
  onPrevious,
  onNext,
  onQuestionChange,
  onSendQuestion,
  onReset,
}: TutorScreenProps) {
  return (
    <main className="tutor-screen">
      <header className="app-header">
        <div className="app-brand">
          <span className="small-brand-mark"><SparkleIcon /></span>
          <div><strong>Slidewise</strong><span>AI PDF TUTOR</span></div>
        </div>
        <div className="file-heading" title={fileName}>
          <FileIcon /><span>{fileName}</span>
          {totalPages > 0 && <small>{totalPages} trang</small>}
        </div>
        <button className="reset-button" type="button" onClick={onReset}>
          <RotateIcon /><span>Tải file khác</span>
        </button>
      </header>

      <div className="mobile-document-bar">
        <MenuIcon /><span>{fileName}</span>
        {totalPages > 0 && <small>{totalPages} trang</small>}
      </div>

      <Document
        className="pdf-document"
        file={pdfSource}
        loading={<DocumentLoading />}
        error={<DocumentError onReset={onReset} />}
        onLoadSuccess={(pdf) => onDocumentLoad(pdf.numPages)}
      >
        <div className="learning-layout">
          <ThumbnailSidebar
            totalPages={totalPages}
            currentPage={currentPage}
            onSelect={onSelectPage}
            PageComponent={Page}
          />
          <div className="viewer-column">
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
            messages={currentPageMessages}
            question={question}
            isBotTyping={isBotTyping}
            onQuestionChange={onQuestionChange}
            onSend={onSendQuestion}
          />
        </div>
      </Document>
    </main>
  );
}
