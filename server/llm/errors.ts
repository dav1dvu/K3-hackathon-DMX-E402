export type LLMErrorCode =
  | "CONFIG_ERROR"
  | "INVALID_REQUEST"
  | "AUTHENTICATION_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "PROVIDER_ERROR"
  | "INVALID_PROVIDER_RESPONSE"
  | "INVALID_STRUCTURED_OUTPUT";

export class LLMError extends Error {
  readonly code: LLMErrorCode;
  readonly retryable: boolean;
  readonly status?: number;
  readonly provider?: string;

  constructor(
    code: LLMErrorCode,
    message: string,
    options: {
      retryable?: boolean;
      status?: number;
      provider?: string;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "LLMError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.status = options.status;
    this.provider = options.provider;
  }
}

export class LLMConfigError extends LLMError {
  constructor(message: string) {
    super("CONFIG_ERROR", message);
    this.name = "LLMConfigError";
  }
}

export function normalizeLLMError(error: unknown, provider?: string) {
  if (error instanceof LLMError) return error;
  if (error instanceof Error && error.name === "AbortError") {
    return new LLMError("TIMEOUT", "LLM request timed out.", {
      retryable: true,
      provider,
      cause: error,
    });
  }
  return new LLMError("PROVIDER_ERROR", "Unexpected LLM provider failure.", {
    retryable: false,
    provider,
    cause: error,
  });
}
