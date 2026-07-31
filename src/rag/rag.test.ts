import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist/types/src/display/api";
import { describe, expect, it, vi } from "vitest";
import goldenSet from "../test/fixtures/golden-set.json";
import type { PageContent, QueryScope } from "../types";
import { answerFromDocument } from "./grounding";
import { ingestPdfDocument } from "./ingestion";
import { createDocumentIndex, resolveEffectiveScope, sampleAcrossPages, searchDocument } from "./indexing";
import { createLessonOverview } from "./overview";
import { tokenize } from "./text";

const pages = goldenSet.pages as PageContent[];

describe("golden RAG cases", () => {
  const index = createDocumentIndex(pages);

  it.each(goldenSet.questions)("answers $id with grounded source pages", (testCase) => {
    const result = answerFromDocument(index, {
      question: testCase.question,
      scope: testCase.scope as QueryScope,
      currentPage: testCase.currentPage,
    });
    expect(result.insufficientContext).toBe(testCase.insufficientContext);
    expect(result.sourcePages).toEqual(testCase.expectedPages);
    if (!result.insufficientContext) {
      expect(result.answer).toMatch(/Trang \d+:/);
      result.sourcePages.forEach((pageNumber) => {
        expect(pages.some((page) => page.pageNumber === pageNumber)).toBe(true);
      });
    }
  });

  it("creates an overview from the whole lesson", () => {
    const overview = createLessonOverview(pages, "Golden lesson");
    expect(overview.summary).toContain("Trang 1");
    expect(overview.summary).toContain("Trang 3");
    expect(overview.sections).toHaveLength(3);
    expect(overview.keywords.length).toBeGreaterThan(0);
  });

  it.each([
    "Trang 3 nói về cái gì?",
    "Trang 3 có nội dung như nào?",
    "Trang 3 nói về gì vậy?",
    "Nội dung trang 3 là gì?",
  ])("answers %s about an explicitly named page even without a keyword match", (question) => {
    const scope = resolveEffectiveScope(question, "current_page");
    const result = answerFromDocument(index, { question, scope, currentPage: 1 });
    expect(result.insufficientContext).toBe(false);
    expect(result.sourcePages).toEqual([3]);
  });

  it("strips polite wrapper words so a padded question reduces to the same keywords as its terse equivalent", () => {
    expect(tokenize("hãy cho tôi biết giảng viên bài này là ai")).toEqual(tokenize("giảng viên là ai"));
    expect(tokenize("bạn có thể cho mình biết tác giả là ai không")).toEqual(tokenize("tác giả là ai"));
    expect(tokenize("giảng viên của bài thuyết trình này là ai")).toEqual(tokenize("giảng viên là ai"));
    expect(tokenize("tác giả của bài thuyết trình này là ai")).toEqual(tokenize("tác giả là ai"));
  });

  it("matches a Vietnamese question against an English-labelled slide (giảng viên ~ Instructor)", () => {
    const slideDeck = createDocumentIndex([
      { pageNumber: 1, sourceType: "pdf_text", title: "Cover", content: "AI & LLM Foundation. Instructor: Mai Anh Nguyen (Blue)." },
      { pageNumber: 2, sourceType: "pdf_text", title: "Agenda", content: "Instructor: Mai Anh Nguyen (Blue). Course agenda for today." },
    ]);
    const result = answerFromDocument(slideDeck, {
      question: "giảng viên là ai",
      scope: "whole_lesson",
      currentPage: 1,
    });
    expect(result.insufficientContext).toBe(false);
    expect(result.sourcePages).toEqual([1, 2]);
  });
});

describe("whole-lesson coverage for summary and paraphrased questions", () => {
  const manyPages: PageContent[] = Array.from({ length: 24 }, (_, position) => ({
    pageNumber: position + 1,
    sourceType: "pdf_text" as const,
    title: `Topic ${position + 1}`,
    content: `Distinct topic number ${position + 1} covers its own dedicated subject matter in detail.`,
  }));
  const index = createDocumentIndex(manyPages);

  it("draws summary evidence from across the whole document, not just the first few pages", () => {
    const results = searchDocument(index, {
      question: "Nội dung chính của bài học là gì?",
      scope: "whole_lesson",
      currentPage: 1,
      limit: 6,
    });
    const pages = results.map((result) => result.chunk.pageNumber);
    expect(pages.length).toBeGreaterThan(6);
    expect(pages).toContain(24);
  });

  it("samples representative chunks spread across the document for the LLM fallback path", () => {
    const sample = sampleAcrossPages(index, 8);
    const pages = sample.map((result) => result.chunk.pageNumber).sort((a, b) => a - b);
    expect(pages.length).toBe(8);
    expect(pages[0]).toBe(1);
    expect(pages[pages.length - 1]).toBeGreaterThan(16);
  });
});

describe("PDF ingestion", () => {
  it("uses PDF text first and OCR fallback for an image-only page", async () => {
    const textPage = {
      getTextContent: vi.fn().mockResolvedValue({
        items: [{ str: "Text layer content with enough detail to skip optical character recognition on this page.", hasEOL: false }],
      }),
      getOperatorList: vi.fn(),
    } as unknown as PDFPageProxy;
    const imagePage = {
      getTextContent: vi.fn().mockResolvedValue({ items: [] }),
      getOperatorList: vi.fn().mockResolvedValue({ fnArray: [], argsArray: [], lastChunk: true }),
    } as unknown as PDFPageProxy;
    const pdf = {
      numPages: 2,
      getPage: vi.fn((pageNumber: number) => Promise.resolve(pageNumber === 1 ? textPage : imagePage)),
    } as unknown as PDFDocumentProxy;
    const ocrEngine = vi.fn().mockResolvedValue("OCR evidence from an image-only slide about deployment monitoring.");

    const knowledge = await ingestPdfDocument(pdf, "golden.pdf", { ocrEngine });

    expect(knowledge.index.pages[0].sourceType).toBe("pdf_text");
    expect(knowledge.index.pages[1]).toMatchObject({ pageNumber: 2, sourceType: "ocr" });
    expect(knowledge.index.pages[1].content).toContain("deployment monitoring");
    expect(ocrEngine).toHaveBeenCalledOnce();
    const answer = answerFromDocument(knowledge.index, {
      question: "Trang nào nói về deployment monitoring?",
      scope: "whole_lesson",
      currentPage: 1,
    });
    expect(answer).toMatchObject({ sourcePages: [2], insufficientContext: false });
  });
});
