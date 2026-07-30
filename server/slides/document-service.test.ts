// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SlideDocumentService } from "./document-service.js";

const temporaryDirectories: string[] = [];

async function workspace() {
  const root = await mkdtemp(join(tmpdir(), "slidewise-test-"));
  temporaryDirectories.push(root);
  const slides = join(root, "slide");
  const processed = join(root, "processed");
  await mkdir(slides, { recursive: true });
  return { root, slides, processed };
}

async function createPdf(path: string, pages = 2) {
  const pdf = await PDFDocument.create();
  for (let page = 0; page < pages; page += 1) pdf.addPage([320, 180]);
  await writeFile(path, await pdf.save());
}

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    const resolved = resolve(directory);
    if (!resolved.startsWith(resolve(tmpdir()))) throw new Error("Unsafe temporary path.");
    await rm(resolved, { recursive: true, force: true });
  }
});

describe("SlideDocumentService", () => {
  it("detects PDF files in stable order and ignores other files", async () => {
    const { slides, processed } = await workspace();
    await createPdf(join(slides, "b-lesson.pdf"));
    await createPdf(join(slides, "A-lesson.PDF"));
    await writeFile(join(slides, "notes.txt"), "not a pdf", "utf8");
    const service = new SlideDocumentService({ slideDirectory: slides, processedDirectory: processed });
    expect((await service.listDocuments()).map((document) => document.filename)).toEqual([
      "A-lesson.PDF",
      "b-lesson.pdf",
    ]);
  });

  it("returns an empty document list when the slide directory is missing or empty", async () => {
    const { root, slides, processed } = await workspace();
    const empty = new SlideDocumentService({ slideDirectory: slides, processedDirectory: processed });
    const missing = new SlideDocumentService({ slideDirectory: join(root, "missing"), processedDirectory: processed });
    expect(await empty.listDocuments()).toEqual([]);
    expect(await missing.listDocuments()).toEqual([]);
  });

  it("partitions once, retains metadata, groups pages and reuses valid cache", async () => {
    const { slides, processed } = await workspace();
    await createPdf(join(slides, "lesson.pdf"), 3);
    const partitioner = vi.fn().mockResolvedValue([
      { text: "Title", filename: "lesson.pdf", page_number: 1, element_type: "Title" },
      { text: "Body", filename: "lesson.pdf", page_number: 1, element_type: "NarrativeText" },
      { text: "Second", filename: "lesson.pdf", page_number: 2, element_type: "ListItem" },
      { text: "  ", filename: "lesson.pdf", page_number: 3, element_type: "Text" },
    ]);
    const service = new SlideDocumentService({ slideDirectory: slides, processedDirectory: processed, partitioner });
    const first = await service.getProcessedDocument("lesson");
    const second = await service.getProcessedDocument("lesson");

    expect(partitioner).toHaveBeenCalledOnce();
    expect(first).toEqual(second);
    expect(first.total_pages).toBe(3);
    expect(first.elements[0]).toMatchObject({ filename: "lesson.pdf", page_number: 1, element_type: "Title" });
    expect(first.slides).toHaveLength(2);
    expect(first.lesson_context.indexOf("[SLIDE 1]")).toBeLessThan(first.lesson_context.indexOf("[SLIDE 2]"));
  });

  it("rejects unknown IDs instead of resolving paths", async () => {
    const { slides, processed } = await workspace();
    await createPdf(join(slides, "lesson.pdf"));
    const service = new SlideDocumentService({ slideDirectory: slides, processedDirectory: processed });
    await expect(service.getDocument("../../secret")).rejects.toMatchObject({
      code: "DOCUMENT_NOT_FOUND",
    });
  });
});
