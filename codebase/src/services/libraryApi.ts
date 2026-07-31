import type { DayRecord, LibraryData, MaterialRecord } from "../types";

type ErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class LibraryApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "LibraryApiError";
    this.code = code;
  }
}

async function parseErrorAndThrow(response: Response): Promise<never> {
  const payload = await response.json().catch(() => ({})) as ErrorPayload;
  throw new LibraryApiError(
    payload.error?.code ?? `HTTP_${response.status}`,
    payload.error?.message ?? "Không thể kết nối tới thư viện học liệu.",
  );
}

export function materialFileUrl(materialId: string): string {
  return `/api/library/files/${materialId}`;
}

export async function fetchLibrary(): Promise<DayRecord[]> {
  const response = await fetch("/api/library");
  if (!response.ok) await parseErrorAndThrow(response);
  const payload = await response.json() as LibraryData;
  return payload.days;
}

export async function createDay(title: string): Promise<DayRecord> {
  const response = await fetch("/api/library/days", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) await parseErrorAndThrow(response);
  const payload = await response.json() as { day: DayRecord };
  return payload.day;
}

export async function setDayPublished(dayId: string, published: boolean): Promise<DayRecord> {
  const response = await fetch(`/api/library/days/${dayId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ published }),
  });
  if (!response.ok) await parseErrorAndThrow(response);
  const payload = await response.json() as { day: DayRecord };
  return payload.day;
}

export async function deleteDay(dayId: string): Promise<void> {
  const response = await fetch(`/api/library/days/${dayId}`, { method: "DELETE" });
  if (!response.ok && response.status !== 204) await parseErrorAndThrow(response);
}

export async function uploadMaterial(
  dayId: string,
  file: File,
  displayName: string,
): Promise<MaterialRecord> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("displayName", displayName);
  const response = await fetch(`/api/library/days/${dayId}/materials`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) await parseErrorAndThrow(response);
  const payload = await response.json() as { material: MaterialRecord };
  return payload.material;
}

export async function deleteMaterial(dayId: string, materialId: string): Promise<void> {
  const response = await fetch(`/api/library/days/${dayId}/materials/${materialId}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) await parseErrorAndThrow(response);
}
