export type AppScreen = "upload" | "tutor";

export type ChatRole = "user" | "assistant";

export type QueryScope = "current_page" | "whole_lesson";

export type SourceType = "pdf_text" | "ocr" | "empty";

export type ChatMessage = {
  id: string;
  pageNumber: number;
  scope: QueryScope;
  role: ChatRole;
  content: string;
  sourcePages?: number[];
  insufficientContext?: boolean;
};

export type PdfSource = File | string;

export type PageContent = {
  pageNumber: number;
  content: string;
  sourceType: SourceType;
  title: string;
};

export type DocumentChunk = {
  id: string;
  pageNumber: number;
  content: string;
  sourceType: SourceType;
  title: string;
  terms: string[];
};

export type DocumentIndex = {
  pages: PageContent[];
  chunks: DocumentChunk[];
  documentFrequency: Record<string, number>;
};

export type GroundedAnswer = {
  answer: string;
  sourcePages: number[];
  insufficientContext: boolean;
};

export type LessonSection = {
  title: string;
  pageNumbers: number[];
};

export type LessonOverview = {
  title: string;
  summary: string;
  sections: LessonSection[];
  keywords: string[];
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
