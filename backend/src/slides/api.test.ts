// @vitest-environment node
/**
 * API integration tests for the slide document routes.
 *
 * Uses JsonSlideDocumentService (pre-processed JSON files only).
 * No PDF files, no OCR, no unstructured.partition_pdf calls.
 */
import type { AddressInfo } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServerApp } from "../app.js";
import type { LLMCore, LLMResponse } from "../llm/index.js";
import { JsonSlideDocumentService } from "./json-document-service.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const temporaryDirectories: string[] = [];
const servers: Array<ReturnType<ReturnType<typeof createServerApp>["listen"]>> = [];

async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), "slidewise-api-json-"));
  temporaryDirectories.push(dir);
  return dir;
}

/** Minimal valid ProcessedSlideDocument JSON with 2 slides */
function makeDocJson(id = "lesson", totalPages = 2): string {
  return JSON.stringify({
    document_id: id,
    filename: `${id}.pdf`,
    fingerprint: "1:1",
    total_pages: totalPages,
    processed_at: "2026-01-01T00:00:00.000Z",
    elements: [
      { text: "Introduction", filename: `${id}.pdf`, page_number: 1, element_type: "Title" },
      { text: "ReAct reasoning and acting", filename: `${id}.pdf`, page_number: 2, element_type: "NarrativeText" },
    ],
    slides: [
      { filename: `${id}.pdf`, page_number: 1, text: "Introduction", element_types: ["Title"] },
      { filename: `${id}.pdf`, page_number: 2, text: "ReAct reasoning and acting", element_types: ["NarrativeText"] },
    ],
    lesson_context: "[SLIDE 1]\nIntroduction\n---\n[SLIDE 2]\nReAct reasoning and acting",
  }, null, 2);
}

async function fixture(id = "lesson") {
  const dir = await tempDir();
  await writeFile(join(dir, `${id}.json`), makeDocJson(id));
  const service = new JsonSlideDocumentService({ processedDirectory: dir });
  return { dir, service };
}

