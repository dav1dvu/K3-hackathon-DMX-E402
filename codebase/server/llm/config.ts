import { LLMConfigError } from "./errors.js";
import type { LLMCoreConfig, LLMProviderConfig } from "./types.js";

function required(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new LLMConfigError(`Missing required environment variable: ${name}`);
  return value;
}

function parseInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new LLMConfigError(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function validateBaseUrl(value: string, variableName: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new LLMConfigError(`${variableName} must be a valid URL.`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new LLMConfigError(`${variableName} must use http or https.`);
  }
  return value.replace(/\/+$/, "");
}

function providerFromEnv(
  env: NodeJS.ProcessEnv,
  prefix: "LLM_PRIMARY" | "LLM_FALLBACK",
): LLMProviderConfig {
  return {
    name: required(env, `${prefix}_PROVIDER`),
    baseUrl: validateBaseUrl(
      required(env, `${prefix}_BASE_URL`),
      `${prefix}_BASE_URL`,
    ),
    apiKey: required(env, `${prefix}_API_KEY`),
    model: required(env, `${prefix}_MODEL`),
  };
}

export function loadLLMConfig(env: NodeJS.ProcessEnv = process.env): LLMCoreConfig {
  const fallbackFields = [
    "LLM_FALLBACK_PROVIDER",
    "LLM_FALLBACK_BASE_URL",
    "LLM_FALLBACK_API_KEY",
    "LLM_FALLBACK_MODEL",
  ];
  const presentFallbackFields = fallbackFields.filter((field) => Boolean(env[field]?.trim()));
  if (presentFallbackFields.length > 0 && presentFallbackFields.length !== fallbackFields.length) {
    throw new LLMConfigError(
      `Fallback configuration is incomplete. Configure all of: ${fallbackFields.join(", ")}.`,
    );
  }

  return {
    primary: providerFromEnv(env, "LLM_PRIMARY"),
    fallback: presentFallbackFields.length === fallbackFields.length
      ? providerFromEnv(env, "LLM_FALLBACK")
      : undefined,
    timeoutMs: parseInteger(env, "LLM_TIMEOUT_MS", 20_000, 100, 120_000),
    maxRetries: parseInteger(env, "LLM_MAX_RETRIES", 1, 0, 5),
    retryBaseDelayMs: parseInteger(env, "LLM_RETRY_BASE_DELAY_MS", 250, 0, 10_000),
  };
}
