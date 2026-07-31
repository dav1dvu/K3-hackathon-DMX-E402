/**
 * JsonSlideDocumentService
 *
 * Reads pre-processed JSON files from `data/processed/` directly.
 * No OCR, no PDF parsing, no Python script calls at runtime.
 *
 * Luồng:
 *   Khởi động → discover *.json trong processedDirectory
 *   → readFile + validate schema
 *   → expose qua listDocuments / getDocument / getProcessedDocument
 *   → chat dùng slides và lesson_context có sẵn trong JSON
 */

import { access, readdir, readFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import {
  buildLessonContext,
  groupElementsByPage,
  type ProcessedSlideDocument,
  type SlideContent,
  type SlideElement,
} from "./models.js";

export type SlideDocumentSummary = {
  id: string;
  filename: string;
  title: string;
  /** URL for the /file endpoint (PDF) or /slides (fallback when no PDF found) */
  url: string;
};

export type DiscoveredJsonDocument = SlideDocumentSummary & {
  jsonPath: string;
  /** Absolute path to the PDF file if it exists in slideDirectory, otherwise undefined */
  filePath?: string;
};

export class JsonSlideDocumentError extends Error {
  constructor(
    readonly code: "DOCUMENT_NOT_FOUND" | "DOCUMENT_INVALID" | "EMPTY_DOCUMENT",
    message: string,
  ) {
    super(message);
    this.name = "JsonSlideDocumentError";
  }
}

// ---------------------------------------------------------------------------
// Schema validation helpers (no external dep — keeps bundle slim)
// ---------------------------------------------------------------------------

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function validateSlideElement(raw: unknown): raw is SlideElement {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    isString(r.text) &&
    isString(r.filename) &&
    isPositiveInteger(r.page_number) &&
    isString(r.element_type)
  );
}

function validateSlideContent(raw: unknown): raw is SlideContent {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    isString(r.filename) &&
    isPositiveInteger(r.page_number) &&
    isString(r.text) &&
    isStringArray(r.element_types)
  );
}

/**
 * Validates and normalises a raw parsed JSON payload into ProcessedSlideDocument.
 * Returns null when the payload is structurally invalid; never throws.
 */
function validateProcessedDocument(
  raw: unknown,
  expectedId?: string,
): ProcessedSlideDocument | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const document_id = isString(r.document_id) ? r.document_id.trim() : "";
  const filename = isString(r.filename) ? r.filename.trim() : "";
  const fingerprint = isString(r.fingerprint) ? r.fingerprint : "";
  const total_pages = typeof r.total_pages === "number" && Number.isInteger(r.total_pages) && r.total_pages >= 0
    ? r.total_pages
    : 0;
  const processed_at = isString(r.processed_at) ? r.processed_at : new Date(0).toISOString();

  if (!document_id || !filename) return null;
  if (expectedId && document_id !== expectedId) return null;

  // elements — required array; filter invalid entries gracefully
  const rawElements = Array.isArray(r.elements) ? r.elements : [];
  const elements: SlideElement[] = rawElements.filter(validateSlideElement);

  // slides — use JSON-supplied array or derive from elements
  let slides: SlideContent[];
  if (Array.isArray(r.slides) && r.slides.length > 0 && r.slides.every(validateSlideContent)) {
    slides = r.slides as SlideContent[];
  } else {
    slides = groupElementsByPage(elements);
  }

  if (slides.length === 0) return null;

  // lesson_context — use pre-built string or rebuild it
  const lesson_context = isString(r.lesson_context) && r.lesson_context.trim()
    ? r.lesson_context
    : buildLessonContext(slides);

  // Derive total_pages from slides if the JSON value is missing/zero
  const resolvedTotalPages = total_pages > 0
    ? total_pages
    : Math.max(...slides.map((s) => s.page_number));

  return {
    document_id,
    filename,
    fingerprint,
    total_pages: resolvedTotalPages,
    processed_at,
    elements,
    slides,
    lesson_context,
  };
}

// ---------------------------------------------------------------------------
// Title helper (consistent with original document-service)
// ---------------------------------------------------------------------------

