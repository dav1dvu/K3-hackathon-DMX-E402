import type { ChatMessage as ChatMessageType } from "../types";
import { SparkleIcon } from "./icons";

type ChatMessageProps = { message: ChatMessageType; onCitationClick: (pageNumber: number) => void };

export function ChatMessage({ message, onCitationClick }: ChatMessageProps) {
  const isAssistant = message.role === "assistant";
  return (
    <article className={`chat-message ${message.role}`}>
      {isAssistant && <span className="message-avatar" aria-hidden="true"><SparkleIcon width={15} height={15} /></span>}
      <div>
        <span className="message-author">{isAssistant ? "Slidewise" : "Bạn"}</span>
        <p>{message.content}</p>
        {isAssistant && message.status === "insufficient_context" && <span className="insufficient-label">Tài liệu chưa đủ thông tin để trả lời chính xác</span>}
        {isAssistant && message.status === "partially_answered" && <span className="partial-label">Đã trả lời phần có bằng chứng{message.missing_fields?.length ? ` · còn thiếu ${message.missing_fields.join(", ")}` : ""}</span>}
        {isAssistant && message.citations && message.citations.length > 0 && (
          <details className="citation-group" open={message.citations.length <= 6}>
            <summary>{message.citations.length === 1 ? "Nguồn tham khảo" : `${message.citations.length} nguồn tham khảo`}</summary>
            <div className="message-citations" aria-label="Nguồn trích dẫn">
              {message.citations.map((citation) => (
                <button
                  key={citation.page_number}
                  type="button"
                  title={citation.reason}
                  onClick={() => onCitationClick(citation.page_number)}
                >
                  [Slide {citation.page_number}]
                </button>
              ))}
            </div>
          </details>
        )}
      </div>
    </article>
  );
}
