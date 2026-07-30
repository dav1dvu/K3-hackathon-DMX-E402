import { afterEach, describe, expect, it, vi } from "vitest";
import { askTutor } from "./tutorApi";

afterEach(() => vi.unstubAllGlobals());

describe("slide tutor API client", () => {
  it("sends only current_page, question, and history in the chat body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      answer: "Grounded answer",
      citations: [{ page_number: 5, reason: "Evidence" }],
      insufficient_context: false,
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await askTutor({
      documentId: "lesson",
      currentPage: 5,
      question: "Slide này nói gì?",
      history: [{
        id: "message-1",
        pageNumber: 4,
        scope: "current_page",
        role: "user",
        content: "Câu trước",
      }],
    });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(options.body));
    expect(body).toEqual({
      current_page: 5,
      question: "Slide này nói gì?",
      history: [{ role: "user", content: "Câu trước" }],
    });
    expect(Object.keys(body).sort()).toEqual(["current_page", "history", "question"]);
  });
});
