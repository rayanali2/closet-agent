import { ApiError, Client } from "magic-hour";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Garment } from "./wardrobe-agent.ts";

export const GENERATION_ERROR = "Magic Hour couldn't generate this preview. Try another photo.";

export function magicHour() {
  const token = process.env.MAGIC_HOUR_API_KEY?.trim();
  if (!token) throw new Error("MAGIC_HOUR_API_KEY is missing from the server environment.");
  return new Client({ token, baseUrl: "https://api.magichour.ai", timeout: 20_000 });
}

export async function createTryOn(bytes: Uint8Array<ArrayBuffer>, extension: "jpg" | "png", garment: Garment, client = magicHour()) {
  const garmentBytes = await readFile(path.join(process.cwd(), "public", garment.image));
  const uploads = await client.v1.files.uploadUrls.create({ items: [
    { type: "image", extension }, { type: "image", extension: "jpg" },
  ] }, { retries: { maxRetries: 0 } });
  const [personUpload, garmentUpload] = uploads.items;
  if (!personUpload || !garmentUpload) throw new Error("Magic Hour did not return both upload URLs.");
  await Promise.all([
    { upload: personUpload, body: bytes, type: extension === "png" ? "image/png" : "image/jpeg" },
    { upload: garmentUpload, body: new Uint8Array(garmentBytes), type: "image/jpeg" },
  ].map(async ({ upload, body, type }) => {
    const response = await fetch(upload.uploadUrl, {
      method: "PUT", body, headers: { "Content-Type": type }, signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Magic Hour asset upload failed (${response.status}).`);
  }));
  // Disable automatic retries on the paid creation call.
  // SDK 0.83.0 requires deprecated frame_cost in parsed responses. The current
  // API schema omits it. Read the raw response without reissuing the request.
  const response = await client.v1.aiClothesChanger.create({
    name: `Closet Agent — ${garment.name}`,
    assets: { personFilePath: personUpload.filePath, garmentFilePath: garmentUpload.filePath, garmentType: garment.garmentType },
  }, { retries: { maxRetries: 0 } }).asResponse();
  const project = await response.json() as { id?: unknown };
  if (typeof project.id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(project.id)) {
    throw new Error("Magic Hour returned an invalid project ID.");
  }
  return project.id;
}

export async function getTryOn(id: string, client = magicHour()) {
  // The parsed SDK status schema also requires deprecated total_frame_cost.
  const response = await client.v1.imageProjects.get({ id }, { retries: { maxRetries: 0 } }).asResponse();
  const project = await response.json() as { status?: string; downloads?: { url?: string }[]; error?: { code?: string; message?: string } | null };
  if (!project.status || !["draft", "queued", "rendering", "complete", "error", "canceled"].includes(project.status)) {
    throw new Error(`Project ${id} returned an invalid status.`);
  }
  if (project.status === "error" || project.status === "canceled") {
    throw new Error(`Project ${id}: ${project.status}: ${project.error?.code ?? ""} ${project.error?.message ?? ""}`);
  }
  const imageUrl = Array.isArray(project.downloads) ? project.downloads[0]?.url : undefined;
  if (project.status === "complete" && (typeof imageUrl !== "string" || !imageUrl.startsWith("https://"))) {
    throw new Error(`Project ${id} completed without a valid download URL.`);
  }
  return { status: project.status, ...(project.status === "complete" ? { imageUrl } : {}) };
}

// Never log SDK error objects: they can contain the authenticated request.
export async function logMagicHourError(error: unknown) {
  let detail = error instanceof Error ? error.message : "Unknown server error";
  if (error instanceof ApiError) {
    try { detail += ` ${await error.response.clone().text()}`; } catch { /* response unavailable */ }
  }
  const key = process.env.MAGIC_HOUR_API_KEY?.trim();
  if (key) detail = detail.split(key).join("[REDACTED]");
  console.error("[Closet Agent]", detail.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").slice(0, 2000));
}
