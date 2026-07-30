import { describe, expect, it } from "vitest";
import type { PageContent } from "../types";
import { answerFromDocument } from "./grounding";
import { createDocumentIndex, searchDocument } from "./indexing";
import { sanitizeAnswer } from "./post-processing";

const pages: PageContent[] = [
  {
    pageNumber: 1,
    title: "AI & LLM Foundation — Instructor",
    sourceType: "pdf_text",
    content: "AI & LLM Foundation. Instructor: Mai Anh Nguyen (Blue).",
  },
  {
    pageNumber: 2,
    title: "Course introduction",
    sourceType: "pdf_text",
    content: "The lecturer and course instructor is Mai Anh Nguyen (Blue).",
  },
  {
    pageNumber: 5,
    title: "Dartmouth Workshop",
    sourceType: "pdf_text",
    content: "Dartmouth Workshop năm 1956 đánh dấu sự ra đời của lĩnh vực Artificial Intelligence.",
  },
  {
    pageNumber: 8,
    title: "PAIR — User Needs / Defining Success",
    sourceType: "pdf_text",
    content: "User Needs và Defining Success giúp xác định khi nào AI tạo ra lợi thế cho người dùng.",
  },
];

const index = createDocumentIndex(pages);

describe("bug.md regression suite", () => {
  it.each([
    "Trang 5 nói gì?",
    "Nội dung của slide 5 là gì?",
    "Đi tới trang 5.",
    "Page 5 contains what?",
    "Hãy tóm tắt trang số 5.",
  ])("always resolves explicit page metadata: %s", (question) => {
    const result = searchDocument(index, {
      question,
      scope: "whole_lesson",
      currentPage: 1,
    });
    expect([...new Set(result.map(({ chunk }) => chunk.pageNumber))]).toEqual([5]);
  });

  it("treats a generic current-slide question as a grounded page summary", () => {
    const result = answerFromDocument(index, {
      question: "Nội dung slide là gì?",
      scope: "current_page",
      currentPage: 5,
    });
    expect(result.status).toBe("answered");
    expect(result.citations.map((item) => item.page_start)).toEqual([5]);
    expect(result.answer).toContain("Dartmouth Workshop");
  });

  it("retrieves Vietnamese and English instructor synonyms consistently", () => {
    const vietnamese = answerFromDocument(index, {
      question: "Giảng viên là ai?",
      scope: "whole_lesson",
      currentPage: 1,
    });
    const english = answerFromDocument(index, {
      question: "Who is the instructor?",
      scope: "whole_lesson",
      currentPage: 1,
    });
    expect(vietnamese.status).toBe("answered");
    expect(vietnamese.citations.map((item) => item.page_start)).toEqual(english.citations.map((item) => item.page_start));
    expect(vietnamese.answer).toContain("Mai Anh Nguyen");
    expect(english.answer).toContain("Mai Anh Nguyen");
  });

  it("finds the section and page for User Needs / Defining Success", () => {
    const result = answerFromDocument(index, {
      question: "Nội dung User Needs / Defining Success nằm ở đâu?",
      scope: "whole_lesson",
      currentPage: 1,
    });
    expect(result.citations.map((item) => item.page_start)).toEqual([8]);
    expect(result.answer).toContain("PAIR");
  });

  it("summarizes the lesson and states the detected topic count", () => {
    const result = answerFromDocument(index, {
      question: "Hãy tóm tắt toàn bài và cho biết có bao nhiêu chủ đề chính.",
      scope: "whole_lesson",
      currentPage: 1,
    });
    expect(result.status).toBe("answered");
    expect(result.answer).toContain("4 chủ đề chính");
    expect(result.citations).toHaveLength(4);
  });

  it("returns partially_answered when only one requested page exists", () => {
    const result = answerFromDocument(index, {
      question: "So sánh nội dung trang 5 và trang 99.",
      scope: "whole_lesson",
      currentPage: 1,
    });
    expect(result.status).toBe("partially_answered");
    expect(result.citations.map((item) => item.page_start)).toEqual([5]);
    expect(result.missing_fields).toContain("page:99");
  });

  it("stores complete source metadata on every chunk and section summary", () => {
    index.chunks.forEach((chunk) => expect(chunk).toMatchObject({
      documentId: expect.any(String), pageStart: chunk.pageNumber, pageEnd: chunk.pageNumber,
      section: expect.any(String), topic: expect.any(String), content: expect.any(String),
    }));
    index.sections.forEach((section) => expect(section).toMatchObject({
      documentId: expect.any(String), pageStart: expect.any(Number), pageEnd: expect.any(Number),
      section: expect.any(String), topic: expect.any(String), content: expect.any(String),
    }));
  });

  it("removes technical state and repeated sentences from user-facing output", () => {
    const result = sanitizeAnswer("insufficientContext=true. Thiếu ngày sinh. Thiếu ngày sinh.");
    expect(result).toBe("Thiếu ngày sinh.");
    expect(result).not.toContain("insufficientContext");
  });
});
