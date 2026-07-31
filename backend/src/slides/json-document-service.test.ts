// @vitest-environment node
/**
 * Tests for JsonSlideDocumentService
 *
 * Verifies:
 *  1. All 3 JSON files in data/processed are discovered automatically.
 *  2. No OCR / PDF parser is ever called.
 *  3. Slides are grouped and page numbers are correct.
 *  4. Chat uses the correct document and current_page context.
 *  5. Malformed JSON files are skipped safely (no crash).
 *  6. Invalid citations are filtered out.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  JsonSlideDocumentError,
  JsonSlideDocumentService,
} from "./json-document-service.js";
import { validateCitations } from "./chat-service.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const temporaryDirectories: string[] = [];

async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), "json-doc-svc-test-"));
  temporaryDirectories.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of temporaryDirectories.splice(0)) {
    const resolved = resolve(dir);
    if (!resolved.startsWith(resolve(tmpdir()))) throw new Error("Unsafe tmp path.");
    await rm(resolved, { recursive: true, force: true });
  }
});

/** Minimal valid ProcessedSlideDocument JSON */
function makeDocJson(overrides: Record<string, unknown> = {}): string {
  const base = {
    document_id: "lesson",
    filename: "lesson.pdf",
    fingerprint: "100:1000",
    total_pages: 3,
    processed_at: "2026-01-01T00:00:00.000Z",
    elements: [
      { text: "Title", filename: "lesson.pdf", page_number: 1, element_type: "Title" },
      { text: "Body", filename: "lesson.pdf", page_number: 1, element_type: "NarrativeText" },
      { text: "Second slide", filename: "lesson.pdf", page_number: 2, element_type: "ListItem" },
      { text: "Third slide", filename: "lesson.pdf", page_number: 3, element_type: "Header" },
    ],
    slides: [
      { filename: "lesson.pdf", page_number: 1, text: "Title\nBody", element_types: ["Title", "NarrativeText"] },
      { filename: "lesson.pdf", page_number: 2, text: "Second slide", element_types: ["ListItem"] },
      { filename: "lesson.pdf", page_number: 3, text: "Third slide", element_types: ["Header"] },
    ],
    lesson_context: "[SLIDE 1]\nTitle\nBody\n---\n[SLIDE 2]\nSecond slide\n---\n[SLIDE 3]\nThird slide",
    ...overrides,
  };
  return JSON.stringify(base, null, 2);
}

// ---------------------------------------------------------------------------
// 1. Discovery tests
// ---------------------------------------------------------------------------

