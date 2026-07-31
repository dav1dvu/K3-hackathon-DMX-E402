import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import type {
  ChatMessage as ChatMessageType,
  DayRecord,
  DocumentKnowledge,
  IngestionProgress,
  MaterialRecord,
  PdfSource,
  QueryScope,
} from "../types";
import { materialFileUrl } from "../services/libraryApi";
import { ChatPanel } from "./ChatPanel";
import { CourseTree } from "./CourseTree";
import {
  BookIcon,
  DownloadIcon,
  FileIcon,
  HighlighterIcon,
  LogoutIcon,
  PenIcon,
  TrashIcon,
  UndoIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "./icons";
import { KnowledgePanel } from "./KnowledgePanel";
import { SlideNavigation } from "./SlideNavigation";
import { SlideViewer } from "./SlideViewer";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.8;
const ZOOM_STEP = 0.1;

type TutorScreenProps = {
  studentName: string;
  days: DayRecord[];
  isLibraryLoading: boolean;
  libraryError: string;
  activeDay: DayRecord | null;
  activeMaterial: MaterialRecord | null;
  pdfSource: PdfSource | null;
  currentPage: number;
  totalPages: number;
  messages: ChatMessageType[];
  allMessages: ChatMessageType[];
  question: string;
  scope: QueryScope;
  isBotTyping: boolean;
  knowledge: DocumentKnowledge | null;
  ingestionProgress: IngestionProgress | null;
  ingestionError: string;
  onSelectMaterial: (day: DayRecord, material: MaterialRecord) => void;
  onDocumentLoad: (pdf: PDFDocumentProxy) => void;
  onPrevious: () => void;
  onNext: () => void;
  onScopeChange: (scope: QueryScope) => void;
  onQuestionChange: (value: string) => void;
  onSendQuestion: (question: string) => void;
  onAskAboutSelection: (selectedText: string) => void;
  onLogout: () => void;
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

function DocumentError() {
  return (
    <div className="document-state document-error" role="alert">
      <FileIcon width={38} height={38} />
      <strong>Không thể đọc tài liệu PDF</strong>
      <p>File có thể bị hỏng. Hãy chọn tài liệu khác trong danh sách bên trái.</p>
    </div>
  );
}

function EmptyReadingState() {
  return (
    <div className="document-state">
      <BookIcon width={38} height={38} />
      <strong>Chọn một tài liệu để bắt đầu học</strong>
      <p>Mở một buổi học ở danh sách bên trái để đọc tài liệu và hỏi AI Agent.</p>
    </div>
  );
}

export function TutorScreen({
  studentName,
  days,
  isLibraryLoading,
  libraryError,
  activeDay,
  activeMaterial,
  pdfSource,
  currentPage,
  totalPages,
  messages,
  allMessages,
  question,
  scope,
  isBotTyping,
  knowledge,
  ingestionProgress,
  ingestionError,
  onSelectMaterial,
  onDocumentLoad,
  onPrevious,
  onNext,
  onScopeChange,
  onQuestionChange,
  onSendQuestion,
  onAskAboutSelection,
  onLogout,
}: TutorScreenProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [zoom, setZoom] = useState(1);

  const noteCount = allMessages.filter((message) => (
    message.role === "user" && message.scope === "current_page" && message.pageNumber === currentPage
  )).length;

  return (
    <main className="tutor-screen">
      <header className="app-header">
        <div className="app-brand">
          <span className="small-brand-mark"><BookIcon /></span>
          <div><strong>VLearn</strong><span>AI STUDY ASSISTANT</span></div>
        </div>
        <div className="file-heading" title={activeMaterial?.displayName ?? ""}>
          <FileIcon />
          <span>{activeMaterial ? activeMaterial.displayName : "Chưa chọn tài liệu"}</span>
          {activeDay && <small>{activeDay.title}{totalPages > 0 ? ` · ${totalPages} trang` : ""}</small>}
        </div>
        <div className="header-identity">
          <span>{studentName}</span>
          <button className="reset-button" type="button" onClick={onLogout}>
            <LogoutIcon /><span>Đăng xuất</span>
          </button>
        </div>
      </header>

      <div className="learning-layout">
        <CourseTree
          days={days}
          activeMaterialId={activeMaterial?.id}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
          onSelectMaterial={onSelectMaterial}
          emptyLabel={isLibraryLoading ? "Đang tải học liệu..." : (libraryError || "Chưa có tài liệu nào được xuất bản.")}
        />

        <div className="viewer-column">
          {activeMaterial && (
            <div className="reading-toolbar">
              <div className="tool-tabs" role="tablist" aria-label="Chế độ đọc">
                <button type="button" className="tool-tab is-active" aria-pressed>Đọc</button>
                <button type="button" className="tool-tab" disabled title="Sắp ra mắt">
                  <PenIcon width={15} height={15} />Bút
                </button>
                <button type="button" className="tool-tab" disabled title="Sắp ra mắt">
                  <HighlighterIcon width={15} height={15} />Highlight
                </button>
              </div>
              <div className="tool-page-note">Trang {currentPage} · {noteCount} note</div>
              <div className="tool-zoom">
                <button
                  type="button"
                  onClick={() => setZoom((value) => Math.max(ZOOM_MIN, Number((value - ZOOM_STEP).toFixed(2))))}
                  aria-label="Thu nhỏ"
                >
                  <ZoomOutIcon width={16} height={16} />
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoom((value) => Math.min(ZOOM_MAX, Number((value + ZOOM_STEP).toFixed(2))))}
                  aria-label="Phóng to"
                >
                  <ZoomInIcon width={16} height={16} />
                </button>
              </div>
              <div className="tool-actions">
                <a
                  className="icon-button"
                  href={materialFileUrl(activeMaterial.id)}
                  download={`${activeMaterial.displayName}.pdf`}
                  aria-label="Tải file PDF"
                >
                  <DownloadIcon width={17} height={17} />
                </a>
                <button type="button" className="icon-button" disabled title="Sắp ra mắt" aria-label="Hoàn tác">
                  <UndoIcon width={17} height={17} />
                </button>
                <button type="button" className="icon-button icon-button-danger" disabled title="Sắp ra mắt" aria-label="Xoá">
                  <TrashIcon width={17} height={17} />
                </button>
              </div>
            </div>
          )}

          {!activeMaterial || !pdfSource ? (
            <EmptyReadingState />
          ) : (
            <Document
              className="pdf-document"
              file={pdfSource}
              loading={<DocumentLoading />}
              error={<DocumentError />}
              onLoadSuccess={onDocumentLoad}
            >
              <KnowledgePanel knowledge={knowledge} progress={ingestionProgress} error={ingestionError} />
              <SlideViewer
                pageNumber={currentPage}
                zoom={zoom}
                PageComponent={Page}
                onAskAboutSelection={onAskAboutSelection}
              />
              <SlideNavigation
                currentPage={currentPage}
                totalPages={totalPages}
                onPrevious={onPrevious}
                onNext={onNext}
              />
            </Document>
          )}
        </div>

        <ChatPanel
          pageNumber={currentPage}
          messages={messages}
          question={question}
          scope={scope}
          isBotTyping={isBotTyping}
          isKnowledgeReady={Boolean(knowledge)}
          ingestionFailed={Boolean(ingestionError)}
          onScopeChange={onScopeChange}
          onQuestionChange={onQuestionChange}
          onSend={onSendQuestion}
        />
      </div>
    </main>
  );
}
