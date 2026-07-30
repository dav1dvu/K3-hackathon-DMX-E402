import type { LLMLogger } from "./types.js";

function write(level: "info" | "warn" | "error", event: Record<string, unknown>) {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    ...event,
  });
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.info(payload);
}

export const structuredLogger: LLMLogger = {
  info: (event) => write("info", event),
  warn: (event) => write("warn", event),
  error: (event) => write("error", event),
};
