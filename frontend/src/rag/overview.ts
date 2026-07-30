import type { LessonOverview, LessonSection, PageContent } from "../types";
import { normalizeForSearch, splitSentences, tokenize, truncate } from "./text";

function pageSummary(page: PageContent) {
  return splitSentences(page.content)[0] ?? truncate(page.content, 180);
}

function groupSections(pages: PageContent[], documentId: string): LessonSection[] {
  const sections: LessonSection[] = [];
  for (const page of pages.filter((item) => item.content.trim())) {
    const section = page.section ?? page.title;
    const topic = page.topic ?? page.title;
    const previous = sections.at(-1);
    if (previous && normalizeForSearch(previous.section) === normalizeForSearch(section)) {
      previous.pageEnd = page.pageNumber;
      previous.pageNumbers.push(page.pageNumber);
      continue;
    }
    sections.push({
      title: section,
      documentId: page.documentId ?? documentId,
      section,
      topic,
      pageStart: page.pageNumber,
      pageEnd: page.pageNumber,
      pageNumbers: [page.pageNumber],
    });
  }
  return sections;
}

export function createLessonOverview(pages: PageContent[], fallbackTitle: string): LessonOverview {
  const contentPages = pages.filter((page) => page.content.trim());
  const documentId = contentPages[0]?.documentId ?? (normalizeForSearch(fallbackTitle).replace(/\s+/g, "-") || "document");
  const frequencies = new Map<string, number>();
  contentPages.forEach((page) => tokenize(`${page.topic ?? ""} ${page.content}`).forEach((term) => frequencies.set(term, (frequencies.get(term) ?? 0) + 1)));
  const keywords = [...frequencies.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([term]) => term);
  const sections = groupSections(contentPages, documentId);
  const summary = sections.slice(0, 8).map((section) => {
    const page = contentPages.find((item) => item.pageNumber === section.pageStart);
    return `${section.title} (Trang ${section.pageStart}${section.pageEnd === section.pageStart ? "" : `–${section.pageEnd}`}): ${page ? pageSummary(page) : ""}`;
  }).join(" ");

  return {
    title: contentPages[0]?.title || fallbackTitle,
    summary: summary || "Tài liệu chưa có đủ nội dung để tạo tổng quan.",
    sections,
    keywords,
    topicCount: sections.length,
  };
}

