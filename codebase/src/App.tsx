import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { AdminLibraryScreen } from "./components/AdminLibraryScreen";
import { LoginScreen } from "./components/LoginScreen";
import { TutorScreen } from "./components/TutorScreen";
import { ingestPdfDocument } from "./rag/ingestion";
import * as libraryApi from "./services/libraryApi";
import { askTutor } from "./services/tutorApi";
import type {
  AppSession,
  ChatMessage,
  DayRecord,
  DocumentKnowledge,
  IngestionProgress,
  MaterialRecord,
  QueryScope,
} from "./types";

const SESSION_STORAGE_KEY = "vlearn.session";

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function conversationKey(scope: QueryScope, pageNumber: number) {
  return scope === "whole_lesson" ? "whole_lesson" : `current_page:${pageNumber}`;
}

function loadStoredSession(): AppSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppSession;
    if (parsed.role !== "admin" && parsed.role !== "student") return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState<AppSession | null>(() => loadStoredSession());

  const [days, setDays] = useState<DayRecord[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState("");

  const [activeDay, setActiveDay] = useState<DayRecord | null>(null);
  const [activeMaterial, setActiveMaterial] = useState<MaterialRecord | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scope, setScope] = useState<QueryScope>("current_page");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [typingKeys, setTypingKeys] = useState<string[]>([]);
  const [knowledge, setKnowledge] = useState<DocumentKnowledge | null>(null);
  const [ingestionProgress, setIngestionProgress] = useState<IngestionProgress | null>(null);
  const [ingestionError, setIngestionError] = useState("");
  const ingestionRunRef = useRef(0);
  const chatRunRef = useRef(0);

  const activeConversationKey = conversationKey(scope, currentPage);
  const activeMessages = useMemo(
    () => messages.filter((message) => (
      message.scope === scope && (scope === "whole_lesson" || message.pageNumber === currentPage)
    )),
    [currentPage, messages, scope],
  );

  const refreshLibrary = useCallback(async () => {
    setIsLibraryLoading(true);
    setLibraryError("");
    try {
      setDays(await libraryApi.fetchLibrary());
    } catch {
      setLibraryError("Không thể tải danh sách học liệu.");
    } finally {
      setIsLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) void refreshLibrary();
  }, [session, refreshLibrary]);

  const login = (nextSession: AppSession) => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  };

  const logout = () => {
    ingestionRunRef.current += 1;
    chatRunRef.current += 1;
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
    setDays([]);
    setActiveDay(null);
    setActiveMaterial(null);
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

  const handleDocumentLoad = useCallback(async (pdf: PDFDocumentProxy) => {
    const runId = ++ingestionRunRef.current;
    setTotalPages(pdf.numPages);
    setCurrentPage((page) => Math.min(page, pdf.numPages));
    setIngestionError("");
    try {
      const nextKnowledge = await ingestPdfDocument(pdf, activeMaterial?.displayName ?? "", {
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
  }, [activeMaterial]);

  const selectPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    setQuestion("");
  };

  const handleScopeChange = (nextScope: QueryScope) => {
    setScope(nextScope);
    setQuestion("");
  };

  const handleSelectMaterial = (day: DayRecord, material: MaterialRecord) => {
    ingestionRunRef.current += 1;
    chatRunRef.current += 1;
    setActiveDay(day);
    setActiveMaterial(material);
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

  const handleAskAboutSelection = (selectedText: string) => {
    const quoted = selectedText.length > 300 ? `${selectedText.slice(0, 300)}…` : selectedText;
    setScope("current_page");
    setQuestion(`Giải thích đoạn này giúp mình: "${quoted}"`);
  };

  const handleSendQuestion = (submittedQuestion: string) => {
    if (!knowledge) return;
    const runId = chatRunRef.current;
    const pageAtSendTime = currentPage;
    const scopeAtSendTime = scope;
    const keyAtSendTime = conversationKey(scopeAtSendTime, pageAtSendTime);
    const historyAtSendTime = activeMessages;
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

    void askTutor({
      index: knowledge.index,
      question: submittedQuestion,
      scope: scopeAtSendTime,
      currentPage: pageAtSendTime,
      history: historyAtSendTime,
    }).then((groundedAnswer) => {
      if (chatRunRef.current !== runId) return;
      setMessages((previous) => [...previous, {
        id: createMessageId("assistant"),
        pageNumber: pageAtSendTime,
        scope: scopeAtSendTime,
        role: "assistant",
        content: groundedAnswer.answer,
        sourcePages: groundedAnswer.sourcePages,
        insufficientContext: groundedAnswer.insufficientContext,
      }]);
    }).catch(() => {
      if (chatRunRef.current !== runId) return;
      setMessages((previous) => [...previous, {
        id: createMessageId("assistant"),
        pageNumber: pageAtSendTime,
        scope: scopeAtSendTime,
        role: "assistant",
        content: "Không thể kết nối tới mô hình ngôn ngữ. Vui lòng thử lại sau.",
        sourcePages: [],
        insufficientContext: true,
      }]);
    }).finally(() => {
      if (chatRunRef.current === runId) {
        setTypingKeys((previous) => previous.filter((key) => key !== keyAtSendTime));
      }
    });
  };

  if (!session) {
    return <LoginScreen onLogin={login} />;
  }

  if (session.role === "admin") {
    return (
      <AdminLibraryScreen
        displayName={session.name}
        days={days}
        isLoading={isLibraryLoading}
        error={libraryError}
        onCreateDay={async (title) => { await libraryApi.createDay(title); await refreshLibrary(); }}
        onTogglePublish={async (day) => { await libraryApi.setDayPublished(day.id, !day.published); await refreshLibrary(); }}
        onDeleteDay={async (day) => { await libraryApi.deleteDay(day.id); await refreshLibrary(); }}
        onUploadMaterial={async (day, file, displayName) => {
          await libraryApi.uploadMaterial(day.id, file, displayName);
          await refreshLibrary();
        }}
        onDeleteMaterial={async (day, material) => {
          await libraryApi.deleteMaterial(day.id, material.id);
          await refreshLibrary();
        }}
        onLogout={logout}
      />
    );
  }

  const publishedDays = days.filter((day) => day.published);

  return (
    <TutorScreen
      studentName={session.name}
      days={publishedDays}
      isLibraryLoading={isLibraryLoading}
      libraryError={libraryError}
      activeDay={activeDay}
      activeMaterial={activeMaterial}
      pdfSource={activeMaterial ? libraryApi.materialFileUrl(activeMaterial.id) : null}
      currentPage={currentPage}
      totalPages={totalPages}
      messages={activeMessages}
      allMessages={messages}
      question={question}
      scope={scope}
      isBotTyping={typingKeys.includes(activeConversationKey)}
      knowledge={knowledge}
      ingestionProgress={ingestionProgress}
      ingestionError={ingestionError}
      onSelectMaterial={handleSelectMaterial}
      onDocumentLoad={handleDocumentLoad}
      onPrevious={() => selectPage(Math.max(1, currentPage - 1))}
      onNext={() => selectPage(Math.min(totalPages, currentPage + 1))}
      onScopeChange={handleScopeChange}
      onQuestionChange={setQuestion}
      onSendQuestion={handleSendQuestion}
      onAskAboutSelection={handleAskAboutSelection}
      onLogout={logout}
    />
  );
}
