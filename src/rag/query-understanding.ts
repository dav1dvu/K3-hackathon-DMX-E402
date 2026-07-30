import type { ChatMessage } from "../types";
import { normalizeForSearch, tokenize } from "./text";

export type QueryLanguage = "vi" | "en" | "mixed";
export type QueryIntent = "specific_page" | "lesson_overview" | "locate_topic" | "concept";
export type QueryPlan = {
  originalQuery: string;
  effectiveQuery: string;
  normalizedQuery: string;
  expandedQuery: string;
  language: QueryLanguage;
  intent: QueryIntent;
  pageNumbers: number[];
  requestedTasks: Array<"answer" | "summarize" | "count_topics" | "locate">;
  subQueries: string[];
};

const synonymGroups = [
  ["giang vien", "nguoi day", "nguoi trinh bay", "trinh bay", "instructor", "lecturer", "teacher", "speaker", "teaches"],
  ["trang", "trang so", "slide", "page"],
  ["bai giang", "bai hoc", "lesson", "lecture", "course"],
  ["chu de", "noi dung", "topic", "section", "part"],
  ["tom tat", "tong quan", "summary", "summarize", "overview"],
  ["nam o dau", "xem o dau", "trang nao", "where", "locate", "find"],
];

export function detectLanguage(question: string): QueryLanguage {
  const normalized = normalizeForSearch(question);
  const hasVietnamese = /[ăâđêôơưà-ỹ]/i.test(question) || /\b(giang|vien|trang|bai|noi|dung|o dau|bao nhieu)\b/.test(normalized);
  const hasEnglish = /\b(who|what|where|page|slide|lesson|instructor|lecturer|teacher|summary|topic)\b/.test(normalized);
  return hasVietnamese && hasEnglish ? "mixed" : hasVietnamese ? "vi" : "en";
}

export function extractPageNumbers(question: string) {
  const normalized = normalizeForSearch(question);
  const pages = new Set<number>();
  for (const match of normalized.matchAll(/\b(?:trang(?:\s+so)?|slide|page)(?:\s*(?:number|no))?\s*(\d+)\b/g)) {
    pages.add(Number(match[1]));
  }
  return [...pages];
}

function expandSynonyms(normalized: string) {
  const additions = new Set<string>();
  for (const group of synonymGroups) {
    if (group.some((phrase) => normalized.includes(phrase))) {
      group.filter((phrase) => !phrase.includes(" ")).forEach((phrase) => additions.add(phrase));
    }
  }
  return `${normalized} ${[...additions].join(" ")}`.trim();
}

function controlledHistoryRewrite(question: string, history: ChatMessage[]) {
  const normalized = normalizeForSearch(question);
  const needsContext = tokenize(question).length <= 3 || /\b(no|nay|do|it|that|this|them)\b/.test(normalized);
  if (!needsContext) return question;
  const previous = [...history].reverse().find((message) => message.role === "user")?.content;
  return previous ? `${previous} — ${question}` : question;
}

export function understandQuery(question: string, history: ChatMessage[] = []): QueryPlan {
  const effectiveQuery = controlledHistoryRewrite(question, history);
  const normalizedQuery = normalizeForSearch(effectiveQuery);
  const pageNumbers = extractPageNumbers(effectiveQuery);
  const countTopics = /\b(bao nhieu|may (?:chu de|phan|noi dung)|how many|number of)\b/.test(normalizedQuery);
  const summarize = /\b(tom tat|tong quan|noi dung chinh|noi ve .*gi|summary|summarize|overview)\b/.test(normalizedQuery)
    || /\b(bai giang|bai hoc|lesson|lecture)\b.*\b(noi dung|about|what)\b/.test(normalizedQuery)
    || /\b(noi dung|tom tat|summary|summarize)\b.*\b(trang|slide|page)\b/.test(normalizedQuery)
    || /\b(trang|slide|page)\b.*\b(noi dung|la gi|what|summary)\b/.test(normalizedQuery);
  const locate = /\b(nam o dau|xem o dau|trang nao|where|locate|find)\b/.test(normalizedQuery);
  const intent: QueryIntent = pageNumbers.length
    ? "specific_page"
    : countTopics || summarize
      ? "lesson_overview"
      : locate
        ? "locate_topic"
        : "concept";
  const requestedTasks: QueryPlan["requestedTasks"] = ["answer"];
  if (summarize) requestedTasks.push("summarize");
  if (countTopics) requestedTasks.push("count_topics");
  if (locate || pageNumbers.length) requestedTasks.push("locate");
  const subQueries = effectiveQuery.split(/\s+(?:và|and)\s+/i).map((part) => part.trim()).filter(Boolean);
  return {
    originalQuery: question,
    effectiveQuery,
    normalizedQuery,
    expandedQuery: expandSynonyms(normalizedQuery),
    language: detectLanguage(question),
    intent,
    pageNumbers,
    requestedTasks: [...new Set(requestedTasks)],
    subQueries,
  };
}
