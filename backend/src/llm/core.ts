import { randomUUID } from "node:crypto";
import { LLMError, normalizeLLMError } from "./errors.js";
import { structuredLogger } from "./logger.js";
import { OpenAICompatibleProvider } from "./providers/openai-compatible.js";
import type {
  LLMCoreConfig,
  LLMGenerateRequest,
  LLMHealthStatus,
  LLMLogger,
  LLMProvider,
  LLMProviderConfig,
  LLMResponse,
  LLMStructuredRequest,
  ProviderCompletionRequest,
  StructuredSchema,
} from "./types.js";

type LLMCoreOptions = {
  logger?: LLMLogger;
  providerFactory?: (config: LLMProviderConfig) => LLMProvider;
  sleep?: (milliseconds: number) => Promise<void>;
};

function isFallbackEligible(error: LLMError) {
  return !["CONFIG_ERROR", "INVALID_REQUEST"].includes(error.code);
}

export class LLMCore {
  private readonly config: LLMCoreConfig;
  private readonly providers: LLMProvider[];
  private readonly logger: LLMLogger;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(config: LLMCoreConfig, options: LLMCoreOptions = {}) {
    this.config = config;
    this.logger = options.logger ?? structuredLogger;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise(
      (resolve) => setTimeout(resolve, milliseconds),
    ));
    const providerFactory = options.providerFactory
      ?? ((providerConfig: LLMProviderConfig) => new OpenAICompatibleProvider(providerConfig));
    this.providers = [
      providerFactory(config.primary),
      ...(config.fallback ? [providerFactory(config.fallback)] : []),
    ];
  }

  generate(request: LLMGenerateRequest): Promise<LLMResponse<string>> {
    return this.execute(request);
  }

  generate_structured<T>(request: LLMStructuredRequest<T>): Promise<LLMResponse<T>> {
    return this.execute(request, request.schema);
  }

  health_check(): Promise<LLMHealthStatus[]> {
    return Promise.all(
      this.providers.map((provider) => provider.healthCheck(this.config.timeoutMs)),
    );
  }

  private async execute<T = string>(
    request: LLMGenerateRequest,
    schema?: StructuredSchema<T>,
  ): Promise<LLMResponse<T>> {
    if (request.messages.length === 0) {
      throw new LLMError("INVALID_REQUEST", "At least one LLM message is required.");
    }

    const requestId = request.requestId ?? randomUUID();
    const startedAt = performance.now();
    let totalAttempts = 0;
    let lastError: LLMError | undefined;

    for (let providerIndex = 0; providerIndex < this.providers.length; providerIndex += 1) {
      const provider = this.providers[providerIndex];
      for (let retry = 0; retry <= this.config.maxRetries; retry += 1) {
        totalAttempts += 1;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
        const providerRequest: ProviderCompletionRequest = {
          messages: [
            ...(request.systemPrompt
              ? [{
                  role: "system" as const,
                  content: schema
                    ? `${request.systemPrompt}\n\nReturn only valid JSON. The JSON must match this schema: ${JSON.stringify(schema.jsonSchema)}`
                    : request.systemPrompt,
                }]
              : []),
            ...request.messages,
          ],
          temperature: request.temperature,
          maxTokens: request.maxTokens,
          requestId,
          signal: controller.signal,
          ...(schema
            ? {
                responseFormat: {
                  name: schema.name,
                  jsonSchema: schema.jsonSchema,
                },
              }
            : {}),
        };

        try {
          const completion = await provider.complete(providerRequest);
          let content: T;
          if (schema) {
            try {
              content = schema.parse(JSON.parse(completion.content));
            } catch (error) {
              throw new LLMError(
                "INVALID_STRUCTURED_OUTPUT",
                "LLM returned structured output that failed schema validation.",
                { provider: provider.name, cause: error },
              );
            }
          } else {
            content = completion.content as T;
          }

          const latencyMs = Math.round(performance.now() - startedAt);
          this.logger.info({
            event: "llm_request_completed",
            requestId,
            provider: provider.name,
            model: completion.model,
            latencyMs,
            attempts: totalAttempts,
            inputTokens: completion.usage.inputTokens,
            outputTokens: completion.usage.outputTokens,
            finishReason: completion.finishReason,
          });
          return {
            content,
            provider: provider.name,
            model: completion.model,
            usage: completion.usage,
            latencyMs,
            finishReason: completion.finishReason,
            requestId,
            providerRequestId: completion.providerRequestId,
            attempts: totalAttempts,
          };
        } catch (error) {
          const normalized = normalizeLLMError(error, provider.name);
          lastError = normalized;
          const willRetry = normalized.retryable && retry < this.config.maxRetries;
          const hasFallback = providerIndex < this.providers.length - 1;
          this.logger.warn({
            event: "llm_attempt_failed",
            requestId,
            provider: provider.name,
            model: provider.model,
            attempt: totalAttempts,
            errorCode: normalized.code,
            status: normalized.status,
            retryable: normalized.retryable,
            willRetry,
            willFallback: !willRetry && hasFallback && isFallbackEligible(normalized),
          });

          if (willRetry) {
            await this.sleep(this.config.retryBaseDelayMs * 2 ** retry);
            continue;
          }
          if (hasFallback && isFallbackEligible(normalized)) break;
          this.logger.error({
            event: "llm_request_failed",
            requestId,
            provider: provider.name,
            model: provider.model,
            errorCode: normalized.code,
            attempts: totalAttempts,
            latencyMs: Math.round(performance.now() - startedAt),
          });
          throw normalized;
        } finally {
          clearTimeout(timeout);
        }
      }
    }

    throw lastError ?? new LLMError("PROVIDER_ERROR", "No LLM provider was available.");
  }
}

