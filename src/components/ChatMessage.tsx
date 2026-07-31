import type { ChatMessage as ChatMessageType } from "../types";
import { GraduationCapIcon } from "./icons";

type ChatMessageProps = { message: ChatMessageType };

type ContentBlock =
  | { type: "list"; items: string[] }
  | { type: "paragraph"; text: string };

const BULLET_LINE = /^[-•*]\s+(.*)$/;

function parseContent(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let currentList: string[] = [];
  let currentParagraph: string[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      blocks.push({ type: "list", items: currentList });
      currentList = [];
    }
  };
  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      blocks.push({ type: "paragraph", text: currentParagraph.join(" ") });
      currentParagraph = [];
    }
  };

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      flushParagraph();
      continue;
    }
    const bulletMatch = line.match(BULLET_LINE);
    if (bulletMatch) {
      flushParagraph();
      currentList.push(bulletMatch[1]);
    } else {
      flushList();
      currentParagraph.push(line);
    }
  }
  flushList();
  flushParagraph();
  return blocks;
}

function MessageContent({ content }: { content: string }) {
  const blocks = parseContent(content);
  return (
    <>
      {blocks.map((block, index) => (
        block.type === "list"
          ? (
            <ul className="message-list-content" key={index}>
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
            </ul>
          )
          : <p key={index}>{block.text}</p>
      ))}
    </>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isAssistant = message.role === "assistant";
  return (
    <article className={`chat-message ${message.role}`}>
      {isAssistant && <span className="message-avatar" aria-hidden="true"><GraduationCapIcon width={15} height={15} /></span>}
      <div>
        <span className="message-author">{isAssistant ? "VLearn AI" : "Bạn"}</span>
        <MessageContent content={message.content} />
        {isAssistant && message.insufficientContext && <span className="insufficient-label">Chưa đủ dữ liệu trong tài liệu</span>}
        {isAssistant && message.sourcePages && message.sourcePages.length > 0 && (
          <span className="message-source">Nguồn · Trang {message.sourcePages.join(", ")}</span>
        )}
      </div>
    </article>
  );
}
