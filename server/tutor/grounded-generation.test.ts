// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { LLMCore, LLMResponse } from "../llm/index.js";
import { generateTutorAnswer, sanitizeGeneratedAnswer, type GroundedAnswerContent, type TutorRequest } from "./grounded-generation.js";

const evidence: TutorRequest["evidence"] = [{
  documentId: "lesson", pageNumber: 5, pageStart: 5, pageEnd: 5,
  title: "Dartmouth Workshop", section: "AI history", topic: "Dartmouth Workshop",
  sourceType: "pdf_text", content: "Dartmouth Workshop năm 1956 đánh dấu sự ra đời của lĩnh vực AI.",
}];

function response(content: GroundedAnswerContent): LLMResponse<GroundedAnswerContent> {
  return {
    content, provider: "stub", model: "stub-model",
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, latencyMs: 1,
    finishReason: "stop", requestId: "request", providerRequestId: "provider-request", attempts: 1,
  };
}

function core(content: GroundedAnswerContent) {
  return { generate_structured: vi.fn().mockResolvedValue(response(content)) } as unknown as LLMCore;
}

function request(overrides: Partial<TutorRequest> = {}): TutorRequest {
  return {
    question: "Trang 5 nói gì?", scope: "whole_lesson", currentPage: 1, history: [], evidence,
    queryContext: { language: "vi", intent: "specific_page", requestedTasks: ["answer", "locate"], coverage: "full", missingFields: [] },
    ...overrides,
  };
}

describe("grounded output validation", () => {
  it("deduplicates output and removes internal variables", () => {
    expect(sanitizeGeneratedAnswer("insufficientContext=true. Thiếu ngày sinh. Thiếu ngày sinh.")).toBe("Thiếu ngày sinh.");
  });

  it("requires every document answer to have a valid citation", async () => {
    const result = await generateTutorAnswer(core({ status: "answered", answer: "Có nội dung.", citations: [{ page_start: 99, page_end: 99, section: "Sai" }], missing_fields: [] }), request());
    expect(result).toMatchObject({ status: "insufficient_context", citations: [], missing_fields: ["citation"] });
  });

  it("corrects a false negative for deterministic page lookup", async () => {
    const result = await generateTutorAnswer(core({ status: "insufficient_context", answer: "Không thấy.", citations: [], missing_fields: [] }), request());
    expect(result.status).toBe("answered");
    expect(result.citations).toEqual([{ page_start: 5, page_end: 5, section: "AI history" }]);
    expect(result.answer).toContain("Dartmouth Workshop");
  });

  it("answers a generic current-slide summary when retrieval has page evidence", async () => {
    const result = await generateTutorAnswer(core({
      status: "insufficient_context",
      answer: "Không có tổng quan nhưng trang đề cập đến Dartmouth.",
      citations: [],
      missing_fields: [],
    }), request({
      question: "Nội dung slide là gì?",
      scope: "current_page",
      currentPage: 5,
      queryContext: { language: "vi", intent: "lesson_overview", requestedTasks: ["answer", "summarize"], coverage: "full", missingFields: [] },
    }));
    expect(result.status).toBe("answered");
    expect(result.citations).toEqual([{ page_start: 5, page_end: 5, section: "AI history" }]);
    expect(result.answer).toContain("Dartmouth Workshop");
  });

  it("keeps insufficient_context for unsupported concept fields", async () => {
    const result = await generateTutorAnswer(core({ status: "insufficient_context", answer: "Tài liệu không cung cấp ngày sinh.", citations: [], missing_fields: ["birth_date"] }), request({
      question: "Sinh nhật giảng viên là ngày nào?",
      queryContext: { language: "vi", intent: "concept", requestedTasks: ["answer"], coverage: "full", missingFields: [] },
    }));
    expect(result).toMatchObject({ status: "insufficient_context", citations: [], missing_fields: ["birth_date"] });
    expect(result.answer).not.toContain("insufficientContext");
  });

  it("uses partially_answered when retrieval reports a missing field", async () => {
    const result = await generateTutorAnswer(core({ status: "answered", answer: "Trang 5 nói về Dartmouth.", citations: [{ page_start: 5, page_end: 5, section: "AI history" }], missing_fields: [] }), request({
      queryContext: { language: "vi", intent: "specific_page", requestedTasks: ["answer"], coverage: "partial", missingFields: ["page:99"] },
    }));
    expect(result).toMatchObject({ status: "partially_answered", missing_fields: ["page:99"] });
  });
});
