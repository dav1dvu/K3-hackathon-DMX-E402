import { z } from "zod";
import { LLMError, normalizeLLMError } from "../errors.js";
import type {
  LLMHealthStatus,
  LLMProvider,
  LLMProviderConfig,
  ProviderCompletionRequest,
  ProviderCompletionResult,
} from "../types.js";

const completionSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  choices: z.array(z.object({
    message: z.object({ content: z.string().nullable() }),
    finish_reason: z.string().nullable().optional(),
  })).min(1),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative().optional(),
    completion_tokens: z.number().int().nonnegative().optional(),
    total_tokens: z.number().int().nonnegative().optional(),
  }).optional(),
});

function endpoint(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function httpError(status: number, provider: string) {
  if (status === 401 || status === 403) {
    return new LLMError("AUTHENTICATION_ERROR", "LLM provider rejected authentication.", {
      provider,
      status,
    });
  }
  if (status === 429) {
    return new LLMError("RATE_LIMITED", "LLM provider rate limit exceeded.", {
      provider,
      status,
      retryable: true,
    });
  }
  if ([408, 409, 425].includes(status) || status >= 500) {
    return new LLMError("PROVIDER_ERROR", "Temporary LLM provider failure.", {
      provider,
      status,
      retryable: true,
    });
  }
  return new LLMError("INVALID_REQUEST", "LLM provider rejected the request.", {
    provider,
    status,
  });
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string;
  readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: LLMProviderConfig, fetchImpl: typeof fetch = fetch) {
    this.name = config.name;
    this.model = config.model;
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.fetchImpl = fetchImpl;
  }

  async complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResult> {
    try {
      const response = await this.fetchImpl(endpoint(this.baseUrl, "chat/completions"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
          "x-request-id": request.requestId,
        },
        body: JSON.stringify({
          model: this.model,
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          ...(request.responseFormat
            ? {
                response_format: {
                  type: "json_schema",
                  json_schema: {
                    name: request.responseFormat.name,
                    strict: true,
                    schema: request.responseFormat.jsonSchema,
                  },
                },
              }
            : {}),
        }),
        signal: request.signal,
      });

      if (!response.ok) throw httpError(response.status, this.name);

      let raw: unknown;
      try {
        raw = await response.json();
      } catch (error) {
        throw new LLMError(
          "INVALID_PROVIDER_RESPONSE",
          "LLM provider returned a non-JSON response.",
          { provider: this.name, cause: error },
        );
      }
      const parsed = completionSchema.safeParse(raw);
      if (!parsed.success) {
        throw new LLMError(
          "INVALID_PROVIDER_RESPONSE",
          "LLM provider returned an invalid chat-completion payload.",
          { provider: this.name },
        );
      }

      const content = parsed.data.choices[0].message.content;
      if (content === null) {
        throw new LLMError(
          "INVALID_PROVIDER_RESPONSE",
          "LLM provider returned no message content.",
          { provider: this.name },
        );
      }
      const inputTokens = parsed.data.usage?.prompt_tokens ?? 0;
      const outputTokens = parsed.data.usage?.completion_tokens ?? 0;

      return {
        content,
        model: parsed.data.model ?? this.model,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: parsed.data.usage?.total_tokens ?? inputTokens + outputTokens,
        },
        finishReason: parsed.data.choices[0].finish_reason ?? null,
        providerRequestId: parsed.data.id ?? response.headers.get("x-request-id"),
      };
    } catch (error) {
      if (error instanceof LLMError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new LLMError("TIMEOUT", "LLM request timed out.", {
          retryable: true,
          provider: this.name,
          cause: error,
        });
      }
      if (error instanceof TypeError) {
        throw new LLMError("NETWORK_ERROR", "Could not reach LLM provider.", {
          retryable: true,
          provider: this.name,
          cause: error,
        });
      }
      throw normalizeLLMError(error, this.name);
    }
  }

  async healthCheck(timeoutMs: number): Promise<LLMHealthStatus> {
    const startedAt = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.fetchImpl(endpoint(this.baseUrl, "models"), {
        headers: { authorization: `Bearer ${this.apiKey}` },
        signal: controller.signal,
      });
      return {
        provider: this.name,
        model: this.model,
        ok: response.ok,
        latencyMs: Math.round(performance.now() - startedAt),
        ...(!response.ok ? { errorCode: `HTTP_${response.status}` } : {}),
      };
    } catch (error) {
      const normalized = normalizeLLMError(error, this.name);
      return {
        provider: this.name,
        model: this.model,
        ok: false,
        latencyMs: Math.round(performance.now() - startedAt),
        errorCode: normalized.code,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
