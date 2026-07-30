import type {
  ChatMessage,
  ProcessedSlidesResponse,
  SlideChatAnswer,
  SlideDocumentSummary,
} from "../types";

type ApiErrorPayload = {
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

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as ApiErrorPayload;
    throw new TutorApiError(
      payload.error?.code ?? `HTTP_${response.status}`,
      payload.error?.message ?? "Không thể kết nối tới AI Tutor.",
    );
  }
  return response.json() as Promise<T>;
}

export async function listSlideDocuments(): Promise<SlideDocumentSummary[]> {
  const response = await fetch("/api/slides/documents");
  const payload = await readJson<{ documents: SlideDocumentSummary[] }>(response);
  return payload.documents;
}

export async function getProcessedSlides(
  documentId: string,
): Promise<ProcessedSlidesResponse> {
  const response = await fetch(
    `/api/slides/documents/${encodeURIComponent(documentId)}/slides`,
  );
  return readJson<ProcessedSlidesResponse>(response);
}

type AskTutorRequest = {
  documentId: string;
  currentPage: number;
  question: string;
  history: ChatMessage[];
};

export async function askTutor(request: AskTutorRequest): Promise<SlideChatAnswer> {
  const response = await fetch(
    `/api/slides/documents/${encodeURIComponent(request.documentId)}/chat`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        current_page: request.currentPage,
        question: request.question,
        history: request.history.slice(-20).map((message) => ({
          role: message.role,
          content: message.content,
        })),
      }),
    },
  );
  return readJson<SlideChatAnswer>(response);
}

