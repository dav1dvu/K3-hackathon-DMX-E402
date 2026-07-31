import type { DocumentChunk, DocumentIndex, PageContent, QueryScope } from "../types";
import { chunkPages } from "./chunking";
import { normalizeForIntent, tokenize } from "./text";

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
  const normalized = normalizeForIntent(question);
  return /\b(tom tat|tom lai|tong quan|noi dung chinh|noi ve gi|y chinh|cac y chinh|diem chinh|dai y|liet ke|khai quat|key points|main points|overview|summary|main content|main idea)\b/.test(normalized);
}

function isComparisonIntent(question: string) {
  const normalized = normalizeForIntent(question);
  return /\b(so sanh|khac nhau|giong nhau|compare|difference)\b/.test(normalized);
}

function isLocatePageIntent(question: string) {
  const normalized = normalizeForIntent(question);
  return /\b(trang nao|o trang nao|phan nao|trang may|slide nao|which page|what page)\b/.test(normalized);
}

function mentionsCurrentPageExplicitly(question: string) {
  const normalized = normalizeForIntent(question);
  return /\b(trang nay|trang hien tai|slide nay|page nay)\b/.test(normalized);
}

/**
 * Decides whether a question should search across the whole document even
 * though the UI's scope toggle is set to "current_page" — e.g. "trang nào
 * nói về X" or "nội dung chính của bài" both need cross-page evidence to
 * answer, regardless of which page the student happens to be reading.
 */
export function resolveEffectiveScope(question: string, scope: QueryScope): QueryScope {
  if (scope === "whole_lesson") return scope;
  if (mentionsCurrentPageExplicitly(question)) return scope;
  if (extractMentionedPages(question).length > 0) return "whole_lesson";
  if (isLocatePageIntent(question) || isSummaryIntent(question)) return "whole_lesson";
  return scope;
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

// A "summarize the whole lesson" question must draw evidence from across the entire
// document, not just the first few pages encountered — otherwise long lessons only ever
// surface their opening pages regardless of what the caller's normal top-K limit is.
const SUMMARY_PAGE_LIMIT = 20;

// Spreads picks evenly across the full list instead of just taking the first N, so a
// summary/overview still reaches the tail of a long document rather than only its opening.
function evenlySample<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items;
  if (limit <= 1) return [items[0]];
  const picked = Array.from(
    { length: limit },
    (_, index) => items[Math.round((index * (items.length - 1)) / (limit - 1))],
  );
  return [...new Set(picked)];
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

  // An explicitly named page ("trang 7 ...") is an unambiguous target regardless of how
  // the rest of the question is phrased, so it always returns that page's content —
  // it must not depend on the keyword scorer finding a term overlap with the page text.
  const wantsPageContent = summaryIntent
    || (comparisonIntent && mentionedPages.length >= 2)
    || (mentionedPages.length > 0 && request.scope !== "current_page");

  if (wantsPageContent) {
    const effectiveLimit = summaryIntent ? Math.max(limit, SUMMARY_PAGE_LIMIT) : limit;
    const selectedPages = request.scope === "current_page"
      ? [request.currentPage]
      : mentionedPages.length > 0
        ? mentionedPages
        : evenlySample([...new Set(candidates.map((chunk) => chunk.pageNumber))], effectiveLimit);
    const representative = selectedPages
      .map((pageNumber) => {
        const matches = scored.filter((result) => result.chunk.pageNumber === pageNumber);
        return matches[0] ?? candidates
          .filter((chunk) => chunk.pageNumber === pageNumber)
          .map((chunk) => ({ chunk, score: 0.1 }))[0];
      })
      .filter((result): result is ScoredChunk => Boolean(result));
    return representative.slice(0, effectiveLimit);
  }

  return scored.slice(0, limit);
}

/**
 * Evenly samples one representative chunk per page across the whole document, spreading
 * the picks instead of just taking the first N. Used as a last resort for the LLM-backed
 * path when keyword scoring finds zero overlap (e.g. a paraphrase or cross-language
 * question that shares no vocabulary with the source text) — rather than the client
 * silently declaring "insufficient" before the LLM (which does understand meaning and
 * paraphrase, per the tutor system prompt) ever sees the document.
 */
export function sampleAcrossPages(index: DocumentIndex, limit: number): ScoredChunk[] {
  const pageNumbers = [...new Set(index.chunks.map((chunk) => chunk.pageNumber))];
  if (pageNumbers.length === 0) return [];
  const selectedPages = evenlySample(pageNumbers, limit);
  return selectedPages
    .map((pageNumber) => index.chunks.find((chunk) => chunk.pageNumber === pageNumber))
    .filter((chunk): chunk is DocumentChunk => Boolean(chunk))
    .map((chunk) => ({ chunk, score: 0.05 }));
}
