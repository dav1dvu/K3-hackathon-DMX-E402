import { useEffect, useRef, type FormEvent } from "react";
import type { ChatMessage as ChatMessageType } from "../types";
import type { QueryScope } from "../types";
import { ChatMessage } from "./ChatMessage";
import { GraduationCapIcon, SendIcon } from "./icons";

const suggestions = [
  "Tóm tắt trang này.",
  "Nội dung chính là gì?",
  "Cho tôi một ví dụ.",
];

type ChatPanelProps = {
  pageNumber: number;
  messages: ChatMessageType[];
  question: string;
  scope: QueryScope;
  isBotTyping: boolean;
  isKnowledgeReady: boolean;
  ingestionFailed: boolean;
  onScopeChange: (scope: QueryScope) => void;
  onQuestionChange: (value: string) => void;
  onSend: (question: string) => void;
};

export function ChatPanel({
  pageNumber,
  messages,
  question,
  scope,
  isBotTyping,
  isKnowledgeReady,
  ingestionFailed,
  onScopeChange,
  onQuestionChange,
  onSend,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const trimmedQuestion = question.trim();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isBotTyping]);

  const submitQuestion = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmedQuestion || isBotTyping || !isKnowledgeReady) return;
    onSend(trimmedQuestion);
  };

  return (
    <aside className="chat-panel" aria-labelledby="chat-title">
      <div className="chat-header">
        <div className="chat-title-row">
          <span className="chat-logo"><GraduationCapIcon /></span>
          <div>
            <h2 id="chat-title">Trợ lý học tập</h2>
            <p><span className="status-dot" />{scope === "current_page" ? `Ngữ cảnh: trang ${pageNumber}` : "Ngữ cảnh: toàn bộ bài"}</p>
          </div>
        </div>
        <div className="scope-switch" aria-label="Phạm vi truy xuất">
          <button type="button" className={scope === "current_page" ? "is-active" : ""} onClick={() => onScopeChange("current_page")}>Trang hiện tại</button>
          <button type="button" className={scope === "whole_lesson" ? "is-active" : ""} onClick={() => onScopeChange("whole_lesson")}>Toàn bộ bài</button>
        </div>
      </div>

      <div className="chat-body" aria-live="polite">
        {!isKnowledgeReady ? (
          <div className="chat-empty">
            <span className="empty-sparkle"><GraduationCapIcon width={25} height={25} /></span>
            <h3>{ingestionFailed ? "Chưa thể phân tích tài liệu" : "Đang đọc toàn bộ PDF"}</h3>
            <p>{ingestionFailed ? "Hãy tải file khác để thử lại." : "Chat sẽ mở khi extraction, OCR fallback và indexing hoàn tất."}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <span className="empty-sparkle"><GraduationCapIcon width={25} height={25} /></span>
            <h3>Bạn muốn hiểu rõ điều gì?</h3>
            <p>{scope === "current_page" ? `Câu trả lời chỉ dùng bằng chứng từ trang ${pageNumber}.` : "Câu trả lời sẽ truy xuất bằng chứng trên toàn bộ bài học."}</p>
            <div className="suggestion-list">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => onQuestionChange(suggestion)}
                  disabled={isBotTyping || !isKnowledgeReady}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="message-list">
            {messages.map((message) => <ChatMessage key={message.id} message={message} />)}
          </div>
        )}

        {isBotTyping && (
          <div className="typing-indicator" role="status">
            <span className="message-avatar"><GraduationCapIcon width={15} height={15} /></span>
            <div><span /><span /><span /></div>
            <p>Trợ lý đang trả lời...</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-composer" onSubmit={submitQuestion}>
        <label className="visually-hidden" htmlFor="chat-question">
          {scope === "current_page" ? `Câu hỏi về trang ${pageNumber}` : "Câu hỏi về toàn bộ bài học"}
        </label>
        <textarea
          id="chat-question"
          rows={2}
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          placeholder={isKnowledgeReady ? (scope === "current_page" ? `Hỏi về trang ${pageNumber}...` : "Hỏi về toàn bộ bài học...") : "Đang phân tích tài liệu..."}
          disabled={isBotTyping || !isKnowledgeReady}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (trimmedQuestion && !isBotTyping && isKnowledgeReady) onSend(trimmedQuestion);
            }
          }}
        />
        <button
          type="submit"
          className="send-button"
          disabled={!trimmedQuestion || isBotTyping || !isKnowledgeReady}
          aria-label="Gửi câu hỏi"
        >
          <SendIcon />
        </button>
        <p>Enter để gửi · Shift + Enter để xuống dòng</p>
      </form>
    </aside>
  );
}
