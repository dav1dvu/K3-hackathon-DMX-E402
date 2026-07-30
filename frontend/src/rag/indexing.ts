import type { ChatMessage, DocumentChunk, DocumentIndex, DocumentSectionSummary, PageContent, QueryScope } from "../types";
import { chunkPages } from "./chunking";
import { extractPageNumbers, understandQuery, type QueryPlan } from "./query-understanding";
import { normalizeForSearch, splitSentences, tokenize, truncate } from "./text";

export type SearchRequest = { question: string; scope: QueryScope; currentPage: number; history?: ChatMessage[]; limit?: number };
export type ScoredChunk = { chunk: DocumentChunk; score: number };
export type RetrievalCoverage = "full" | "partial" | "none";
export type RetrievalResult = { plan: QueryPlan; results: ScoredChunk[]; coverage: RetrievalCoverage; missingFields: string[] };

function safeDocumentId(value: string) {
  return normalizeForSearch(value).replace(/\s+/g, "-") || "document";
}

function enrichPages(pages: PageContent[], documentId: string): PageContent[] {
  return pages.map((page) => ({
    ...page,
    documentId: page.documentId ?? documentId,
    section: page.section ?? page.title ?? `Trang ${page.pageNumber}`,
    topic: page.topic ?? page.title ?? `Trang ${page.pageNumber}`,
  }));
}

function buildSectionSummaries(pages: PageContent[], documentId: string): DocumentSectionSummary[] {
  const summaries: DocumentSectionSummary[] = [];
  for (const page of pages.filter((item) => item.content.trim())) {
    const section = page.section ?? page.title;
    const previous = summaries.at(-1);
    if (previous && normalizeForSearch(previous.section) === normalizeForSearch(section)) {
      previous.pageEnd = page.pageNumber;
      previous.pageNumbers.push(page.pageNumber);
      previous.content = truncate(`${previous.content} ${splitSentences(page.content)[0] ?? page.content}`, 700);
      continue;
    }
    summaries.push({
      id: `${documentId}-section-${summaries.length + 1}`,
      documentId,
      section,
      topic: page.topic ?? page.title,
      pageStart: page.pageNumber,
      pageEnd: page.pageNumber,
      pageNumbers: [page.pageNumber],
      content: truncate(splitSentences(page.content)[0] ?? page.content, 400),
    });
  }
  return summaries;
}

export function createDocumentIndex(pages: PageContent[], sourceName = "document"): DocumentIndex {
  const documentId = safeDocumentId(sourceName);
  const enrichedPages = enrichPages(pages, documentId);
  const chunks = chunkPages(enrichedPages, documentId);
  const documentFrequency: Record<string, number> = {};
  chunks.forEach((chunk) => new Set(chunk.terms).forEach((term) => {
    documentFrequency[term] = (documentFrequency[term] ?? 0) + 1;
  }));
  return { documentId, pages: enrichedPages, chunks, sections: buildSectionSummaries(enrichedPages, documentId), documentFrequency };
}

export const extractMentionedPages = extractPageNumbers;

function scoreChunk(index: DocumentIndex, chunk: DocumentChunk, queryTerms: string[], normalizedQuery: string) {
  const frequencies = new Map<string, number>();
  chunk.terms.forEach((term) => frequencies.set(term, (frequencies.get(term) ?? 0) + 1));
  const totalDocuments = Math.max(1, index.chunks.length);
  const keywordScore = queryTerms.reduce((score, term) => {
    const frequency = frequencies.get(term) ?? 0;
    if (!frequency) return score;
    const inverseFrequency = Math.log((totalDocuments + 1) / ((index.documentFrequency[term] ?? 0) + 1)) + 1;
    return score + (1 + Math.log(frequency)) * inverseFrequency;
  }, 0);
  const metadata = normalizeForSearch(`${chunk.section} ${chunk.topic} ${chunk.title}`);
  const metadataScore = queryTerms.filter((term) => metadata.includes(term)).length * 1.5;
  const phraseScore = normalizedQuery.length > 3 && normalizeForSearch(chunk.content).includes(normalizedQuery) ? 4 : 0;
  return keywordScore + metadataScore + phraseScore;
}

