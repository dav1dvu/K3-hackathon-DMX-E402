export type AppScreen = "upload" | "tutor";

export type ChatRole = "user" | "assistant";

export type QueryScope = "current_page" | "whole_lesson";

export type SourceType = "pdf_text" | "ocr" | "empty";

export type AnswerStatus = "answered" | "partially_answered" | "insufficient_context";

export type Citation = {
  page_start: number;
  page_end: number;
  section: string;
};

export type SlideCitation = {
  page_number: number;
  reason: string;
};

export type ChatMessage = {
  id: string;
  pageNumber: number;
  scope: QueryScope;
  role: ChatRole;
  content: string;
  status?: AnswerStatus;
  citations?: SlideCitation[];
  missing_fields?: string[];
};

export type PdfSource = File | string;

export type PageContent = {
  pageNumber: number;
  content: string;
  sourceType: SourceType;
  title: string;
  documentId?: string;
  section?: string;
  topic?: string;
};

export type DocumentChunk = {
  id: string;
  documentId: string;
  pageNumber: number;
  pageStart: number;
  pageEnd: number;
  content: string;
  sourceType: SourceType;
  title: string;
  section: string;
  topic: string;
  terms: string[];
};

export type DocumentSectionSummary = {
  id: string;
  documentId: string;
  section: string;
  topic: string;
  pageStart: number;
  pageEnd: number;
  pageNumbers: number[];
  content: string;
};

export type DocumentIndex = {
  documentId: string;
  pages: PageContent[];
  chunks: DocumentChunk[];
  sections: DocumentSectionSummary[];
  documentFrequency: Record<string, number>;
};

export type GroundedAnswer = {
  status: AnswerStatus;
  answer: string;
  citations: Citation[];
  missing_fields: string[];
  llm?: {
    provider: string;
    model: string;
    usage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    latencyMs: number;
    finishReason: string | null;
    requestId: string;
    providerRequestId: string | null;
    attempts: number;
  };
};

export type LessonSection = {
  title: string;
  documentId: string;
  section: string;
  topic: string;
  pageStart: number;
  pageEnd: number;
  pageNumbers: number[];
};

export type LessonOverview = {
  title: string;
  summary: string;
  sections: LessonSection[];
  keywords: string[];
  topicCount: number;
};

export type DocumentKnowledge = {
  index: DocumentIndex;
  overview: LessonOverview;
};

export type IngestionProgress = {
  processedPages: number;
  totalPages: number;
  currentPage: number;
  stage: "extracting" | "ocr" | "indexing" | "complete";
};

export type SlideDocumentSummary = {
  id: string;
  filename: string;
  title: string;
  url: string;
};

export type ProcessedSlide = {
  filename: string;
  page_number: number;
  text: string;
  element_types: string[];
};

export type ProcessedSlidesResponse = {
  document_id: string;
  filename: string;
  status: "ready";
  total_pages: number;
  slides: ProcessedSlide[];
};

export type SlideChatAnswer = {
  answer: string;
  citations: SlideCitation[];
  insufficient_context: boolean;
};
