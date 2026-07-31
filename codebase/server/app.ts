import express from "express";
import { ZodError } from "zod";
import type { LLMCore } from "./llm/index.js";
import { LLMError } from "./llm/index.js";
import { createMaterialsRouter } from "./materials/routes.js";
import { generateTutorAnswer, tutorRequestSchema } from "./tutor/grounded-generation.js";

export function createServerApp(llmCore: LLMCore) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/library", createMaterialsRouter());

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.get("/api/llm/health", async (_request, response) => {
    const providers = await llmCore.health_check();
    response.status(providers.some((provider) => provider.ok) ? 200 : 503).json({ providers });
  });

  app.post("/api/tutor/chat", async (request, response) => {
    try {
      const input = tutorRequestSchema.parse(request.body);
      response.json(await generateTutorAnswer(llmCore, input));
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json({
          error: {
            code: "INVALID_REQUEST",
            message: "Tutor request is invalid.",
          },
        });
        return;
      }
      if (error instanceof LLMError) {
        const status = error.code === "AUTHENTICATION_ERROR"
          ? 502
          : error.code === "RATE_LIMITED"
            ? 503
            : error.code === "TIMEOUT"
              ? 504
              : 502;
        response.status(status).json({
          error: {
            code: error.code,
            message: "The language model could not complete this request.",
          },
        });
        return;
      }
      console.error(JSON.stringify({
        event: "tutor_request_failed",
        errorType: error instanceof Error ? error.name : "UnknownError",
      }));
      response.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Tutor request failed.",
        },
      });
    }
  });

  return app;
}
