export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

// Generic ways a question refers to "this document" itself ("bài thuyết trình này",
// "tài liệu này"...) rather than naming an actual topic — stripped as whole phrases
// (not single stopwords) so a real topic word that happens to share a syllable, e.g.
// "giảng" in "giảng viên", survives untouched.
const SELF_REFERENCE_PHRASES = [
  "bai thuyet trinh", "cuon tai lieu", "khoa hoc", "buoi hoc",
  "bai giang", "bai hoc", "tai lieu", "noi dung", "bai viet", "cuon sach",
];

function stripSelfReferencePhrases(value: string) {
  return SELF_REFERENCE_PHRASES.reduce(
    (text, phrase) => text.replace(new RegExp(`\\b${phrase}\\b`, "g"), " "),
    value,
  );
}

// Vietnamese/English pairs for the same academic concept — slide decks routinely label
// things in English ("Instructor: ...") while students ask in Vietnamese ("giảng viên").
// Applied to BOTH document content and questions during tokenizing, so whichever term a
// chunk's text or the question happens to use, both end up sharing the same vocabulary.
const SYNONYM_GROUPS = [
  ["giang vien", "giao vien", "instructor", "lecturer", "teacher"],
  ["tro giang", "teaching assistant"],
  ["tac gia", "author"],
  ["sinh vien", "hoc vien", "student"],
  ["muc tieu", "muc dich", "objective", "goal"],
  ["vi du", "example"],
  ["ket luan", "conclusion"],
  ["ung dung", "application"],
  ["dinh nghia", "khai niem", "definition", "concept"],
  ["bai tap", "exercise"],
  ["ket qua", "result", "outcome"],
  ["han che", "gioi han", "limitation"],
  ["phuong phap", "phuong thuc", "method", "methodology", "approach"],
  ["danh gia", "evaluation", "assessment"],
  ["du lieu", "data", "dataset"],
  ["mo hinh", "model"],
  ["thuat toan", "algorithm"],
];

function expandSynonyms(value: string) {
  let expanded = value;
  for (const group of SYNONYM_GROUPS) {
    if (group.some((phrase) => new RegExp(`\\b${phrase}\\b`).test(value))) {
      expanded += ` ${group.join(" ")}`;
    }
  }
  return expanded;
}

function foldDiacritics(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");
}

// Diacritic-folded only — no self-reference stripping. Intent detectors (isSummaryIntent
// and friends) look for exact phrases like "noi dung chinh" ("nội dung chính"), and
// stripSelfReferencePhrases below deliberately deletes "noi dung" as filler; running that
// first would silently destroy the very phrase intent detection is looking for.
export function normalizeForIntent(value: string) {
  return normalizeWhitespace(foldDiacritics(value));
}

export function normalizeForSearch(value: string) {
  const cleaned = foldDiacritics(value);
  return normalizeWhitespace(expandSynonyms(stripSelfReferencePhrases(cleaned)));
}

// Written with diacritics for readability, then normalized below — tokens being tested
// against this set have already gone through normalizeForSearch (diacritics stripped),
// so keeping the raw accented spellings here would silently never match anything.
const RAW_STOP_WORDS = [
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is", "it",
  "of", "on", "or", "that", "the", "this", "to", "was", "what", "with", "you",
  "các", "có", "của", "đang", "được", "gì", "hãy", "khi", "là", "một", "này", "những",
  "nội", "ở", "theo", "thì", "trang", "trên", "từ", "và", "về", "slide", "bài",
  // polite/conversational wrappers, e.g. "hãy cho tôi biết...", "bạn có thể cho mình biết..."
  "cho", "tôi", "mình", "bạn", "biết", "cần", "muốn", "giúp", "giùm", "dùm",
  "xin", "vui", "lòng", "làm", "ơn", "ơi", "nhé", "nha", "dạ", "ạ", "vậy", "thể", "không",
  // question words that carry no topical signal for keyword search
  "ai", "sao", "đâu", "nào", "bao", "nhiêu", "cuốn", "quyển",
];
const STOP_WORDS = new Set(RAW_STOP_WORDS.map((word) => normalizeForSearch(word)));

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
