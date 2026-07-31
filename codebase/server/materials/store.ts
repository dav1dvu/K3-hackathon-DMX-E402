import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

export type MaterialRecord = {
  id: string;
  fileName: string;
  displayName: string;
  pageCount: number | null;
  uploadedAt: string;
};

export type DayRecord = {
  id: string;
  title: string;
  published: boolean;
  materials: MaterialRecord[];
};

export type LibraryData = {
  days: DayRecord[];
};

const DATA_DIR = process.env.MATERIALS_DATA_DIR ?? path.join(process.cwd(), "data", "library");
const LIBRARY_FILE = path.join(DATA_DIR, "library.json");
const FILES_DIR = path.join(DATA_DIR, "files");

export class MaterialsStoreError extends Error {
  readonly code: "DAY_NOT_FOUND" | "MATERIAL_NOT_FOUND";

  constructor(code: "DAY_NOT_FOUND" | "MATERIAL_NOT_FOUND", message: string) {
    super(message);
    this.name = "MaterialsStoreError";
    this.code = code;
  }
}

async function ensureDirs() {
  await mkdir(FILES_DIR, { recursive: true });
}

async function readLibrary(): Promise<LibraryData> {
  try {
    const raw = await readFile(LIBRARY_FILE, "utf-8");
    return JSON.parse(raw) as LibraryData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { days: [] };
    throw error;
  }
}

async function writeLibrary(data: LibraryData): Promise<void> {
  await ensureDirs();
  await writeFile(LIBRARY_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function findDay(data: LibraryData, dayId: string): DayRecord {
  const day = data.days.find((candidate) => candidate.id === dayId);
  if (!day) throw new MaterialsStoreError("DAY_NOT_FOUND", `Day ${dayId} was not found.`);
  return day;
}

export function materialFilePath(materialId: string): string {
  return path.join(FILES_DIR, `${materialId}.pdf`);
}

export async function listDays(): Promise<DayRecord[]> {
  const data = await readLibrary();
  return data.days;
}

export async function createDay(title: string): Promise<DayRecord> {
  const data = await readLibrary();
  const day: DayRecord = {
    id: randomUUID(),
    title,
    published: true,
    materials: [],
  };
  data.days.push(day);
  await writeLibrary(data);
  return day;
}

export async function setDayPublished(dayId: string, published: boolean): Promise<DayRecord> {
  const data = await readLibrary();
  const day = findDay(data, dayId);
  day.published = published;
  await writeLibrary(data);
  return day;
}

export async function deleteDay(dayId: string): Promise<void> {
  const data = await readLibrary();
  const day = findDay(data, dayId);
  await Promise.all(day.materials.map((material) => (
    rm(materialFilePath(material.id), { force: true })
  )));
  data.days = data.days.filter((candidate) => candidate.id !== dayId);
  await writeLibrary(data);
}

async function countPages(fileBuffer: Buffer): Promise<number | null> {
  try {
    const pdf = await PDFDocument.load(fileBuffer);
    return pdf.getPageCount();
  } catch {
    return null;
  }
}

export async function addMaterial(
  dayId: string,
  input: { fileName: string; displayName: string; fileBuffer: Buffer },
): Promise<MaterialRecord> {
  const data = await readLibrary();
  const day = findDay(data, dayId);

  const material: MaterialRecord = {
    id: randomUUID(),
    fileName: input.fileName,
    displayName: input.displayName,
    pageCount: await countPages(input.fileBuffer),
    uploadedAt: new Date().toISOString(),
  };

  await ensureDirs();
  await writeFile(materialFilePath(material.id), input.fileBuffer);
  day.materials.push(material);
  await writeLibrary(data);
  return material;
}

export async function deleteMaterial(dayId: string, materialId: string): Promise<void> {
  const data = await readLibrary();
  const day = findDay(data, dayId);
  const material = day.materials.find((candidate) => candidate.id === materialId);
  if (!material) {
    throw new MaterialsStoreError("MATERIAL_NOT_FOUND", `Material ${materialId} was not found.`);
  }
  day.materials = day.materials.filter((candidate) => candidate.id !== materialId);
  await writeLibrary(data);
  await rm(materialFilePath(materialId), { force: true });
}

export async function findMaterial(
  materialId: string,
): Promise<{ day: DayRecord; material: MaterialRecord } | null> {
  const data = await readLibrary();
  for (const day of data.days) {
    const material = day.materials.find((candidate) => candidate.id === materialId);
    if (material) return { day, material };
  }
  return null;
}
