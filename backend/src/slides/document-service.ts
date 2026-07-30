import { execFile } from "node:child_process";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { PDFDocument } from "pdf-lib";
import {
  buildLessonContext,
  groupElementsByPage,
  normalizeElement,
  type ProcessedSlideDocument,
  type RawPartitionElement,
} from "./models.js";

const execFileAsync = promisify(execFile);

export type SlideDocumentSummary = {
  id: string;
  filename: string;
  title: string;
  url: string;
};

export type DiscoveredSlideDocument = SlideDocumentSummary & {
  filePath: string;
};

export type PdfPartitioner = (pdfPath: string) => Promise<RawPartitionElement[]>;

export class SlideDocumentError extends Error {
  constructor(
    readonly code: "DOCUMENT_NOT_FOUND" | "DOCUMENT_PROCESSING_FAILED" | "EMPTY_DOCUMENT",
    message: string,
  ) {
    super(message);
    this.name = "SlideDocumentError";
  }
}

function titleFromFilename(filename: string) {
  return basename(filename, extname(filename))
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function idFromFilename(filename: string) {
  const value = basename(filename, extname(filename))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return value || "document";
}

function parsePartitionOutput(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) throw new Error("Partition output is empty.");
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const arrayStart = trimmed.indexOf("[");
    const arrayEnd = trimmed.lastIndexOf("]");
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      return JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1));
    }
    throw error;
  }
}
export async function partitionPdfWithUnstructured(pdfPath: string): Promise<RawPartitionElement[]> {
  const pythonExecutable = process.env.PYTHON_EXECUTABLE?.trim() || "python";
  const timeoutMs = Number(process.env.PDF_PROCESSING_TIMEOUT_MS ?? 120_000);
  const scriptPath = resolve("backend/src/slides/partition_pdf.py");
  const startedAt = Date.now();
  console.info(JSON.stringify({
    event: "slide_partition_started",
    filename: basename(pdfPath),
    pythonExecutable,
    timeoutMs,
  }));
  try {
    const { stdout, stderr } = await execFileAsync(pythonExecutable, [scriptPath, pdfPath], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: timeoutMs,
      windowsHide: true,
    });
    if (stderr.trim()) {
      console.warn(JSON.stringify({
        event: "slide_partition_warning",
        filename: basename(pdfPath),
        detail: stderr.trim().slice(-2_000),
      }));
    }
    const payload = parsePartitionOutput(stdout);
    if (!Array.isArray(payload)) throw new Error("Partition output is not an array.");
    console.info(JSON.stringify({
      event: "slide_partition_completed",
      filename: basename(pdfPath),
      elementCount: payload.length,
      durationMs: Date.now() - startedAt,
    }));
    return payload as RawPartitionElement[];
  } catch (error) {
    const processError = error as Error & { killed?: boolean; stderr?: string };
    const timedOut = processError.killed || /timed out/i.test(processError.message);
    const detail = processError.stderr?.trim() || processError.message || "Unknown partition error";
    console.error(JSON.stringify({
      event: "slide_partition_failed",
      filename: basename(pdfPath),
      durationMs: Date.now() - startedAt,
      timedOut,
      detail: detail.slice(-2_000),
    }));
    throw new SlideDocumentError(
      "DOCUMENT_PROCESSING_FAILED",
      timedOut
        ? `Unstructured exceeded the ${timeoutMs}ms PDF processing timeout.`
        : `Unstructured could not process the PDF: ${detail}`,
    );
  }
}

export type SlideDocumentServiceOptions = {
  slideDirectory?: string;
  processedDirectory?: string;
  partitioner?: PdfPartitioner;
};

export class SlideDocumentService {
  private readonly slideDirectory: string;
  private readonly processedDirectory: string;
  private readonly partitioner: PdfPartitioner;
  private readonly processing = new Map<string, Promise<ProcessedSlideDocument>>();

  constructor(options: SlideDocumentServiceOptions = {}) {
    this.slideDirectory = resolve(options.slideDirectory ?? "data/slide");
    this.processedDirectory = resolve(options.processedDirectory ?? "data/processed");
    this.partitioner = options.partitioner ?? partitionPdfWithUnstructured;
  }

  async listDocuments(): Promise<SlideDocumentSummary[]> {
    const documents = await this.discoverDocuments();
    return documents.map((document) => ({
      id: document.id,
      filename: document.filename,
      title: document.title,
      url: document.url,
    }));
  }

  async getDocument(documentId: string): Promise<DiscoveredSlideDocument> {
    const document = (await this.discoverDocuments()).find(({ id }) => id === documentId);
    if (!document) {
      throw new SlideDocumentError("DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu PDF.");
    }
    return document;
  }

  async getDocumentDetails(documentId: string) {
    const document = await this.getDocument(documentId);
    const totalPages = await this.readTotalPages(document.filePath);
    const cache = await this.readValidCache(document);
    return {
      id: document.id,
      filename: document.filename,
      title: document.title,
      url: document.url,
      status: cache ? "ready" as const : "processing" as const,
      total_pages: totalPages,
    };
  }

