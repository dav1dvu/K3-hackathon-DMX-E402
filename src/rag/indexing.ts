import type { DocumentChunk, DocumentIndex, PageContent, QueryScope } from "../types";
import { chunkPages } from "./chunking";
import { normalizeForSearch, tokenize } from "./text";

export type SearchRequest = {
  question: string;
  scope: QueryScope;
  currentPage: number;
  limit?: number;
};

export type ScoredChunk = {
  chunk: DocumentChunk;
  score: number;
};

export function createDocumentIndex(pages: PageContent[]): DocumentIndex {
  const chunks = chunkPages(pages);
  const documentFrequency: Record<string, number> = {};
  chunks.forEach((chunk) => {
    new Set(chunk.terms).forEach((term) => {
      documentFrequency[term] = (documentFrequency[term] ?? 0) + 1;
    });
  });
  return { pages, chunks, documentFrequency };
}

export function extractMentionedPages(question: string) {
  const pages = new Set<number>();
  for (const match of question.matchAll(/\b(?:trang|slide|page)\s*(\d+)\b/gi)) {
    pages.add(Number(match[1]));
  }
  return [...pages];
}

function isSummaryIntent(question: string) {
  const normalized = normalizeForSearch(question);
  return /\b(tom tat|tong quan|noi dung chinh|noi ve gi|overview|summary)\b/.test(normalized);
}

function isComparisonIntent(question: string) {
  const normalized = normalizeForSearch(question);
  return /\b(so sanh|khac nhau|giong nhau|compare|difference)\b/.test(normalized);
}

function scoreChunk(index: DocumentIndex, chunk: DocumentChunk, queryTerms: string[]) {
  const frequencies = new Map<string, number>();
  chunk.terms.forEach((term) => frequencies.set(term, (frequencies.get(term) ?? 0) + 1));
  const totalDocuments = Math.max(1, index.chunks.length);
  return queryTerms.reduce((score, term) => {
    const frequency = frequencies.get(term) ?? 0;
    if (frequency === 0) return score;
    const inverseFrequency = Math.log((totalDocuments + 1) / ((index.documentFrequency[term] ?? 0) + 1)) + 1;
    return score + (1 + Math.log(frequency)) * inverseFrequency;
  }, 0);
}

export function searchDocument(index: DocumentIndex, request: SearchRequest): ScoredChunk[] {
  const limit = request.limit ?? 4;
  const mentionedPages = extractMentionedPages(request.question).filter(
    (page) => page >= 1 && page <= index.pages.length,
  );
  const summaryIntent = isSummaryIntent(request.question);
  const comparisonIntent = isComparisonIntent(request.question);
  const queryTerms = tokenize(request.question).filter((term) => !/^\d+$/.test(term));
  let candidates = index.chunks;

  if (request.scope === "current_page") {
    candidates = candidates.filter((chunk) => chunk.pageNumber === request.currentPage);
  } else if (mentionedPages.length > 0) {
    candidates = candidates.filter((chunk) => mentionedPages.includes(chunk.pageNumber));
  }

  const scored = candidates
    .map((chunk) => ({ chunk, score: scoreChunk(index, chunk, queryTerms) }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score);

  if (summaryIntent || (comparisonIntent && mentionedPages.length >= 2)) {
    const selectedPages = request.scope === "current_page"
      ? [request.currentPage]
      : mentionedPages.length > 0
        ? mentionedPages
        : [...new Set(candidates.map((chunk) => chunk.pageNumber))].slice(0, limit);
    const representative = selectedPages
      .map((pageNumber) => {
        const matches = scored.filter((result) => result.chunk.pageNumber === pageNumber);
        return matches[0] ?? candidates
          .filter((chunk) => chunk.pageNumber === pageNumber)
          .map((chunk) => ({ chunk, score: 0.1 }))[0];
      })
      .filter((result): result is ScoredChunk => Boolean(result));
    return representative.slice(0, limit);
  }

  return scored.slice(0, limit);
}
