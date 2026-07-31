// @vitest-environment node
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { loadLLMConfig } from "./config.js";
import { LLMCore } from "./core.js";
import { LLMConfigError, LLMError } from "./errors.js";
import type {
  LLMCoreConfig,
  LLMLogger,
  LLMProvider,
  LLMProviderConfig,
  ProviderCompletionRequest,
  ProviderCompletionResult,
} from "./types.js";

const silentLogger: LLMLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function completion(content = "Hello", model = "primary-model"): ProviderCompletionResult {
  return {
    content,
    model,
    usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
    finishReason: "stop",
    providerRequestId: "provider-request-1",
  };
}

function config(overrides: Partial<LLMCoreConfig> = {}): LLMCoreConfig {
  return {
    primary: {
      name: "primary",
      baseUrl: "http://primary.test/v1",
      apiKey: "secret",
      model: "primary-model",
    },
    timeoutMs: 100,
    maxRetries: 0,
    retryBaseDelayMs: 0,
    ...overrides,
  };
}

function provider(
  providerConfig: LLMProviderConfig,
  handler: (request: ProviderCompletionRequest) => Promise<ProviderCompletionResult>,
): LLMProvider {
  return {
    name: providerConfig.name,
    model: providerConfig.model,
    complete: handler,
    healthCheck: async () => ({
      provider: providerConfig.name,
      model: providerConfig.model,
      ok: true,
      latencyMs: 1,
    }),
  };
}