function rankCandidates(index: DocumentIndex, candidates: DocumentChunk[], query: string) {
  const plan = understandQuery(query);
  const terms = tokenize(plan.expandedQuery).filter((term) => !/^\d+$/.test(term));
  return candidates.map((chunk) => ({ chunk, score: scoreChunk(index, chunk, terms, plan.normalizedQuery) }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score);
}

function onePerPage(results: ScoredChunk[], limit: number) {
  const seen = new Set<number>();
  return results.filter(({ chunk }) => {
    if (seen.has(chunk.pageNumber)) return false;
    seen.add(chunk.pageNumber);
    return true;
  }).slice(0, limit);
}

function directPageLookup(index: DocumentIndex, pages: number[], limit: number) {
  return pages.flatMap((pageNumber) => {
    const chunk = index.chunks.find((item) => item.pageNumber === pageNumber);
    const page = index.pages.find((item) => item.pageNumber === pageNumber);
    return chunk && page ? [{ chunk: { ...chunk, content: page.content }, score: Number.POSITIVE_INFINITY }] : [];
  }).slice(0, limit);
}

function summaryLookup(index: DocumentIndex, limit: number): ScoredChunk[] {
  return index.sections.slice(0, limit).flatMap((section) => {
    const chunk = index.chunks.find((item) => item.pageNumber === section.pageStart);
    return chunk ? [{ chunk, score: 1 }] : [];
  });
}

export function retrieveDocument(index: DocumentIndex, request: SearchRequest): RetrievalResult {
  const limit = request.limit ?? 6;
  const plan = understandQuery(request.question, request.history);
  const validPages = plan.pageNumbers.filter((page) => index.pages.some((item) => item.pageNumber === page && item.content.trim()));
  if (plan.pageNumbers.length) {
    const results = directPageLookup(index, validPages, limit);
    const missing = plan.pageNumbers.filter((page) => !validPages.includes(page));
    return { plan, results, coverage: !results.length ? "none" : missing.length ? "partial" : "full", missingFields: missing.map((page) => `page:${page}`) };
  }

  if (plan.intent === "lesson_overview" && request.scope === "whole_lesson") {
    const results = summaryLookup(index, limit);
    return { plan, results, coverage: results.length ? "full" : "none", missingFields: results.length ? [] : ["lesson_overview"] };
  }

  const candidates = request.scope === "current_page"
    ? index.chunks.filter((chunk) => chunk.pageNumber === request.currentPage)
    : index.chunks;
  if (plan.subQueries.length > 1 && plan.intent === "concept") {
    const matched = plan.subQueries.map((subQuery) => rankCandidates(index, candidates, subQuery)[0]).filter((result): result is ScoredChunk => Boolean(result));
    const results = onePerPage(matched.sort((left, right) => left.chunk.pageNumber - right.chunk.pageNumber), limit);
    return {
      plan,
      results,
      coverage: !results.length ? "none" : matched.length === plan.subQueries.length ? "full" : "partial",
      missingFields: matched.length === plan.subQueries.length ? [] : plan.subQueries.filter((subQuery) => !rankCandidates(index, candidates, subQuery).length),
    };
  }
  const queryTerms = tokenize(plan.expandedQuery).filter((term) => !/^\d+$/.test(term));
  const ranked = candidates.map((chunk) => ({ chunk, score: scoreChunk(index, chunk, queryTerms, plan.normalizedQuery) }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score);
  const relevanceFloor = (ranked[0]?.score ?? 0) * 0.55;
  const scored = onePerPage(ranked.filter((result) => result.score >= relevanceFloor), limit);
  if (scored.length) return { plan, results: scored, coverage: "full", missingFields: [] };

  if (request.scope === "current_page" && /\b(tom tat|noi dung|what|summary|summarize)\b/.test(plan.normalizedQuery)) {
    const results = directPageLookup(index, [request.currentPage], limit);
    return { plan, results, coverage: results.length ? "full" : "none", missingFields: results.length ? [] : [`page:${request.currentPage}`] };
  }
  return { plan, results: [], coverage: "none", missingFields: [plan.intent === "locate_topic" ? "location" : "answer"] };
}

export function searchDocument(index: DocumentIndex, request: SearchRequest): ScoredChunk[] {
  return retrieveDocument(index, request).results;
}

