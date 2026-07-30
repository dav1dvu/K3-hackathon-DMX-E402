const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is", "it",
  "of", "on", "or", "that", "the", "this", "to", "was", "what", "with", "you",
  "các", "có", "của", "đang", "được", "gì", "hãy", "khi", "là", "một", "này", "những",
  "nội", "ở", "theo", "thì", "trang", "trên", "từ", "và", "về", "slide", "bài",
]);

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeForSearch(value: string) {
  return normalizeWhitespace(
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " "),
  );
}

export function tokenize(value: string) {
  return normalizeForSearch(value)
    .split(" ")
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));
}

export function splitSentences(value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return [];
  return normalized
    .split(/(?<=[.!?])\s+|\s*[•▪◦]\s*/)
    .map(normalizeWhitespace)
    .filter(Boolean);
}

export function truncate(value: string, maxLength: number) {
  const normalized = normalizeWhitespace(value);
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength).trimEnd()}…`;
}

