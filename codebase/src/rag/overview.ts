import type { LessonOverview, PageContent } from "../types";
import { splitSentences, tokenize, truncate } from "./text";

function pageSummary(page: PageContent) {
  return splitSentences(page.content)[0] ?? truncate(page.content, 180);
}

export function createLessonOverview(pages: PageContent[], fallbackTitle: string): LessonOverview {
  const contentPages = pages.filter((page) => page.content.trim());
  const frequencies = new Map<string, number>();
  contentPages.forEach((page) => {
    tokenize(page.content).forEach((term) => frequencies.set(term, (frequencies.get(term) ?? 0) + 1));
  });
  const keywords = [...frequencies.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([term]) => term);
  const sections = contentPages.slice(0, 8).map((page) => ({
    title: page.title,
    pageNumbers: [page.pageNumber],
  }));
  const summary = contentPages
    .slice(0, 4)
    .map((page) => `Trang ${page.pageNumber}: ${pageSummary(page)}`)
    .join(" ");

  return {
    title: contentPages[0]?.title || fallbackTitle,
    summary: summary || "Tài liệu chưa có đủ nội dung để tạo tổng quan.",
    sections,
    keywords,
  };
}
