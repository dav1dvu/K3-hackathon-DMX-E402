import type {
  ChatMessage,
  DocumentIndex,
  GroundedAnswer,
  QueryScope,
} from "../types";
import { answerFromDocument } from "../rag/grounding";
import { resolveEffectiveScope, sampleAcrossPages, searchDocument } from "../rag/indexing";

type AskTutorRequest = {
  index: DocumentIndex;
  question: string;
  scope: QueryScope;
  currentPage: number;
  history: ChatMessage[];
};

type TutorErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class TutorApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TutorApiError";
    this.code = code;
  }
}

export async function askTutor(request: AskTutorRequest): Promise<GroundedAnswer> {
  const effectiveScope = resolveEffectiveScope(request.question, request.scope);
  const evidence = searchDocument(request.index, {
    question: request.question,
    scope: effectiveScope,
    currentPage: request.currentPage,
    limit: effectiveScope === "whole_lesson" ? 12 : 4,
  });

  // Keyword scoring can legitimately find zero overlap for a whole-lesson question that's
  // phrased as a paraphrase or in a different language than the source text. Rather than
  // the client declaring "insufficient" on the spot, give the LLM (which does understand
  // meaning across phrasing/language) a representative sample of the whole document to
  // judge for itself. Current-page scope and a genuinely empty document still bail locally.
  const finalEvidence = evidence.length === 0 && effectiveScope === "whole_lesson"
    ? sampleAcrossPages(request.index, 12)
    : evidence;

  if (finalEvidence.length === 0) {
    return answerFromDocument(request.index, { ...request, scope: effectiveScope });
  }

  const response = await fetch("/api/tutor/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      question: request.question,
      scope: effectiveScope,
      currentPage: request.currentPage,
      history: request.history.slice(-20).map((message) => ({
        role: message.role,
        content: message.content,
      })),
      evidence: finalEvidence.map(({ chunk }) => ({
        pageNumber: chunk.pageNumber,
        content: chunk.content,
        sourceType: chunk.sourceType,
        title: chunk.title,
      })),
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as TutorErrorPayload;
    throw new TutorApiError(
      payload.error?.code ?? `HTTP_${response.status}`,
      payload.error?.message ?? "Không thể gọi AI Tutor.",
    );
  }
  return response.json() as Promise<GroundedAnswer>;
}
