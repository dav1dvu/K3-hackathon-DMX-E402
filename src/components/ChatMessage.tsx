import type { ChatMessage as ChatMessageType } from "../types";
import { SparkleIcon } from "./icons";

type ChatMessageProps = { message: ChatMessageType };

export function ChatMessage({ message }: ChatMessageProps) {
  const isAssistant = message.role === "assistant";
  return (
    <article className={`chat-message ${message.role}`}>
      {isAssistant && <span className="message-avatar" aria-hidden="true"><SparkleIcon width={15} height={15} /></span>}
      <div>
        <span className="message-author">{isAssistant ? "Slidewise" : "Bạn"}</span>
        <p>{message.content}</p>
        {isAssistant && message.insufficientContext && <span className="insufficient-label">Chưa đủ dữ liệu trong tài liệu</span>}
        {isAssistant && message.sourcePages && message.sourcePages.length > 0 && (
          <span className="message-source">Nguồn · Trang {message.sourcePages.join(", ")}</span>
        )}
      </div>
    </article>
  );
}
