// @vitest-environment node
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createServerApp } from "../app.js";
import { LLMCore } from "./core.js";

async function requestBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

async function listen(server: Server) {
  server.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  return server.address() as AddressInfo;
}

async function close(server: Server | undefined) {
  if (!server?.listening) return;
  await new Promise<void>((resolve, reject) => server.close((error) => (
    error ? reject(error) : resolve()
  )));
}

describe("OpenAI-compatible tutor flow", () => {
  let providerServer: Server | undefined;
  let appServer: Server | undefined;

  afterEach(async () => {
    await close(appServer);
    await close(providerServer);
  });

  it("runs API → grounded workflow → LLMCore → provider adapter end to end", async () => {
    let providerPayload: Record<string, unknown> | undefined;
    let providerAuthorization: string | undefined;
    providerServer = createServer(async (request, response) => {
      if (request.url === "/v1/models") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({
          object: "list",
          data: [{ id: "stub-grounded-model" }],
        }));
        return;
      }
      if (request.url !== "/v1/chat/completions") {
        response.writeHead(404).end();
        return;
      }
      providerAuthorization = request.headers.authorization;
      providerPayload = await requestBody(request);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        id: "provider-e2e-request",
        model: "stub-grounded-model",
        choices: [{
          message: {
            content: JSON.stringify({
              status: "answered",
              answer: "Trang 2 yêu cầu theo dõi latency và lỗi.",
              citations: [{ page_start: 2, page_end: 2, section: "Deployment monitoring" }],
              missing_fields: [],
            }),
          },
          finish_reason: "stop",
        }],
        usage: { prompt_tokens: 30, completion_tokens: 12, total_tokens: 42 },
      }));
    });
    const providerAddress = await listen(providerServer);

    const llmCore = new LLMCore({
      primary: {
        name: "local-openai-compatible",
        baseUrl: `http://127.0.0.1:${providerAddress.port}/v1`,
        apiKey: "server-only-test-key",
        model: "stub-grounded-model",
      },
      timeoutMs: 1_000,
      maxRetries: 0,
      retryBaseDelayMs: 0,
    }, {
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    });
    const app = createServerApp(llmCore);
    appServer = app.listen(0, "127.0.0.1");
    if (!appServer.listening) {
      await new Promise<void>((resolve) => appServer?.once("listening", resolve));
    }
    const appAddress = appServer.address() as AddressInfo;

    const healthResponse = await fetch(`http://127.0.0.1:${appAddress.port}/api/llm/health`);
    await expect(healthResponse.json()).resolves.toMatchObject({
      providers: [{
        provider: "local-openai-compatible",
        model: "stub-grounded-model",
        ok: true,
      }],
    });
    expect(healthResponse.status).toBe(200);

    const response = await fetch(`http://127.0.0.1:${appAddress.port}/api/tutor/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "Cần theo dõi gì khi triển khai?",
        scope: "current_page",
        currentPage: 2,
        history: [{ role: "user", content: "Bài học nói về chủ đề gì?" }],
        evidence: [{
          pageNumber: 2,
          title: "Deployment monitoring",
          sourceType: "ocr",
          content: "Monitor latency, errors, and model drift during deployment.",
        }],
      }),
    });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({
      status: "answered",
      answer: "Trang 2 yêu cầu theo dõi latency và lỗi.",
      citations: [{ page_start: 2, page_end: 2, section: "Deployment monitoring" }],
      missing_fields: [],
      llm: {
        provider: "local-openai-compatible",
        model: "stub-grounded-model",
        usage: { inputTokens: 30, outputTokens: 12, totalTokens: 42 },
        finishReason: "stop",
        providerRequestId: "provider-e2e-request",
        attempts: 1,
      },
    });
    expect(providerAuthorization).toBe("Bearer server-only-test-key");
    expect(providerPayload).toMatchObject({
      model: "stub-grounded-model",
      response_format: {
        type: "json_schema",
        json_schema: { name: "grounded_tutor_answer", strict: true },
      },
    });
    expect(JSON.stringify(providerPayload?.messages)).toContain("Monitor latency");
    expect(JSON.stringify(providerPayload?.messages)).toContain("Bài học nói về chủ đề gì?");
  });
});

