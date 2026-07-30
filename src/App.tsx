import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { TutorScreen } from "./components/TutorScreen";
import { UploadScreen } from "./components/UploadScreen";
import { answerFromDocument } from "./rag/grounding";
import { ingestPdfDocument } from "./rag/ingestion";
import type {
  AppScreen,
  ChatMessage,
  DocumentKnowledge,
  IngestionProgress,
  PdfSource,
  QueryScope,
} from "./types";

const PROCESSING_DELAY_MS = 1000;
const BOT_TYPING_DELAY_MS = 800;
const SAMPLE_FILE_NAME = "Strategyn JTBD Playbook.pdf";
const SAMPLE_FILE_URL = "/sample-document.pdf";

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function conversationKey(scope: QueryScope, pageNumber: number) {
  return scope === "whole_lesson" ? "whole_lesson" : `current_page:${pageNumber}`;
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("upload");
  const [pdfSource, setPdfSource] = useState<PdfSource | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scope, setScope] = useState<QueryScope>("current_page");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [typingKeys, setTypingKeys] = useState<string[]>([]);
  const [knowledge, setKnowledge] = useState<DocumentKnowledge | null>(null);
  const [ingestionProgress, setIngestionProgress] = useState<IngestionProgress | null>(null);
  const [ingestionError, setIngestionError] = useState("");
  const timeoutsRef = useRef<number[]>([]);
  const ingestionRunRef = useRef(0);

  const activeConversationKey = conversationKey(scope, currentPage);
  const activeMessages = useMemo(
    () => messages.filter((message) => (
      message.scope === scope && (scope === "whole_lesson" || message.pageNumber === currentPage)
    )),
    [currentPage, messages, scope],
  );

  useEffect(
    () => () => {
      timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      ingestionRunRef.current += 1;
    },
    [],
  );

  const startDocument = (name: string, source: PdfSource) => {
    setPdfSource(source);
    setDocumentName(name);
    setKnowledge(null);
    setIngestionError("");
    setIngestionProgress(null);
    setIsProcessing(true);
    const timeoutId = window.setTimeout(() => {
      setIsProcessing(false);
      setScreen("tutor");
    }, PROCESSING_DELAY_MS);
    timeoutsRef.current.push(timeoutId);
  };

  const handleDocumentLoad = useCallback(async (pdf: PDFDocumentProxy) => {
    const runId = ++ingestionRunRef.current;
    setTotalPages(pdf.numPages);
    setCurrentPage((page) => Math.min(page, pdf.numPages));
    setIngestionError("");
    try {
      const nextKnowledge = await ingestPdfDocument(pdf, documentName, {
        onProgress: (progress) => {
          if (ingestionRunRef.current === runId) setIngestionProgress(progress);
        },
      });
      if (ingestionRunRef.current === runId) setKnowledge(nextKnowledge);
    } catch (error) {
      console.error("Document ingestion failed", error);
      if (ingestionRunRef.current === runId) {
        setIngestionError("Không thể phân tích đầy đủ tài liệu. Hãy thử lại với file PDF khác.");
      }
    }
  }, [documentName]);

  const selectPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    setQuestion("");
  };

  const handleScopeChange = (nextScope: QueryScope) => {
    setScope(nextScope);
    setQuestion("");
  };

  const handleSendQuestion = (submittedQuestion: string) => {
    if (!knowledge) return;
    const pageAtSendTime = currentPage;
    const scopeAtSendTime = scope;
    const keyAtSendTime = conversationKey(scopeAtSendTime, pageAtSendTime);
    const userMessage: ChatMessage = {
      id: createMessageId("user"),
      pageNumber: pageAtSendTime,
      scope: scopeAtSendTime,
      role: "user",
      content: submittedQuestion,
    };
    setMessages((previous) => [...previous, userMessage]);
    setQuestion("");
    setTypingKeys((previous) => [...previous, keyAtSendTime]);

    const timeoutId = window.setTimeout(() => {
      const groundedAnswer = answerFromDocument(knowledge.index, {
        question: submittedQuestion,
        scope: scopeAtSendTime,
        currentPage: pageAtSendTime,
      });
      const assistantMessage: ChatMessage = {
        id: createMessageId("assistant"),
        pageNumber: pageAtSendTime,
        scope: scopeAtSendTime,
        role: "assistant",
        content: groundedAnswer.answer,
        sourcePages: groundedAnswer.sourcePages,
        insufficientContext: groundedAnswer.insufficientContext,
      };
      setMessages((previous) => [...previous, assistantMessage]);
      setTypingKeys((previous) => previous.filter((key) => key !== keyAtSendTime));
    }, BOT_TYPING_DELAY_MS);
    timeoutsRef.current.push(timeoutId);
  };

  const resetApplication = () => {
    timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutsRef.current = [];
    ingestionRunRef.current += 1;
    setScreen("upload");
    setPdfSource(null);
    setDocumentName("");
    setIsProcessing(false);
    setCurrentPage(1);
    setTotalPages(0);
    setScope("current_page");
    setMessages([]);
    setQuestion("");
    setTypingKeys([]);
    setKnowledge(null);
    setIngestionProgress(null);
    setIngestionError("");
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
      messages={activeMessages}
      question={question}
      scope={scope}
      isBotTyping={typingKeys.includes(activeConversationKey)}
      knowledge={knowledge}
      ingestionProgress={ingestionProgress}
      ingestionError={ingestionError}
      onDocumentLoad={handleDocumentLoad}
      onSelectPage={selectPage}
      onPrevious={() => selectPage(Math.max(1, currentPage - 1))}
      onNext={() => selectPage(Math.min(totalPages, currentPage + 1))}
      onScopeChange={handleScopeChange}
      onQuestionChange={setQuestion}
      onSendQuestion={handleSendQuestion}
      onReset={resetApplication}
    />
  );
}
