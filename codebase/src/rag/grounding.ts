import type { DocumentIndex, GroundedAnswer, QueryScope } from "../types";
import { extractMentionedPages, searchDocument } from "./indexing";
import { splitSentences, truncate } from "./text";

export type AnswerRequest = {
  question: string;
  scope: QueryScope;
  currentPage: number;
};

function evidenceFromContent(content: string) {
  const sentences = splitSentences(content);
  return truncate(sentences.slice(0, 2).join(" ") || content, 360);
}

export function answerFromDocument(index: DocumentIndex, request: AnswerRequest): GroundedAnswer {
  const results = searchDocument(index, { ...request, limit: 4 });
  const mentionedPages = extractMentionedPages(request.question);
  const missingPages = mentionedPages.filter(
    (pageNumber) => !index.pages.some((page) => page.pageNumber === pageNumber && page.content),
  );

  if (missingPages.length > 0) {
    return {
      answer: `Tài liệu không có đủ nội dung để trả lời vì thiếu dữ liệu ở trang ${missingPages.join(", ")}.`,
      sourcePages: [],
      insufficientContext: true,
    };
  }

  if (results.length === 0) {
    const scopeDescription = request.scope === "current_page"
      ? `trang ${request.currentPage}`
      : "toàn bộ tài liệu";
    return {
      answer: `Tôi chưa tìm thấy thông tin trong ${scopeDescription} để trả lời câu hỏi này. Tài liệu hiện không cung cấp bằng chứng phù hợp.`,
      sourcePages: [],
      insufficientContext: true,
    };
  }

  const evidence = results.map(({ chunk }) => ({
    pageNumber: chunk.pageNumber,
    text: evidenceFromContent(chunk.content),
  }));
  const sourcePages = [...new Set(evidence.map((item) => item.pageNumber))].sort((a, b) => a - b);
  const answer = evidence.length > 1
    ? evidence.map((item) => `- Trang ${item.pageNumber}: ${item.text}`).join("\n")
    : evidence.map((item) => `Trang ${item.pageNumber}: ${item.text}`).join("\n");

  return { answer, sourcePages, insufficientContext: false };
}
