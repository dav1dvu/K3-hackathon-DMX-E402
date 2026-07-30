import { useEffect, useMemo, useRef, useState } from "react";
import { TutorScreen } from "./components/TutorScreen";
import { UploadScreen } from "./components/UploadScreen";
import type { AppScreen, ChatMessage, PdfSource } from "./types";

const PROCESSING_DELAY_MS = 1000;
const BOT_TYPING_DELAY_MS = 800;
const SAMPLE_FILE_NAME = "Strategyn JTBD Playbook.pdf";
const SAMPLE_FILE_URL = "/sample-document.pdf";

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildMockAnswer(pageNumber: number, question: string) {
  return `Theo nội dung đang hiển thị ở trang ${pageNumber}, đây là câu trả lời mô phỏng cho câu hỏi “${question}”. Bạn có thể đối chiếu trực tiếp với phần văn bản trên trang này.`;
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("upload");
  const [pdfSource, setPdfSource] = useState<PdfSource | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [typingPages, setTypingPages] = useState<number[]>([]);
  const timeoutsRef = useRef<number[]>([]);

  const currentPageMessages = useMemo(
    () => messages.filter((message) => message.pageNumber === currentPage),
    [currentPage, messages],
  );

  useEffect(
    () => () => {
      timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    },
    [],
  );

  const startDocument = (name: string, source: PdfSource) => {
    setPdfSource(source);
    setDocumentName(name);
    setIsProcessing(true);
    const timeoutId = window.setTimeout(() => {
      setIsProcessing(false);
      setScreen("tutor");
    }, PROCESSING_DELAY_MS);
    timeoutsRef.current.push(timeoutId);
  };

  const selectPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    setQuestion("");
  };

  const handleSendQuestion = (submittedQuestion: string) => {
    const pageAtSendTime = currentPage;
    const userMessage: ChatMessage = {
      id: createMessageId("user"),
      pageNumber: pageAtSendTime,
      role: "user",
      content: submittedQuestion,
    };
    setMessages((previous) => [...previous, userMessage]);
    setQuestion("");
    setTypingPages((previous) => [...previous, pageAtSendTime]);

    const timeoutId = window.setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: createMessageId("assistant"),
        pageNumber: pageAtSendTime,
        role: "assistant",
        content: buildMockAnswer(pageAtSendTime, submittedQuestion),
      };
      setMessages((previous) => [...previous, assistantMessage]);
      setTypingPages((previous) =>
        previous.filter((pageNumber) => pageNumber !== pageAtSendTime),
      );
    }, BOT_TYPING_DELAY_MS);
    timeoutsRef.current.push(timeoutId);
  };

  const resetApplication = () => {
    timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutsRef.current = [];
    setScreen("upload");
    setPdfSource(null);
    setDocumentName("");
    setIsProcessing(false);
    setCurrentPage(1);
    setTotalPages(0);
    setMessages([]);
    setQuestion("");
    setTypingPages([]);
  };

  if (screen === "upload") {
    return (
      <UploadScreen
        isProcessing={isProcessing}
        processingFileName={documentName}
        onFileSelected={(selectedFile) => startDocument(selectedFile.name, selectedFile)}
        onUseSample={() => startDocument(SAMPLE_FILE_NAME, SAMPLE_FILE_URL)}
      />
    );
  }

  return (
    <TutorScreen
      fileName={documentName}
      pdfSource={pdfSource}
      currentPage={currentPage}
      totalPages={totalPages}
      currentPageMessages={currentPageMessages}
      question={question}
      isBotTyping={typingPages.includes(currentPage)}
      onDocumentLoad={(pageCount) => {
        setTotalPages(pageCount);
        setCurrentPage((page) => Math.min(page, pageCount));
      }}
      onSelectPage={selectPage}
      onPrevious={() => selectPage(Math.max(1, currentPage - 1))}
      onNext={() => selectPage(Math.min(totalPages, currentPage + 1))}
      onQuestionChange={setQuestion}
      onSendQuestion={handleSendQuestion}
      onReset={resetApplication}
    />
  );
}
