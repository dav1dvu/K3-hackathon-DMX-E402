import type { DocumentIndex, GroundedAnswer, QueryScope } from "../types";
import { retrieveDocument } from "./indexing";
import { citationsFromChunks, sanitizeAnswer } from "./post-processing";
import { splitSentences, truncate } from "./text";

export type AnswerRequest = { question: string; scope: QueryScope; currentPage: number };

function evidenceFromContent(content: string) {
  const sentences = splitSentences(content);
  return truncate(sentences.slice(0, 2).join(" ") || content, 360);
}

function insufficient(missingFields: string[]): GroundedAnswer {
  return {
    status: "insufficient_context",
    answer: "Tài liệu hiện tại chưa cung cấp đủ thông tin để trả lời chính xác câu hỏi này.",
    citations: [],
    missing_fields: missingFields,
  };
}

export function answerFromDocument(index: DocumentIndex, request: AnswerRequest): GroundedAnswer {
  const retrieval = retrieveDocument(index, { ...request, limit: 8 });
  if (!retrieval.results.length) return insufficient(retrieval.missingFields);

  const chunks = retrieval.results.map(({ chunk }) => chunk);
  const isWholeLessonOverview = retrieval.plan.intent === "lesson_overview" && request.scope === "whole_lesson";
  const citations = isWholeLessonOverview
    ? index.sections.map((section) => ({ page_start: section.pageStart, page_end: section.pageEnd, section: section.section }))
    : citationsFromChunks(chunks);
  let answer: string;
  if (isWholeLessonOverview) {
    const sections = index.sections;
    const firstPage = Math.min(...sections.map((section) => section.pageStart));
    const lastPage = Math.max(...sections.map((section) => section.pageEnd));
    answer = `Tài liệu gồm ${sections.length} chủ đề chính, được trình bày từ trang ${firstPage} đến trang ${lastPage}. Chọn một trang trong phần nguồn bên dưới để xem nội dung chi tiết.`;
  } else if (retrieval.plan.intent === "locate_topic") {
    answer = chunks.map((chunk) => (
      `Nội dung này nằm ở phần “${chunk.section}”, trang ${chunk.pageStart}${chunk.pageEnd === chunk.pageStart ? "" : `–${chunk.pageEnd}`}. ${evidenceFromContent(chunk.content)}`
    )).join("\n");
  } else if (retrieval.plan.intent === "specific_page") {
    answer = chunks.map((chunk) => `Trang ${chunk.pageNumber} — ${chunk.section}: ${evidenceFromContent(chunk.content)}`).join("\n");
  } else {
    answer = chunks.map((chunk) => `Trang ${chunk.pageNumber} — ${chunk.section}: ${evidenceFromContent(chunk.content)}`).join("\n");
  }

  return {
    status: retrieval.coverage === "partial" ? "partially_answered" : "answered",
    answer: sanitizeAnswer(answer),
    citations,
    missing_fields: retrieval.missingFields,
  };
}