  async getProcessedDocument(documentId: string): Promise<ProcessedSlideDocument> {
    const document = await this.getDocument(documentId);
    const cached = await this.readValidCache(document);
    if (cached) return cached;

    const active = this.processing.get(document.id);
    if (active) return active;

    const task = this.processDocument(document).finally(() => {
      this.processing.delete(document.id);
    });
    this.processing.set(document.id, task);
    return task;
  }

  private async discoverDocuments(): Promise<DiscoveredSlideDocument[]> {
    let entries;
    try {
      entries = await import("node:fs/promises").then(({ readdir }) => (
        readdir(this.slideDirectory, { withFileTypes: true })
      ));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }

    const filenames = entries
      .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".pdf")
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
    const usedIds = new Map<string, number>();

    return filenames.map((filename) => {
      const baseId = idFromFilename(filename);
      const occurrence = (usedIds.get(baseId) ?? 0) + 1;
      usedIds.set(baseId, occurrence);
      const id = occurrence === 1 ? baseId : `${baseId}-${occurrence}`;
      return {
        id,
        filename,
        title: titleFromFilename(filename),
        url: `/api/slides/documents/${encodeURIComponent(id)}/file`,
        filePath: join(this.slideDirectory, filename),
      };
    });
  }

  private async fingerprint(document: DiscoveredSlideDocument) {
    const metadata = await stat(document.filePath);
    return `${metadata.size}:${Math.trunc(metadata.mtimeMs)}`;
  }

  private cachePath(documentId: string) {
    return join(this.processedDirectory, `${documentId}.json`);
  }

  private async readValidCache(
    document: DiscoveredSlideDocument,
  ): Promise<ProcessedSlideDocument | null> {
    try {
      const payload = JSON.parse(
        await readFile(this.cachePath(document.id), "utf8"),
      ) as ProcessedSlideDocument;
      const fingerprint = await this.fingerprint(document);
      if (
        payload.document_id !== document.id
        || payload.filename !== document.filename
        || payload.fingerprint !== fingerprint
        || !Array.isArray(payload.elements)
        || !Array.isArray(payload.slides)
      ) return null;
      return payload;
    } catch (error) {
      if (
        error instanceof SyntaxError
        || (error as NodeJS.ErrnoException).code === "ENOENT"
      ) return null;
      throw error;
    }
  }

  private async processDocument(
    document: DiscoveredSlideDocument,
  ): Promise<ProcessedSlideDocument> {
    const startedAt = Date.now();
    const [rawElements, totalPages, fingerprint] = await Promise.all([
      this.partitioner(document.filePath),
      this.readTotalPages(document.filePath),
      this.fingerprint(document),
    ]);
    const elements = rawElements.flatMap((element) => {
      const normalized = normalizeElement(element, document.filename);
      return normalized ? [normalized] : [];
    });
    const slides = groupElementsByPage(elements);
    if (!slides.length) {
      throw new SlideDocumentError(
        "EMPTY_DOCUMENT",
        "Không trích xuất được nội dung từ tài liệu PDF.",
      );
    }

    const processed: ProcessedSlideDocument = {
      document_id: document.id,
      filename: document.filename,
      fingerprint,
      total_pages: totalPages,
      processed_at: new Date().toISOString(),
      elements,
      slides,
      lesson_context: buildLessonContext(slides),
    };
    await mkdir(this.processedDirectory, { recursive: true });
    const cachePath = this.cachePath(document.id);
    const temporaryPath = `${cachePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(processed, null, 2)}\n`, "utf8");
    await rename(temporaryPath, cachePath);
    console.info(JSON.stringify({
      event: "slide_document_processed",
      documentId: document.id,
      filename: document.filename,
      totalElements: elements.length,
      totalPages,
      partitionDurationMs: Date.now() - startedAt,
    }));
    return processed;
  }

  private async readTotalPages(pdfPath: string) {
    try {
      const bytes = await readFile(pdfPath);
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      return pdf.getPageCount();
    } catch (pdfLibError) {
      try {
        const { stdout } = await execFileAsync("pdfinfo", [pdfPath], {
          encoding: "utf8",
          windowsHide: true,
          timeout: 20_000,
        });
        const pagesLine = stdout.split(/\r?\n/).find((line) => /^Pages:\s*\d+/i.test(line));
        const pageCount = pagesLine ? Number(pagesLine.replace(/^Pages:\s*/i, "")) : NaN;
        if (Number.isInteger(pageCount) && pageCount > 0) {
          console.warn(JSON.stringify({
            event: "pdf_page_count_fallback",
            filename: basename(pdfPath),
            pageCount,
            reason: pdfLibError instanceof Error ? pdfLibError.message : "pdf-lib failed",
          }));
          return pageCount;
        }
      } catch (pdfInfoError) {
        console.error(JSON.stringify({
          event: "pdf_page_count_fallback_failed",
          filename: basename(pdfPath),
          reason: pdfInfoError instanceof Error ? pdfInfoError.message : "pdfinfo failed",
        }));
      }
      throw new SlideDocumentError(
        "DOCUMENT_PROCESSING_FAILED",
        "Không thể đọc số trang của tài liệu PDF.",
      );
    }
  }
}


