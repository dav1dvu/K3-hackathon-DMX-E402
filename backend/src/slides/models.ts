export type RawPartitionElement = {
  text?: unknown;
  filename?: unknown;
  page_number?: unknown;
  element_type?: unknown;
};

export type SlideElement = {
  text: string;
  filename: string;
  page_number: number;
  element_type: string;
};

export type SlideContent = {
  filename: string;
  page_number: number;
  text: string;
  element_types: string[];
};

export type ProcessedSlideDocument = {
  document_id: string;
  filename: string;
  fingerprint: string;
  total_pages: number;
  processed_at: string;
  elements: SlideElement[];
  slides: SlideContent[];
  lesson_context: string;
};

export function normalizeElement(
  element: RawPartitionElement,
  fallbackFilename: string,
): SlideElement | null {
  const text = typeof element.text === "string" ? element.text.trim() : "";
  if (!text) return null;

  const parsedPageNumber = Number(element.page_number);
  const pageNumber = Number.isInteger(parsedPageNumber) && parsedPageNumber > 0
    ? parsedPageNumber
    : 0;
  const filename = typeof element.filename === "string" && element.filename.trim()
    ? element.filename.trim()
    : fallbackFilename;
  const elementType = typeof element.element_type === "string" && element.element_type.trim()
    ? element.element_type.trim()
    : "Unknown";

  return {
    text,
    filename,
    page_number: pageNumber,
    element_type: elementType,
  };
}

export function groupElementsByPage(elements: SlideElement[]): SlideContent[] {
  const grouped = new Map<number, SlideElement[]>();
  for (const element of elements) {
    if (element.page_number < 1) continue;
    const pageElements = grouped.get(element.page_number) ?? [];
    pageElements.push(element);
    grouped.set(element.page_number, pageElements);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([pageNumber, pageElements]) => ({
      filename: pageElements[0].filename,
      page_number: pageNumber,
      text: pageElements.map((element) => element.text).join("\n"),
      element_types: [...new Set(pageElements.map((element) => element.element_type))],
    }));
}

export function formatSlide(slide: SlideContent): string {
  return [
    `[SLIDE ${slide.page_number}]`,
    `File: ${slide.filename}`,
    `Element types: ${slide.element_types.join(", ")}`,
    "",
    slide.text,
  ].join("\n");
}

export function buildLessonContext(slides: SlideContent[]): string {
  return [...slides]
    .sort((left, right) => left.page_number - right.page_number)
    .map(formatSlide)
    .join("\n\n---\n\n");
}

