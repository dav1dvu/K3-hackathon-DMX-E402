import type { Citation, DocumentChunk } from "../types";
import { normalizeForSearch, normalizeWhitespace, splitSentences } from "./text";

export function sanitizeAnswer(value: string) {
  const withoutTechnicalState = value
    .replace(/\binsufficient_?context\s*=\s*(?:true|false)\b[.:;]?/gi, "")
    .replace(/\binsufficientContext\s*=\s*(?:true|false)\b[.:;]?/g, "");
  const seen = new Set<string>();
  const lines = withoutTechnicalState
    .split(/\r?\n/)
    .map((line) => {
      const unique = splitSentences(line).filter((sentence) => {
        const key = normalizeForSearch(sentence);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return normalizeWhitespace(unique.join(" "));
    })
    .filter(Boolean);
  return lines.join("\n");
}

export function citationsFromChunks(chunks: DocumentChunk[]): Citation[] {
  const seen = new Set<string>();
  return chunks.flatMap((chunk) => {
    const citation = { page_start: chunk.pageStart, page_end: chunk.pageEnd, section: chunk.section };
    const key = `${citation.page_start}:${citation.page_end}:${normalizeForSearch(citation.section)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [citation];
  });
}
