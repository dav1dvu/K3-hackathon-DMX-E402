import type { PDFDocumentProxy, PDFPageProxy, TextItem } from "pdfjs-dist/types/src/display/api";
import type { DocumentKnowledge, IngestionProgress, PageContent } from "../types";
import { createDocumentIndex } from "./indexing";
import { createLessonOverview } from "./overview";
import { normalizeWhitespace, truncate } from "./text";

export type OcrEngine = (
  page: PDFPageProxy,
  onProgress?: (progress: number) => void,
) => Promise<string>;

export type IngestionOptions = {
  ocrEngine?: OcrEngine;
  onProgress?: (progress: IngestionProgress) => void;
};

const MIN_TEXT_LENGTH = 24;
const OCR_FALLBACK_TEXT_LENGTH = 40;

function textFromItems(items: Array<TextItem | unknown>) {
  return items
    .map((item) => {
      if (!("str" in (item as object))) return "";
      const textItem = item as TextItem;
      return `${textItem.str}${textItem.hasEOL ? "\n" : " "}`;
    })
    .join("")
    .split("\n")
    .map(normalizeWhitespace)
    .filter(Boolean)
    .join("\n");
}

function deriveTitle(content: string, pageNumber: number) {
  const firstLine = content.split("\n").map(normalizeWhitespace).find(Boolean);
  return firstLine ? truncate(firstLine, 90) : `Trang ${pageNumber}`;
}

function shouldUseOcr(extractedText: string) {
  return extractedText.length < Math.max(MIN_TEXT_LENGTH, OCR_FALLBACK_TEXT_LENGTH);
}

async function defaultOcrEngine(page: PDFPageProxy, onProgress?: (progress: number) => void) {
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(2.2, 2200 / Math.max(baseViewport.width, baseViewport.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Trình duyệt không hỗ trợ canvas để OCR.");
  await page.render({ canvas, canvasContext: context, viewport }).promise;

  const { recognize } = await import("tesseract.js");
  const result = await recognize(canvas, "eng+vie", {
    logger: (message) => {
      if (message.status === "recognizing text") onProgress?.(message.progress);
    },
  });
  canvas.width = 0;
  canvas.height = 0;
  return normalizeWhitespace(result.data.text);
}

export async function extractPage(
  page: PDFPageProxy,
  pageNumber: number,
  ocrEngine: OcrEngine,
  onOcrProgress?: (progress: number) => void,
): Promise<PageContent> {
  const textContent = await page.getTextContent();
  const pdfText = textFromItems(textContent.items);
  const needsOcr = shouldUseOcr(pdfText);

  if (!needsOcr) {
    return {
      pageNumber,
      content: normalizeWhitespace(pdfText),
      sourceType: "pdf_text",
      title: deriveTitle(pdfText, pageNumber),
    };
  }

  const ocrText = normalizeWhitespace(await ocrEngine(page, onOcrProgress));
  const combined = normalizeWhitespace([pdfText, ocrText].filter(Boolean).join(" "));
  return {
    pageNumber,
    content: combined,
    sourceType: ocrText ? "ocr" : pdfText ? "pdf_text" : "empty",
    title: deriveTitle(combined, pageNumber),
  };
}

export async function ingestPdfDocument(
  pdf: PDFDocumentProxy,
  fileName: string,
  options: IngestionOptions = {},
): Promise<DocumentKnowledge> {
  const pages: PageContent[] = [];
  const ocrEngine = options.ocrEngine ?? defaultOcrEngine;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    options.onProgress?.({
      processedPages: pageNumber - 1,
      totalPages: pdf.numPages,
      currentPage: pageNumber,
      stage: "extracting",
    });
    const page = await pdf.getPage(pageNumber);
    const pageContent = await extractPage(page, pageNumber, ocrEngine, () => {
      options.onProgress?.({
        processedPages: pageNumber - 1,
        totalPages: pdf.numPages,
        currentPage: pageNumber,
        stage: "ocr",
      });
    });
    pages.push(pageContent);
  }

  options.onProgress?.({
    processedPages: pdf.numPages,
    totalPages: pdf.numPages,
    currentPage: pdf.numPages,
    stage: "indexing",
  });
  const index = createDocumentIndex(pages, fileName);
  const overview = createLessonOverview(index.pages, fileName.replace(/\.pdf$/i, ""));
  options.onProgress?.({
    processedPages: pdf.numPages,
    totalPages: pdf.numPages,
    currentPage: pdf.numPages,
    stage: "complete",
  });
  return { index, overview };
}
