// @vitest-environment node
import type { AddressInfo } from "node:net";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServerApp } from "../app.js";
import type { LLMCore, LLMResponse } from "../llm/index.js";
import { SlideDocumentService } from "./document-service.js";

const temporaryDirectories: string[] = [];
const servers: Array<ReturnType<ReturnType<typeof createServerApp>["listen"]>> = [];

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "slidewise-api-"));
  temporaryDirectories.push(root);
  const slides = join(root, "slide");
  const processed = join(root, "processed");
  await mkdir(slides, { recursive: true });
  const pdf = await PDFDocument.create();
  pdf.addPage([320, 180]);
  pdf.addPage([320, 180]);
  await writeFile(join(slides, "lesson.pdf"), await pdf.save());
  const partitioner = vi.fn().mockResolvedValue([
    { text: "Introduction", filename: "lesson.pdf", page_number: 1, element_type: "Title" },
    { text: "ReAct reasoning and acting", filename: "lesson.pdf", page_number: 2, element_type: "NarrativeText" },
  ]);
  return {
    partitioner,
    service: new SlideDocumentService({ slideDirectory: slides, processedDirectory: processed, partitioner }),
  };
}

function core() {
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

async function start(service: SlideDocumentService, llmCore = core()) {
  const app = createServerApp(llmCore, { slideDocuments: service });
  const server = app.listen(0, "127.0.0.1");
  servers.push(server);
  await new Promise<void>((resolveStarted) => server.once("listening", resolveStarted));
  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}`, llmCore };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolveClosed) => {
    server.close(() => resolveClosed());
  })));
  for (const directory of temporaryDirectories.splice(0)) {
    const resolved = resolve(directory);
    if (!resolved.startsWith(resolve(tmpdir()))) throw new Error("Unsafe temporary path.");
    await rm(resolved, { recursive: true, force: true });
  }
});

describe("slide document API", () => {
  it("lists metadata and serves only discovered PDFs with application/pdf", async () => {
    const { service } = await fixture();
    const { baseUrl } = await start(service);
    const listResponse = await fetch(`${baseUrl}/api/slides/documents`);
    const list = await listResponse.json() as { documents: Array<Record<string, string>> };
    expect(list.documents).toEqual([expect.objectContaining({
      id: "lesson",
      filename: "lesson.pdf",
      url: "/api/slides/documents/lesson/file",
    })]);
    expect(JSON.stringify(list)).not.toContain(resolve("."));

    const fileResponse = await fetch(`${baseUrl}/api/slides/documents/lesson/file`);
    expect(fileResponse.status).toBe(200);
    expect(fileResponse.headers.get("content-type")).toMatch(/^application\/pdf/);
    expect((await fileResponse.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("blocks traversal and unknown document IDs", async () => {
    const { service } = await fixture();
    const { baseUrl } = await start(service);
    const response = await fetch(`${baseUrl}/api/slides/documents/..%2Fsecret/file`);
    expect(response.status).toBe(404);
  });

  it("processes slides once across slide and chat requests", async () => {
    const { service, partitioner } = await fixture();
    const llmCore = core();
    const { baseUrl } = await start(service, llmCore);
    const slidesResponse = await fetch(`${baseUrl}/api/slides/documents/lesson/slides`);
    const slides = await slidesResponse.json() as { total_pages: number; slides: unknown[] };
    expect(slides).toMatchObject({ total_pages: 2 });
    expect(slides.slides).toHaveLength(2);

    const chatResponse = await fetch(`${baseUrl}/api/slides/documents/lesson/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ current_page: 2, question: "Slide này nói gì?", history: [] }),
    });
    expect(chatResponse.status).toBe(200);
    expect(await chatResponse.json()).toMatchObject({
      citations: [{ page_number: 2 }],
      insufficient_context: false,
    });
    expect(partitioner).toHaveBeenCalledOnce();
  });

  it("rejects client-supplied context and system prompt fields", async () => {
    const { service } = await fixture();
    const { baseUrl } = await start(service);
    const response = await fetch(`${baseUrl}/api/slides/documents/lesson/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        current_page: 2,
        question: "Slide này nói gì?",
        history: [],
        lesson_context: "client-controlled",
      }),
    });
    expect(response.status).toBe(400);
  });
});

