import type {
  ChatMessage,
  DocumentIndex,
  GroundedAnswer,
  QueryScope,
} from "../types";
import { answerFromDocument } from "../rag/grounding";
import { searchDocument } from "../rag/indexing";

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
  const evidence = searchDocument(request.index, {
    question: request.question,
    scope: request.scope,
    currentPage: request.currentPage,
    limit: 4,
  });

  if (evidence.length === 0) {
    return answerFromDocument(request.index, request);
  }

  const response = await fetch("/api/tutor/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      question: request.question,
      scope: request.scope,
      currentPage: request.currentPage,
      history: request.history.slice(-20).map((message) => ({
        role: message.role,
        content: message.content,
      })),
      evidence: evidence.map(({ chunk }) => ({
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
