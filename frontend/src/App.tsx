import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { TutorScreen } from "./components/TutorScreen";
import {
  askTutor,
  getProcessedSlides,
  listSlideDocuments,
} from "./services/tutorApi";
import type {
  ChatMessage,
  ProcessedSlidesResponse,
  SlideDocumentSummary,
} from "./types";

type LoadingState = "discovering" | "processing" | "ready" | "empty" | "error";

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  const [documents, setDocuments] = useState<SlideDocumentSummary[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [processedSlides, setProcessedSlides] = useState<ProcessedSlidesResponse | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("discovering");
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [isBotTyping, setIsBotTyping] = useState(false);
  const documentRunRef = useRef(0);
  const chatRunRef = useRef(0);

  const selectedDocument = documents.find(({ id }) => id === selectedDocumentId) ?? null;

  const openDocument = useCallback(async (document: SlideDocumentSummary) => {
    const runId = ++documentRunRef.current;
    chatRunRef.current += 1;
    setSelectedDocumentId(document.id);
    setProcessedSlides(null);
    setLoadingState("processing");
    setError("");
    setCurrentPage(1);
    setTotalPages(0);
    setMessages([]);
    setQuestion("");
    setIsBotTyping(false);
    try {
      const payload = await getProcessedSlides(document.id);
      if (documentRunRef.current !== runId) return;
      setProcessedSlides(payload);
      setTotalPages(payload.total_pages);
      setLoadingState("ready");
    } catch (caught) {
      if (documentRunRef.current !== runId) return;
      setLoadingState("error");
      setError(caught instanceof Error ? caught.message : "Không thể xử lý tài liệu PDF.");
    }
  }, []);

  const discoverDocuments = useCallback(async () => {
    const runId = ++documentRunRef.current;
    setLoadingState("discovering");
    setError("");
    try {
      const discovered = await listSlideDocuments();
      if (documentRunRef.current !== runId) return;
      setDocuments(discovered);
      if (!discovered.length) {
        setLoadingState("empty");
        return;
      }
      await openDocument(discovered[0]);
    } catch (caught) {
      if (documentRunRef.current !== runId) return;
      setLoadingState("error");
      setError(caught instanceof Error ? caught.message : "Không thể tìm tài liệu PDF.");
    }
  }, [openDocument]);

  useEffect(() => {
    void discoverDocuments();
    return () => {
      documentRunRef.current += 1;
      chatRunRef.current += 1;
    };
  }, [discoverDocuments]);

  const handleDocumentLoad = useCallback((pdf: PDFDocumentProxy) => {
    setTotalPages(pdf.numPages);
    setCurrentPage((page) => Math.max(1, Math.min(page, pdf.numPages)));
  }, []);

  const selectPage = (pageNumber: number) => {
    if (totalPages < 1) return;
    setCurrentPage(Math.max(1, Math.min(pageNumber, totalPages)));
  };

  const handleSendQuestion = (submittedQuestion: string) => {
    if (!selectedDocument || loadingState !== "ready" || isBotTyping) return;
    const runId = chatRunRef.current;
    const pageAtSendTime = currentPage;
    const historyAtSendTime = messages;
    const userMessage: ChatMessage = {
      id: createMessageId("user"),
      pageNumber: pageAtSendTime,
      scope: "current_page",
      role: "user",
      content: submittedQuestion,
    };
    setMessages((previous) => [...previous, userMessage]);
    setQuestion("");
    setIsBotTyping(true);

    void askTutor({
      documentId: selectedDocument.id,
      currentPage: pageAtSendTime,
      question: submittedQuestion,
      history: historyAtSendTime,
    }).then((answer) => {
      if (chatRunRef.current !== runId) return;
      setMessages((previous) => [...previous, {
        id: createMessageId("assistant"),
        pageNumber: pageAtSendTime,
        scope: "current_page",
        role: "assistant",
        content: answer.answer,
        status: answer.insufficient_context ? "insufficient_context" : "answered",
        citations: answer.citations,
      }]);
    }).catch((caught) => {
      if (chatRunRef.current !== runId) return;
      setMessages((previous) => [...previous, {
        id: createMessageId("assistant"),
        pageNumber: pageAtSendTime,
        scope: "current_page",
        role: "assistant",
        content: caught instanceof Error
          ? caught.message
          : "Không thể kết nối tới mô hình ngôn ngữ. Vui lòng thử lại sau.",
        status: "insufficient_context",
        citations: [],
      }]);
    }).finally(() => {
      if (chatRunRef.current === runId) setIsBotTyping(false);
    });
  };

  if (loadingState === "discovering") {
    return (
      <main className="standalone-state" role="status">
        <span className="spinner" />
        <h1>Đang tìm tài liệu PDF...</h1>
        <p>Backend đang kiểm tra thư mục data/slide.</p>
      </main>
    );
  }

  if (loadingState === "empty") {
    return (
      <main className="standalone-state" role="status">
        <h1>Chưa có tài liệu</h1>
        <p>Không tìm thấy tài liệu PDF trong thư mục data/slide.</p>
        <button className="button button-primary" type="button" onClick={() => void discoverDocuments()}>
          Kiểm tra lại
        </button>
      </main>
    );
  }

  if (!selectedDocument) {
    return (
      <main className="standalone-state" role="alert">
        <h1>Không thể mở tài liệu</h1>
        <p>{error || "Danh sách tài liệu không hợp lệ."}</p>
        <button className="button button-primary" type="button" onClick={() => void discoverDocuments()}>
          Thử lại
        </button>
      </main>
    );
  }

  return (
    <TutorScreen
      documents={documents}
      selectedDocumentId={selectedDocument.id}
      fileName={selectedDocument.filename}
      pdfSource={selectedDocument.url}
      currentPage={currentPage}
      totalPages={totalPages}
      messages={messages}
      question={question}
      isBotTyping={isBotTyping}
      isProcessing={loadingState === "processing"}
      processedSlides={processedSlides}
      processingError={loadingState === "error" ? error : ""}
      onDocumentLoad={handleDocumentLoad}
      onSelectDocument={(documentId) => {
        const document = documents.find(({ id }) => id === documentId);
        if (document) void openDocument(document);
      }}
      onSelectPage={selectPage}
      onPrevious={() => selectPage(currentPage - 1)}
      onNext={() => selectPage(currentPage + 1)}
      onQuestionChange={setQuestion}
      onSendQuestion={handleSendQuestion}
      onRetry={() => void openDocument(selectedDocument)}
    />
  );
}