function titleFromFilename(filename: string): string {
  return basename(filename, extname(filename))
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export type JsonSlideDocumentServiceOptions = {
  processedDirectory?: string;
  /** Directory containing the original PDF files (for the viewer). Defaults to data/slide */
  slideDirectory?: string;
};

export class JsonSlideDocumentService {
  private readonly processedDirectory: string;
  private readonly slideDirectory: string;
  /** In-memory cache: document_id → loaded document */
  private readonly cache = new Map<string, ProcessedSlideDocument>();

  constructor(options: JsonSlideDocumentServiceOptions = {}) {
    this.processedDirectory = resolve(options.processedDirectory ?? "data/processed");
    this.slideDirectory = resolve(options.slideDirectory ?? "data/slide");
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async listDocuments(): Promise<SlideDocumentSummary[]> {
    const docs = await this.discoverDocuments();
    return docs.map(({ id, filename, title, url }) => ({ id, filename, title, url }));
  }

  async getDocument(documentId: string): Promise<DiscoveredJsonDocument> {
    const docs = await this.discoverDocuments();
    const found = docs.find(({ id }) => id === documentId);
    if (!found) {
      throw new JsonSlideDocumentError(
        "DOCUMENT_NOT_FOUND",
        "Không tìm thấy tài liệu trong data/processed.",
      );
    }
    return found;
  }

  async getDocumentDetails(documentId: string) {
    const doc = await this.getDocument(documentId);
    const processed = await this.getProcessedDocument(documentId);
    return {
      id: doc.id,
      filename: doc.filename,
      title: doc.title,
      url: doc.url,
      status: "ready" as const,
      total_pages: processed.total_pages,
    };
  }

  async getProcessedDocument(documentId: string): Promise<ProcessedSlideDocument> {
    // Check in-memory cache first
    const cached = this.cache.get(documentId);
    if (cached) return cached;

    const doc = await this.getDocument(documentId);
    const loaded = await this.loadJson(doc.jsonPath, documentId);
    this.cache.set(documentId, loaded);
    return loaded;
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private async discoverDocuments(): Promise<DiscoveredJsonDocument[]> {
    let entries: import("node:fs").Dirent<string>[];
    try {
      entries = await readdir(this.processedDirectory, { withFileTypes: true, encoding: "utf8" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }

    const jsonFiles = entries
      .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".json")
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

    const results: DiscoveredJsonDocument[] = [];
    for (const jsonFilename of jsonFiles) {
      const jsonPath = join(this.processedDirectory, jsonFilename);
      const id = basename(jsonFilename, ".json");
      // Quick-load to verify document_id matches (skip malformed files)
      try {
        const raw = JSON.parse(await readFile(jsonPath, "utf8")) as Record<string, unknown>;
        const docId = isString(raw.document_id) ? raw.document_id.trim() : id;
        const filename = isString(raw.filename) ? raw.filename.trim() : `${id}.pdf`;
        // Check if the original PDF exists in slideDirectory
        const pdfPath = join(this.slideDirectory, filename);
        let filePath: string | undefined;
        try {
          await access(pdfPath);
          filePath = pdfPath;
        } catch {
          // PDF not found — viewer will show slide text fallback
        }
        const url = filePath
          ? `/api/slides/documents/${encodeURIComponent(docId)}/file`
          : `/api/slides/documents/${encodeURIComponent(docId)}/slides`;
        results.push({
          id: docId,
          filename,
          title: titleFromFilename(filename),
          url,
          jsonPath,
          filePath,
        });
      } catch (error) {
        // Skip invalid / unreadable JSON files gracefully
        console.warn(JSON.stringify({
          event: "json_document_discovery_skipped",
          jsonFilename,
          reason: error instanceof Error ? error.message : "Unknown error",
        }));
      }
    }
    return results;
  }

  private async loadJson(
    jsonPath: string,
    documentId: string,
  ): Promise<ProcessedSlideDocument> {
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(jsonPath, "utf8"));
    } catch (error) {
      throw new JsonSlideDocumentError(
        "DOCUMENT_INVALID",
        `Không thể đọc file JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    const doc = validateProcessedDocument(raw);
    if (!doc) {
      throw new JsonSlideDocumentError(
        "DOCUMENT_INVALID",
        "File JSON không đúng định dạng ProcessedSlideDocument.",
      );
    }
    if (doc.slides.length === 0) {
      throw new JsonSlideDocumentError(
        "EMPTY_DOCUMENT",
        "File JSON không chứa nội dung slide.",
      );
    }

    console.info(JSON.stringify({
      event: "json_document_loaded",
      documentId,
      filename: doc.filename,
      totalSlides: doc.slides.length,
      totalPages: doc.total_pages,
    }));

    return doc;
  }
}