function stubLlmCore(): LLMCore {
  const content = {
    answer: "Slide 2 giải thích ReAct.",
    citations: [{ page_number: 2, reason: "Slide 2 mô tả reasoning và acting." }],
    insufficient_context: false,
  };
  const response: LLMResponse<typeof content> = {
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
  return {
    generate_structured: vi.fn().mockResolvedValue(response),
    health_check: vi.fn().mockResolvedValue([]),
  } as unknown as LLMCore;
}

async function startServer(service: JsonSlideDocumentService, llmCore = stubLlmCore()) {
  const app = createServerApp(llmCore, { slideDocuments: service });
  const server = app.listen(0, "127.0.0.1");
  servers.push(server);
  await new Promise<void>((done) => server.once("listening", done));
  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}`, llmCore };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((done) => server.close(() => done())),
  ));
  for (const dir of temporaryDirectories.splice(0)) {
    const resolved = resolve(dir);
    if (!resolved.startsWith(resolve(tmpdir()))) throw new Error("Unsafe tmp path.");
    await rm(resolved, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("slide document API — JSON-backed", () => {
  it("lists documents from JSON files and includes id, filename, url", async () => {
    const { service } = await fixture();
    const { baseUrl } = await startServer(service);

    const res = await fetch(`${baseUrl}/api/slides/documents`);
    const body = await res.json() as { documents: Array<Record<string, string>> };

    expect(res.status).toBe(200);
    expect(body.documents).toEqual([expect.objectContaining({
      id: "lesson",
      filename: "lesson.pdf",
    })]);
    // Ensure absolute file paths are not leaked
    expect(JSON.stringify(body)).not.toContain(resolve("."));
  });

  it("returns document metadata with status=ready and total_pages from JSON", async () => {
    const { service } = await fixture();
    const { baseUrl } = await startServer(service);

    const res = await fetch(`${baseUrl}/api/slides/documents/lesson`);
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ id: "lesson", status: "ready", total_pages: 2 });
  });

  it("returns 404 for unknown document IDs (no path traversal)", async () => {
    const { service } = await fixture();
    const { baseUrl } = await startServer(service);

    const res = await fetch(`${baseUrl}/api/slides/documents/../../secret`);
    expect(res.status).toBe(404);
  });

  it("returns slide list from JSON without calling any OCR or PDF parser", async () => {
    const { service } = await fixture();
    const { baseUrl } = await startServer(service);

    // Structural check: the JSON service source must not contain OCR/PDF imports
    const { readFile } = await import("node:fs/promises");
    const sourceText = await readFile("backend/src/slides/json-document-service.ts", "utf8");
    expect(sourceText).not.toContain("execFile");
    expect(sourceText).not.toContain("child_process");
    expect(sourceText).not.toContain("PDFDocument");

    // Functional check: slide list loads correctly
    const res = await fetch(`${baseUrl}/api/slides/documents/lesson/slides`);
    const body = await res.json() as { total_pages: number; slides: unknown[] };

    expect(res.status).toBe(200);
    expect(body.total_pages).toBe(2);
    expect(body.slides).toHaveLength(2);
  });

  it("returns 404 from /file when no PDF is found in slideDirectory", async () => {
    const { service } = await fixture();
    const { baseUrl } = await startServer(service);

    // The temp fixture has no slideDirectory with a matching PDF → 404
    const res = await fetch(`${baseUrl}/api/slides/documents/lesson/file`);
    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    expect((body.error as Record<string, unknown>).code).toBe("FILE_NOT_FOUND");
  });

  it("answers a chat request using the correct document and current_page", async () => {
    const { service } = await fixture();
    const llmCore = stubLlmCore();
    const { baseUrl } = await startServer(service, llmCore);

    const res = await fetch(`${baseUrl}/api/slides/documents/lesson/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ current_page: 2, question: "Slide này nói gì?", history: [] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      citations: [{ page_number: 2 }],
      insufficient_context: false,
    });

    // LLM was called with the slide context (not with raw PDF data)
    const calls = (llmCore.generate_structured as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    const messages = (calls[0][0] as { messages: Array<{ content: string }> }).messages;
    expect(messages[0].content).toContain("CURRENT SLIDE");
    expect(messages[0].content).toContain("[SLIDE 2]");
  });

  it("returns 404 when current_page does not exist in the JSON", async () => {
    const { service } = await fixture();
    const { baseUrl } = await startServer(service);

    const res = await fetch(`${baseUrl}/api/slides/documents/lesson/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ current_page: 99, question: "?", history: [] }),
    });
    expect(res.status).toBe(404);
  });

  it("rejects extra fields in the chat request body", async () => {
    const { service } = await fixture();
    const { baseUrl } = await startServer(service);

    const res = await fetch(`${baseUrl}/api/slides/documents/lesson/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        current_page: 1,
        question: "?",
        history: [],
        lesson_context: "injected-by-client",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("handles multiple JSON documents and routes chat to the correct one", async () => {
    const dir = await tempDir();
    await writeFile(join(dir, "doc-a.json"), makeDocJson("doc-a", 3));
    await writeFile(join(dir, "doc-b.json"), makeDocJson("doc-b", 5));
    const service = new JsonSlideDocumentService({ processedDirectory: dir });
    const { baseUrl } = await startServer(service);

    const listRes = await fetch(`${baseUrl}/api/slides/documents`);
    const list = await listRes.json() as { documents: Array<{ id: string }> };
    expect(list.documents.map((d) => d.id).sort()).toEqual(["doc-a", "doc-b"]);

    const slidesRes = await fetch(`${baseUrl}/api/slides/documents/doc-b/slides`);
    const slides = await slidesRes.json() as { total_pages: number };
    expect(slides.total_pages).toBe(5);
  });
});