describe("LLMCore", () => {
  it("generates a chat completion with system prompt, history and metadata", async () => {
    const complete = vi.fn(async (request: ProviderCompletionRequest) => {
      expect(request.requestId).toEqual(expect.any(String));
      return completion();
    });
    const core = new LLMCore(config(), {
      logger: silentLogger,
      providerFactory: (providerConfig) => provider(providerConfig, complete),
    });

    const result = await core.generate({
      systemPrompt: "System rule",
      messages: [
        { role: "user", content: "First question" },
        { role: "assistant", content: "First answer" },
        { role: "user", content: "Follow-up" },
      ],
    });

    expect(result).toMatchObject({
      content: "Hello",
      provider: "primary",
      model: "primary-model",
      usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
      finishReason: "stop",
      providerRequestId: "provider-request-1",
      attempts: 1,
    });
    expect(result.requestId).toEqual(expect.any(String));
    expect(complete.mock.calls[0][0].messages).toEqual([
      { role: "system", content: "System rule" },
      { role: "user", content: "First question" },
      { role: "assistant", content: "First answer" },
      { role: "user", content: "Follow-up" },
    ]);
  });

  it("validates a correct structured output", async () => {
    const core = new LLMCore(config(), {
      logger: silentLogger,
      providerFactory: (providerConfig) => provider(
        providerConfig,
        async () => completion('{"answer":"Grounded","pages":[2]}'),
      ),
    });
    const schema = z.object({ answer: z.string(), pages: z.array(z.number()) });

    const result = await core.generate_structured({
      messages: [{ role: "user", content: "Question" }],
      schema: {
        name: "answer",
        jsonSchema: { type: "object" },
        parse: (value) => schema.parse(value),
      },
    });

    expect(result.content).toEqual({ answer: "Grounded", pages: [2] });
  });

  it("returns a normalized error for invalid structured output", async () => {
    const core = new LLMCore(config(), {
      logger: silentLogger,
      providerFactory: (providerConfig) => provider(
        providerConfig,
        async () => completion("not-json"),
      ),
    });

    await expect(core.generate_structured({
      messages: [{ role: "user", content: "Question" }],
      schema: {
        name: "answer",
        jsonSchema: { type: "object" },
        parse: (value) => z.object({ answer: z.string() }).parse(value),
      },
    })).rejects.toMatchObject({ code: "INVALID_STRUCTURED_OUTPUT", retryable: false });
  });

  it("aborts and normalizes a timeout", async () => {
    const core = new LLMCore(config({ timeoutMs: 10 }), {
      logger: silentLogger,
      providerFactory: (providerConfig) => provider(providerConfig, (request) => (
        new Promise((_resolve, reject) => {
          request.signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        })
      )),
    });

    await expect(core.generate({
      messages: [{ role: "user", content: "Slow question" }],
    })).rejects.toMatchObject({ code: "TIMEOUT", retryable: true });
  });

  it("retries only a retryable provider failure", async () => {
    let calls = 0;
    const sleep = vi.fn(async () => undefined);
    const core = new LLMCore(config({ maxRetries: 1, retryBaseDelayMs: 25 }), {
      logger: silentLogger,
      sleep,
      providerFactory: (providerConfig) => provider(providerConfig, async () => {
        calls += 1;
        if (calls === 1) {
          throw new LLMError("RATE_LIMITED", "Rate limited", { retryable: true });
        }
        return completion();
      }),
    });

    const result = await core.generate({ messages: [{ role: "user", content: "Retry" }] });

    expect(result.attempts).toBe(2);
    expect(calls).toBe(2);
    expect(sleep).toHaveBeenCalledWith(25);
  });

  it("does not retry a non-transient invalid request", async () => {
    const complete = vi.fn(async () => {
      throw new LLMError("INVALID_REQUEST", "Bad request");
    });
    const sleep = vi.fn(async () => undefined);
    const core = new LLMCore(config({ maxRetries: 3 }), {
      logger: silentLogger,
      sleep,
      providerFactory: (providerConfig) => provider(providerConfig, complete),
    });

    await expect(core.generate({
      messages: [{ role: "user", content: "Invalid" }],
    })).rejects.toMatchObject({ code: "INVALID_REQUEST", retryable: false });
    expect(complete).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("uses the configured fallback after primary provider failure", async () => {
    const fallback = {
      name: "fallback",
      baseUrl: "http://fallback.test/v1",
      apiKey: "fallback-secret",
      model: "fallback-model",
    };
    const core = new LLMCore(config({ fallback }), {
      logger: silentLogger,
      providerFactory: (providerConfig) => provider(providerConfig, async () => {
        if (providerConfig.name === "primary") {
          throw new LLMError("PROVIDER_ERROR", "Primary failed");
        }
        return completion("Fallback answer", providerConfig.model);
      }),
    });

    const result = await core.generate({ messages: [{ role: "user", content: "Fallback" }] });

    expect(result).toMatchObject({
      content: "Fallback answer",
      provider: "fallback",
      model: "fallback-model",
      attempts: 2,
    });
  });

  it("checks all configured providers without exposing credentials", async () => {
    const fallback = {
      name: "fallback",
      baseUrl: "http://fallback.test/v1",
      apiKey: "fallback-secret",
      model: "fallback-model",
    };
    const core = new LLMCore(config({ fallback }), {
      logger: silentLogger,
      providerFactory: (providerConfig) => provider(providerConfig, async () => completion()),
    });

    await expect(core.health_check()).resolves.toEqual([
      { provider: "primary", model: "primary-model", ok: true, latencyMs: 1 },
      { provider: "fallback", model: "fallback-model", ok: true, latencyMs: 1 },
    ]);
  });
});

describe("LLM config", () => {
  it("fails fast when the API key is missing", () => {
    expect(() => loadLLMConfig({
      LLM_PRIMARY_PROVIDER: "gemini",
      LLM_PRIMARY_BASE_URL: "https://example.test/v1",
      LLM_PRIMARY_MODEL: "configured-model",
    })).toThrow(LLMConfigError);
  });

  it("rejects incomplete fallback and invalid timeout config", () => {
    const base = {
      LLM_PRIMARY_PROVIDER: "gemini",
      LLM_PRIMARY_BASE_URL: "https://example.test/v1",
      LLM_PRIMARY_API_KEY: "secret",
      LLM_PRIMARY_MODEL: "configured-model",
    };
    expect(() => loadLLMConfig({ ...base, LLM_FALLBACK_PROVIDER: "nvidia" }))
      .toThrow(/Fallback configuration is incomplete/);
    expect(() => loadLLMConfig({ ...base, LLM_TIMEOUT_MS: "five" }))
      .toThrow(/LLM_TIMEOUT_MS/);
  });
});
