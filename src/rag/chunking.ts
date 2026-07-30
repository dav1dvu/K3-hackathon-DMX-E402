import type { DocumentChunk, PageContent } from "../types";
import { normalizeWhitespace, tokenize } from "./text";

const DEFAULT_CHUNK_WORDS = 90;
const DEFAULT_OVERLAP_WORDS = 18;

export function chunkPages(
  pages: PageContent[],
  documentId = "document",
  chunkWords = DEFAULT_CHUNK_WORDS,
  overlapWords = DEFAULT_OVERLAP_WORDS,
): DocumentChunk[] {
  return pages.flatMap((page) => {
    const words = normalizeWhitespace(page.content).split(" ").filter(Boolean);
    if (words.length === 0) return [];
    const step = Math.max(1, chunkWords - overlapWords);
    const chunks: DocumentChunk[] = [];

    for (let start = 0, index = 0; start < words.length; start += step, index += 1) {
      const content = words.slice(start, start + chunkWords).join(" ");
      chunks.push({
        id: `page-${page.pageNumber}-chunk-${index}`,
        documentId: page.documentId ?? documentId,
        pageNumber: page.pageNumber,
        pageStart: page.pageNumber,
        pageEnd: page.pageNumber,
        content,
        sourceType: page.sourceType,
        title: page.title,
        section: page.section ?? page.title,
        topic: page.topic ?? page.title,
        terms: tokenize(`${page.title} ${page.section ?? ""} ${page.topic ?? ""} ${content}`),
      });
      if (start + chunkWords >= words.length) break;
    }
    return chunks;
  });
}
