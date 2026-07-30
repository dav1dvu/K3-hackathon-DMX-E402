import express from "express";
import { ZodError } from "zod";
import type { LLMCore } from "./llm/index.js";
import { LLMError } from "./llm/index.js";
import { answerSlideQuestion, slideChatRequestSchema } from "./slides/chat-service.js";
import {
  SlideDocumentError,
  SlideDocumentService,
} from "./slides/document-service.js";
import { generateTutorAnswer, tutorRequestSchema } from "./tutor/grounded-generation.js";

type ServerAppOptions = {
  slideDocuments?: SlideDocumentService;
};

function slideErrorStatus(error: SlideDocumentError) {
  if (error.code === "DOCUMENT_NOT_FOUND") return 404;
  if (error.code === "EMPTY_DOCUMENT") return 422;
  return 500;
}

function slideErrorMessage(error: SlideDocumentError) {
  if (error.code === "DOCUMENT_NOT_FOUND") return "Không tìm thấy tài liệu PDF.";
  if (error.code === "EMPTY_DOCUMENT") return "Không trích xuất được nội dung từ tài liệu PDF.";
  return "Không thể xử lý tài liệu PDF.";
}

export function createServerApp(llmCore: LLMCore, options: ServerAppOptions = {}) {
  const app = express();
  const slideDocuments = options.slideDocuments ?? new SlideDocumentService();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.get("/api/llm/health", async (_request, response) => {
    const providers = await llmCore.health_check();
    response.status(providers.some((provider) => provider.ok) ? 200 : 503).json({ providers });
  });

  app.get("/api/slides/documents", async (_request, response) => {
    try {
      response.json({ documents: await slideDocuments.listDocuments() });
    } catch (error) {
      console.error(JSON.stringify({
        event: "slide_document_discovery_failed",
        errorType: error instanceof Error ? error.name : "UnknownError",
      }));
      response.status(500).json({
        error: {
          code: "DOCUMENT_DISCOVERY_FAILED",
          message: "Không thể tìm danh sách tài liệu PDF.",
        },
      });
    }
  });

  app.get("/api/slides/documents/:documentId", async (request, response) => {
    try {
      response.json(await slideDocuments.getDocumentDetails(request.params.documentId));
    } catch (error) {
      if (error instanceof SlideDocumentError) {
        response.status(slideErrorStatus(error)).json({
          error: { code: error.code, message: slideErrorMessage(error) },
        });
        return;
      }
      response.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Không thể đọc tài liệu." },
      });
    }
  });

  app.get("/api/slides/documents/:documentId/file", async (request, response) => {
    try {
      const document = await slideDocuments.getDocument(request.params.documentId);
      response.type("application/pdf");
      response.sendFile(document.filePath, (error) => {
        if (error && !response.headersSent) {
          response.status(500).json({
            error: { code: "FILE_READ_FAILED", message: "Không thể đọc file PDF." },
          });
        }
      });
    } catch (error) {
      if (error instanceof SlideDocumentError) {
        response.status(slideErrorStatus(error)).json({
          error: { code: error.code, message: slideErrorMessage(error) },
        });
        return;
      }
      response.status(500).json({
        error: { code: "FILE_READ_FAILED", message: "Không thể đọc file PDF." },
      });
    }
  });

  app.get("/api/slides/documents/:documentId/slides", async (request, response) => {
    try {
      const lesson = await slideDocuments.getProcessedDocument(request.params.documentId);
      response.json({
        document_id: lesson.document_id,
        filename: lesson.filename,
        status: "ready",
        total_pages: lesson.total_pages,
        slides: lesson.slides,
      });
    } catch (error) {
      if (error instanceof SlideDocumentError) {
        response.status(slideErrorStatus(error)).json({
          error: { code: error.code, message: slideErrorMessage(error) },
        });
        return;
      }
      console.error(JSON.stringify({
        event: "slide_processing_failed",
        documentId: request.params.documentId,
        errorType: error instanceof Error ? error.name : "UnknownError",
      }));
      response.status(500).json({
        error: {
          code: "DOCUMENT_PROCESSING_FAILED",
          message: "Không thể xử lý tài liệu PDF.",
        },
      });
    }
  });

  app.post("/api/slides/documents/:documentId/chat", async (request, response) => {
    try {
      const input = slideChatRequestSchema.parse(request.body);
      const lesson = await slideDocuments.getProcessedDocument(request.params.documentId);
      if (
        input.current_page > lesson.total_pages
        || !lesson.slides.some((slide) => slide.page_number === input.current_page)
      ) {
        response.status(404).json({
          error: {
            code: "SLIDE_NOT_FOUND",
            message: "Không tìm thấy slide được yêu cầu.",
          },
        });
        return;
      }
      const startedAt = Date.now();
      const answer = await answerSlideQuestion(llmCore, lesson, input);
      console.info(JSON.stringify({
        event: "slide_chat_completed",
        documentId: lesson.document_id,
        currentPage: input.current_page,
        citationPages: answer.citations.map((citation) => citation.page_number),
        insufficientContext: answer.insufficient_context,
        llmDurationMs: Date.now() - startedAt,
      }));
      response.json(answer);
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json({
          error: { code: "INVALID_REQUEST", message: "Yêu cầu chat không hợp lệ." },
        });
        return;
      }
      if (error instanceof SlideDocumentError) {
        response.status(slideErrorStatus(error)).json({
          error: { code: error.code, message: slideErrorMessage(error) },
        });
        return;
      }
      if (error instanceof LLMError) {
        const status = error.code === "RATE_LIMITED"
          ? 503
          : error.code === "TIMEOUT"
            ? 504
            : 502;
        response.status(status).json({
          error: {
            code: error.code,
            message: "Không thể tạo câu trả lời tại thời điểm này.",
          },
        });
        return;
      }
      console.error(JSON.stringify({
        event: "slide_chat_failed",
        documentId: request.params.documentId,
        errorType: error instanceof Error ? error.name : "UnknownError",
      }));
      response.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Yêu cầu chat thất bại." },
      });
    }
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

