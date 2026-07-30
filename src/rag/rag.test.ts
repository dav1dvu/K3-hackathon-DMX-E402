import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist/types/src/display/api";
import { describe, expect, it, vi } from "vitest";
import goldenSet from "../test/fixtures/golden-set.json";
import type { PageContent, QueryScope } from "../types";
import { answerFromDocument } from "./grounding";
import { ingestPdfDocument } from "./ingestion";
import { createDocumentIndex } from "./indexing";
import { createLessonOverview } from "./overview";

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
