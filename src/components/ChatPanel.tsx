import { useEffect, useRef, type FormEvent } from "react";
import type { ChatMessage as ChatMessageType } from "../types";
import { ChatMessage } from "./ChatMessage";
import { SendIcon, SparkleIcon } from "./icons";

const suggestions = [
  "Tóm tắt trang này.",
  "Nội dung chính là gì?",
  "Cho tôi một ví dụ.",
];

type ChatPanelProps = {
  pageNumber: number;
  messages: ChatMessageType[];
  question: string;
  isBotTyping: boolean;
  onQuestionChange: (value: string) => void;
  onSend: (question: string) => void;
};

export function ChatPanel({
  pageNumber,
  messages,
  question,
  isBotTyping,
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
    if (!trimmedQuestion || isBotTyping) return;
    onSend(trimmedQuestion);
  };

  return (
    <aside className="chat-panel" aria-labelledby="chat-title">
      <div className="chat-header">
        <div className="chat-title-row">
          <span className="chat-logo"><SparkleIcon /></span>
          <div>
            <h2 id="chat-title">Hỏi về trang hiện tại</h2>
            <p><span className="status-dot" />Ngữ cảnh: trang {pageNumber}</p>
          </div>
        </div>
      </div>

      <div className="chat-body" aria-live="polite">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <span className="empty-sparkle"><SparkleIcon width={25} height={25} /></span>
            <h3>Bạn muốn hiểu rõ điều gì?</h3>
            <p>Câu trả lời mô phỏng sẽ gắn với trang {pageNumber} tại thời điểm gửi.</p>
            <div className="suggestion-list">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => onQuestionChange(suggestion)}
                  disabled={isBotTyping}
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
            <span className="message-avatar"><SparkleIcon width={15} height={15} /></span>
            <div><span /><span /><span /></div>
            <p>Trợ lý đang trả lời...</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-composer" onSubmit={submitQuestion}>
        <label className="visually-hidden" htmlFor="chat-question">
          Câu hỏi về trang {pageNumber}
        </label>
        <textarea
          id="chat-question"
          rows={2}
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          placeholder={`Hỏi về trang ${pageNumber}...`}
          disabled={isBotTyping}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (trimmedQuestion && !isBotTyping) onSend(trimmedQuestion);
            }
          }}
        />
        <button
          type="submit"
          className="send-button"
          disabled={!trimmedQuestion || isBotTyping}
          aria-label="Gửi câu hỏi"
        >
          <SendIcon />
        </button>
        <p>Enter để gửi · Shift + Enter để xuống dòng</p>
      </form>
    </aside>
  );
}
