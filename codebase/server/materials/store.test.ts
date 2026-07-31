// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let store: typeof import("./store.js");
let tempDir: string;

async function onePagePdfBuffer(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.addPage([200, 200]);
  return Buffer.from(await pdf.save());
}

beforeAll(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "materials-store-"));
  process.env.MATERIALS_DATA_DIR = tempDir;
  store = await import("./store.js");
});

afterAll(async () => {
  delete process.env.MATERIALS_DATA_DIR;
  await rm(tempDir, { recursive: true, force: true });
});

describe("materials store", () => {
  it("starts with an empty day list", async () => {
    expect(await store.listDays()).toEqual([]);
  });

  it("creates a day, adds a material with a computed page count, then lists it", async () => {
    const day = await store.createDay("Day01");
    expect(day.published).toBe(true);
    expect(day.materials).toEqual([]);

    const material = await store.addMaterial(day.id, {
      fileName: "slides.pdf",
      displayName: "Slides",
      fileBuffer: await onePagePdfBuffer(),
    });
    expect(material.pageCount).toBe(1);

    const days = await store.listDays();
    expect(days).toHaveLength(1);
    expect(days[0].materials).toHaveLength(1);
    expect(days[0].materials[0].id).toBe(material.id);
  });

  it("finds a material by id across days", async () => {
    const day = await store.createDay("Day02");
    const material = await store.addMaterial(day.id, {
      fileName: "notes.pdf",
      displayName: "Notes",
      fileBuffer: await onePagePdfBuffer(),
    });

    const found = await store.findMaterial(material.id);
    expect(found?.day.id).toBe(day.id);
    expect(found?.material.id).toBe(material.id);
  });

  it("toggles publish state on a day", async () => {
    const day = await store.createDay("Day03");
    const updated = await store.setDayPublished(day.id, false);
    expect(updated.published).toBe(false);
  });

  it("deletes a material out of a day", async () => {
    const day = await store.createDay("Day04");
    const material = await store.addMaterial(day.id, {
      fileName: "a.pdf",
      displayName: "A",
      fileBuffer: await onePagePdfBuffer(),
    });
    await store.deleteMaterial(day.id, material.id);
    expect(await store.findMaterial(material.id)).toBeNull();
  });

  it("throws MaterialsStoreError for an unknown day", async () => {
    await expect(store.setDayPublished("missing-day", true)).rejects.toMatchObject({
      code: "DAY_NOT_FOUND",
    });
  });

  it("deletes a day and its materials", async () => {
    const day = await store.createDay("Day05");
    await store.addMaterial(day.id, {
      fileName: "b.pdf",
      displayName: "B",
      fileBuffer: await onePagePdfBuffer(),
    });
    await store.deleteDay(day.id);
    const days = await store.listDays();
    expect(days.find((candidate) => candidate.id === day.id)).toBeUndefined();
  });
});
