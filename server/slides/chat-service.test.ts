// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { LLMCore, LLMResponse } from "../llm/index.js";
import {
  answerSlideQuestion,
  buildSlideChatMessages,
  getRecentHistory,
  validateCitations,
} from "./chat-service.js";
import type { ProcessedSlideDocument } from "./models.js";

const lesson: ProcessedSlideDocument = {
  document_id: "lesson",
  filename: "lesson.pdf",
  fingerprint: "1:1",
  total_pages: 3,
  processed_at: "2026-01-01T00:00:00.000Z",
  elements: [],
  slides: [
    { filename: "lesson.pdf", page_number: 1, text: "Course overview", element_types: ["Title"] },
    { filename: "lesson.pdf", page_number: 2, text: "ReAct reasoning and acting", element_types: ["NarrativeText"] },
    { filename: "lesson.pdf", page_number: 3, text: "Evaluation and safety", element_types: ["ListItem"] },
  ],
  lesson_context: "[SLIDE 1]\nCourse overview\n---\n[SLIDE 2]\nReAct reasoning and acting\n---\n[SLIDE 3]\nEvaluation and safety",
};

function llmResponse(content: {
  answer: string;
  citations: Array<{ page_number: number; reason: string }>;
  insufficient_context: boolean;
}): LLMResponse<typeof content> {
  return {
    content,
    provider: "stub",
    model: "stub",
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    latencyMs: 1,
    finishReason: "stop",
    requestId: "request",
    providerRequestId: null,
    attempts: 1,
  };
}

describe("slide chat context and grounding", () => {
  it("puts the current slide before ordered whole-lesson context", () => {
    const messages = buildSlideChatMessages(lesson, {
      current_page: 2,
      question: "Slide này nói gì?",
      history: [],
    });
    expect(messages[0].content).toContain("CURRENT SLIDE:\n[SLIDE 2]");
    expect(messages[0].content).toContain("LESSON CONTEXT:\n[SLIDE 1]");
    expect(messages.at(-1)?.content).toBe("Slide này nói gì?");
  });

  it("limits history to the latest six messages", () => {
    const history = Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 ? "assistant" as const : "user" as const,
      content: `message-${index}`,
    }));
    expect(getRecentHistory(history).map((message) => message.content)).toEqual([
      "message-4", "message-5", "message-6", "message-7", "message-8", "message-9",
    ]);
  });

  it("keeps valid citations and removes invalid or duplicate pages", () => {
    expect(validateCitations(lesson, [
      { page_number: 2, reason: "Current slide" },
      { page_number: 2, reason: "Duplicate" },
      { page_number: 0, reason: "Invalid" },
      { page_number: 99, reason: "Out of range" },
    ])).toEqual([{ page_number: 2, reason: "Current slide" }]);
  });

  it("answers a current-slide question with a validated citation", async () => {
    const generate = vi.fn().mockResolvedValue(llmResponse({
      answer: "Slide này giải thích ReAct.",
      citations: [{ page_number: 2, reason: "Slide mô tả reasoning và acting." }],
      insufficient_context: false,
    }));
    const result = await answerSlideQuestion(
      { generate_structured: generate } as unknown as Pick<LLMCore, "generate_structured">,
      lesson,
      { current_page: 2, question: "Slide này nói gì?", history: [] },
    );
    expect(result).toMatchObject({
      insufficient_context: false,
      citations: [{ page_number: 2 }],
    });
  });

  it("uses lesson context for a whole-lesson question", async () => {
    const generate = vi.fn().mockResolvedValue(llmResponse({
      answer: "Bài học gồm tổng quan, ReAct và đánh giá an toàn.",
      citations: [
        { page_number: 1, reason: "Tổng quan" },
        { page_number: 2, reason: "ReAct" },
        { page_number: 3, reason: "Đánh giá" },
      ],
      insufficient_context: false,
    }));
    await answerSlideQuestion(
      { generate_structured: generate } as unknown as Pick<LLMCore, "generate_structured">,
      lesson,
      { current_page: 2, question: "Tóm tắt toàn bộ bài học", history: [] },
    );
    const request = generate.mock.calls[0][0];
    expect(request.messages[0].content).toContain("[SLIDE 1]");
    expect(request.messages[0].content).toContain("[SLIDE 3]");
  });

  it("preserves insufficient_context without inventing a citation", async () => {
    const generate = vi.fn().mockResolvedValue(llmResponse({
      answer: "Tài liệu không có thông tin về thời tiết.",
      citations: [{ page_number: 2, reason: "Không hỗ trợ câu trả lời" }],
      insufficient_context: true,
    }));
    const result = await answerSlideQuestion(
      { generate_structured: generate } as unknown as Pick<LLMCore, "generate_structured">,
      lesson,
      { current_page: 2, question: "Thời tiết hôm nay thế nào?", history: [] },
    );
    expect(result).toMatchObject({ insufficient_context: true, citations: [] });
  });
});
