import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import {
  addMaterial,
  createDay,
  deleteDay,
  deleteMaterial,
  findMaterial,
  listDays,
  materialFilePath,
  setDayPublished,
  MaterialsStoreError,
} from "./store.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const createDaySchema = z.object({
  title: z.string().trim().min(1).max(120),
});

const setPublishedSchema = z.object({
  published: z.boolean(),
});

function handleStoreError(error: unknown, response: import("express").Response) {
  if (error instanceof MaterialsStoreError) {
    response.status(404).json({ error: { code: error.code, message: error.message } });
    return true;
  }
  return false;
}

export function createMaterialsRouter(): Router {
  const router = Router();

  router.get("/", async (_request, response) => {
    const days = await listDays();
    response.json({ days });
  });

  router.post("/days", async (request, response) => {
    const parsed = createDaySchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: { code: "INVALID_REQUEST", message: "Title is required." } });
      return;
    }
    const day = await createDay(parsed.data.title);
    response.status(201).json({ day });
  });

  router.patch("/days/:dayId", async (request, response) => {
    const parsed = setPublishedSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: { code: "INVALID_REQUEST", message: "published must be boolean." } });
      return;
    }
    try {
      const day = await setDayPublished(request.params.dayId, parsed.data.published);
      response.json({ day });
    } catch (error) {
      if (!handleStoreError(error, response)) throw error;
    }
  });

  router.delete("/days/:dayId", async (request, response) => {
    try {
      await deleteDay(request.params.dayId);
      response.status(204).end();
    } catch (error) {
      if (!handleStoreError(error, response)) throw error;
    }
  });

  router.post("/days/:dayId/materials", upload.single("file"), async (request, response) => {
    const file = request.file;
    if (!file) {
      response.status(400).json({ error: { code: "INVALID_REQUEST", message: "A PDF file is required." } });
      return;
    }
    const displayName = typeof request.body.displayName === "string" && request.body.displayName.trim()
      ? request.body.displayName.trim()
      : file.originalname;
    try {
      const material = await addMaterial(String(request.params.dayId), {
        fileName: file.originalname,
        displayName,
        fileBuffer: file.buffer,
      });
      response.status(201).json({ material });
    } catch (error) {
      if (!handleStoreError(error, response)) throw error;
    }
  });

  router.delete("/days/:dayId/materials/:materialId", async (request, response) => {
    try {
      await deleteMaterial(request.params.dayId, request.params.materialId);
      response.status(204).end();
    } catch (error) {
      if (!handleStoreError(error, response)) throw error;
    }
  });

  router.get("/files/:materialId", async (request, response) => {
    const found = await findMaterial(request.params.materialId);
    if (!found) {
      response.status(404).json({ error: { code: "MATERIAL_NOT_FOUND", message: "Material was not found." } });
      return;
    }
    response.setHeader("content-type", "application/pdf");
    response.setHeader(
      "content-disposition",
      `inline; filename="${encodeURIComponent(found.material.displayName)}.pdf"`,
    );
    response.sendFile(materialFilePath(request.params.materialId));
  });

  return router;
}
