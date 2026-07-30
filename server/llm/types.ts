export type LLMRole = "system" | "user" | "assistant";

export type LLMMessage = {
  role: LLMRole;
  content: string;
};

export type LLMUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type LLMResponse<T = string> = {
  content: T;
  provider: string;
  model: string;
  usage: LLMUsage;
  latencyMs: number;
  finishReason: string | null;
  requestId: string;
  providerRequestId: string | null;
  attempts: number;
};

export type LLMGenerateRequest = {
  systemPrompt?: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  requestId?: string;
};

export type StructuredSchema<T> = {
  name: string;
  jsonSchema: Record<string, unknown>;
  parse: (value: unknown) => T;
};

export type LLMStructuredRequest<T> = LLMGenerateRequest & {
  schema: StructuredSchema<T>;
};

export type LLMProviderConfig = {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type LLMCoreConfig = {
  primary: LLMProviderConfig;
  fallback?: LLMProviderConfig;
  timeoutMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
};

export type ProviderCompletionRequest = {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  requestId: string;
  signal: AbortSignal;
  responseFormat?: {
    name: string;
    jsonSchema: Record<string, unknown>;
  };
};

export type ProviderCompletionResult = {
  content: string;
  model: string;
  usage: LLMUsage;
  finishReason: string | null;
  providerRequestId: string | null;
};

export type LLMHealthStatus = {
  provider: string;
  model: string;
  ok: boolean;
  latencyMs: number;
  errorCode?: string;
};

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResult>;
  healthCheck(timeoutMs: number): Promise<LLMHealthStatus>;
}

export type LLMLogger = {
  info(event: Record<string, unknown>): void;
  warn(event: Record<string, unknown>): void;
  error(event: Record<string, unknown>): void;
};