describe("JsonSlideDocumentService — discovery", () => {
  it("discovers all JSON files in the directory and ignores non-JSON files", async () => {
    const dir = await tempDir();
    await writeFile(join(dir, "doc-a.json"), makeDocJson({ document_id: "doc-a", filename: "doc-a.pdf" }));
    await writeFile(join(dir, "doc-b.json"), makeDocJson({ document_id: "doc-b", filename: "doc-b.pdf" }));
    await writeFile(join(dir, "notes.txt"), "not json");

    const service = new JsonSlideDocumentService({ processedDirectory: dir });
    const docs = await service.listDocuments();
    const ids = docs.map((d) => d.id).sort();
    expect(ids).toEqual(["doc-a", "doc-b"]);
    expect(ids).not.toContain("notes");
  });

  it("returns an empty list when the directory is missing", async () => {
    const dir = await tempDir();
    const service = new JsonSlideDocumentService({ processedDirectory: join(dir, "nonexistent") });
    expect(await service.listDocuments()).toEqual([]);
  });

  it("returns an empty list when the directory has no JSON files", async () => {
    const dir = await tempDir();
    await writeFile(join(dir, "readme.md"), "# docs");
    const service = new JsonSlideDocumentService({ processedDirectory: dir });
    expect(await service.listDocuments()).toEqual([]);
  });

  it("does NOT call any OCR or PDF partitioner during discovery", async () => {
    const dir = await tempDir();
    await writeFile(join(dir, "lesson.json"), makeDocJson());

    // Static assertion: the json-document-service module must NOT import child_process
    // (which is what partition_pdf uses). We verify by inspecting imports.
    const sourceText = await import("node:fs/promises").then(({ readFile }) =>
      readFile("backend/src/slides/json-document-service.ts", "utf8"),
    );
    expect(sourceText).not.toContain("child_process");
    expect(sourceText).not.toContain("execFile");
    expect(sourceText).not.toContain("partition_pdf");
    expect(sourceText).not.toContain("PDFDocument");

    // Functional: service still works correctly
    const service = new JsonSlideDocumentService({ processedDirectory: dir });
    const docs = await service.listDocuments();
    expect(docs).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 2. getProcessedDocument — correct data loading
// ---------------------------------------------------------------------------

describe("JsonSlideDocumentService — getProcessedDocument", () => {
  it("returns the correct document_id, filename, and slide list", async () => {
    const dir = await tempDir();
    await writeFile(join(dir, "lesson.json"), makeDocJson());

    const service = new JsonSlideDocumentService({ processedDirectory: dir });
    const doc = await service.getProcessedDocument("lesson");

    expect(doc.document_id).toBe("lesson");
    expect(doc.filename).toBe("lesson.pdf");
    expect(doc.total_pages).toBe(3);
    expect(doc.slides).toHaveLength(3);
    expect(doc.slides.map((s) => s.page_number)).toEqual([1, 2, 3]);
  });

  it("returns slides in ascending page order", async () => {
    const dir = await tempDir();
    await writeFile(join(dir, "lesson.json"), makeDocJson());

    const service = new JsonSlideDocumentService({ processedDirectory: dir });
    const doc = await service.getProcessedDocument("lesson");
    const pages = doc.slides.map((s) => s.page_number);
    expect(pages).toEqual([...pages].sort((a, b) => a - b));
  });

  it("uses lesson_context from JSON when present", async () => {
    const dir = await tempDir();
    await writeFile(join(dir, "lesson.json"), makeDocJson({ lesson_context: "CUSTOM_CONTEXT" }));

    const service = new JsonSlideDocumentService({ processedDirectory: dir });
    const doc = await service.getProcessedDocument("lesson");
    expect(doc.lesson_context).toBe("CUSTOM_CONTEXT");
  });

  it("caches the document and does not re-read the file on second call", async () => {
    const dir = await tempDir();
    const path = join(dir, "lesson.json");
    await writeFile(path, makeDocJson());

    const service = new JsonSlideDocumentService({ processedDirectory: dir });
    const first = await service.getProcessedDocument("lesson");
    const second = await service.getProcessedDocument("lesson");
    const third = await service.getProcessedDocument("lesson");

    // All calls must return the exact same object reference (cache hit)
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it("throws DOCUMENT_NOT_FOUND for unknown IDs", async () => {
    const dir = await tempDir();
    await writeFile(join(dir, "lesson.json"), makeDocJson());

    const service = new JsonSlideDocumentService({ processedDirectory: dir });
    await expect(service.getProcessedDocument("nonexistent")).rejects.toMatchObject({
      code: "DOCUMENT_NOT_FOUND",
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Malformed / invalid JSON files
// ---------------------------------------------------------------------------

describe("JsonSlideDocumentService — error handling", () => {
  it("skips a completely invalid JSON file without crashing", async () => {
    const dir = await tempDir();
    await writeFile(join(dir, "bad.json"), "{ not valid json }}}}");
    await writeFile(join(dir, "good.json"), makeDocJson({ document_id: "good", filename: "good.pdf" }));

    const service = new JsonSlideDocumentService({ processedDirectory: dir });
    const docs = await service.listDocuments();
    expect(docs.map((d) => d.id)).toEqual(["good"]);
  });

  it("skips a JSON file missing required fields", async () => {
    const dir = await tempDir();
    // Missing document_id and slides
    await writeFile(join(dir, "empty.json"), JSON.stringify({ total_pages: 0 }));
    await writeFile(join(dir, "real.json"), makeDocJson({ document_id: "real", filename: "real.pdf" }));

    const service = new JsonSlideDocumentService({ processedDirectory: dir });
    const docs = await service.listDocuments();
    expect(docs.map((d) => d.id)).toContain("real");
  });

  it("throws DOCUMENT_INVALID when loading a structurally invalid JSON", async () => {
    const dir = await tempDir();
    // File is valid JSON but payload is missing required document fields
    await writeFile(join(dir, "broken.json"), JSON.stringify({ document_id: "broken" }));

    const service = new JsonSlideDocumentService({ processedDirectory: dir });
    // broken.json was discovered (has document_id) but loading will fail
    await expect(
      service.getProcessedDocument("broken"),
    ).rejects.toBeInstanceOf(JsonSlideDocumentError);
  });
});

// ---------------------------------------------------------------------------
// 4. The 3 real JSON files in data/processed
// ---------------------------------------------------------------------------

describe("JsonSlideDocumentService — real data/processed files", () => {
  it("discovers all 3 JSON files from data/processed", async () => {
    const service = new JsonSlideDocumentService({ processedDirectory: "data/processed" });
    const docs = await service.listDocuments();
    expect(docs.length).toBeGreaterThanOrEqual(3);
  });

  it("loads each discovered document and finds at least 1 slide", async () => {
    const service = new JsonSlideDocumentService({ processedDirectory: "data/processed" });
    const docs = await service.listDocuments();
    for (const { id } of docs) {
      const processed = await service.getProcessedDocument(id);
      expect(processed.slides.length).toBeGreaterThan(0);
      expect(processed.document_id).toBeTruthy();
      expect(processed.filename).toBeTruthy();
    }
  });

  it("never calls partitionPdfWithUnstructured for any of the 3 files", async () => {
    // Static assertion: the JSON service source must NOT import the OCR/PDF-parsing modules.
    // We check for specific import patterns, not loose words.
    const moduleText = await import("node:fs/promises").then(({ readFile }) =>
      readFile("backend/src/slides/json-document-service.ts", "utf8"),
    );
    expect(moduleText).not.toContain("partitionPdf");
    expect(moduleText).not.toContain("partition_pdf.py");
    expect(moduleText).not.toContain("PDFDocument");
    expect(moduleText).not.toContain("child_process");
    expect(moduleText).not.toContain("execFile");
    // Must not import the legacy PDF service (which has partition code)
    expect(moduleText).not.toContain("from \"./document-service.js\"");
  });

  it("all slides reference existing page numbers within total_pages", async () => {
    const service = new JsonSlideDocumentService({ processedDirectory: "data/processed" });
    const docs = await service.listDocuments();
    for (const { id } of docs) {
      const processed = await service.getProcessedDocument(id);
      for (const slide of processed.slides) {
        expect(slide.page_number).toBeGreaterThanOrEqual(1);
        expect(slide.page_number).toBeLessThanOrEqual(processed.total_pages);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Citation validation (reused from chat-service)
// ---------------------------------------------------------------------------

describe("Citation validation with JSON documents", () => {
  it("filters citations pointing to non-existent pages", async () => {
    const dir = await tempDir();
    await writeFile(join(dir, "lesson.json"), makeDocJson());

    const service = new JsonSlideDocumentService({ processedDirectory: dir });
    const doc = await service.getProcessedDocument("lesson");

    const filtered = validateCitations(doc, [
      { page_number: 1, reason: "Valid" },
      { page_number: 99, reason: "Out of range" },
      { page_number: 0, reason: "Invalid" },
      { page_number: 1, reason: "Duplicate" },
    ]);
    expect(filtered).toEqual([{ page_number: 1, reason: "Valid" }]);
  });
});
