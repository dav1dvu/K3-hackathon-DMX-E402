import { useEffect, useRef, type FormEvent } from "react";
import type { ChatMessage as ChatMessageType } from "../types";
import { ChatMessage } from "./ChatMessage";
import { SendIcon, SparkleIcon } from "./icons";

const suggestions = [
  "Slide này đang nói về gì?",
  "Tóm tắt toàn bộ bài học.",
  "Các chủ đề chính của bài là gì?",
];

type ChatPanelProps = {
  pageNumber: number;
  messages: ChatMessageType[];
  question: string;
  isBotTyping: boolean;
  isKnowledgeReady: boolean;
  ingestionFailed: boolean;
  onQuestionChange: (value: string) => void;
  onSend: (question: string) => void;
  onCitationClick: (pageNumber: number) => void;
};

export function ChatPanel({
  pageNumber,
  messages,
  question,
  isBotTyping,
  isKnowledgeReady,
  ingestionFailed,
  onQuestionChange,
  onSend,
  onCitationClick,
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
          <span className="chat-logo"><SparkleIcon /></span>
          <div>
            <h2 id="chat-title">Hỏi đáp có nguồn</h2>
            <p><span className="status-dot" />Ngữ cảnh hiện tại: slide {pageNumber}</p>
          </div>
        </div>
      </div>

      <div className="chat-body" aria-live="polite">
        {!isKnowledgeReady ? (
          <div className="chat-empty">
            <span className="empty-sparkle"><SparkleIcon width={25} height={25} /></span>
            <h3>{ingestionFailed ? "Chưa thể phân tích tài liệu" : "Đang đọc toàn bộ PDF"}</h3>
            <p>{ingestionFailed ? "Hãy thử xử lý lại tài liệu." : "Chat sẽ mở khi Unstructured partition và cache hoàn tất."}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <span className="empty-sparkle"><SparkleIcon width={25} height={25} /></span>
            <h3>Bạn muốn hiểu rõ điều gì?</h3>
            <p>Hỏi “slide này” để ưu tiên trang {pageNumber}, hoặc đặt câu hỏi tổng quan toàn bài.</p>
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
            {messages.map((message) => <ChatMessage key={message.id} message={message} onCitationClick={onCitationClick} />)}
          </div>
        )}

        {isBotTyping && (
          <div className="typing-indicator" role="status">
            <span className="message-avatar"><SparkleIcon width={15} height={15} /></span>
            <div><span /><span /><span /></div>
            <p>Trợ lý đang trả lời...</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-composer" onSubmit={submitQuestion}>
        <label className="visually-hidden" htmlFor="chat-question">
          {`Câu hỏi tại slide ${pageNumber}`}
        </label>
        <textarea
          id="chat-question"
          rows={2}
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          placeholder={isKnowledgeReady ? `Hỏi về slide ${pageNumber} hoặc toàn bộ bài...` : "Đang phân tích tài liệu..."}
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
