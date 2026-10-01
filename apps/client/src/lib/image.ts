import type { AssetUploadResponse } from "@splash/shared";
import { api } from "./api";

const MAX_SIDE = 1280;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Downscale and re-encode a photo before upload. Keeps each image around
 * 100–250 KB, which is what lets photo collages fit on the free database tier.
 */
export async function compressImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * ratio);
  const height = Math.round(bitmap.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Some browsers can't encode WebP and silently return PNG; fall back to JPEG then.
  let blob = await canvasToBlob(canvas, "image/webp", 0.8);
  if (!blob || blob.type !== "image/webp") blob = await canvasToBlob(canvas, "image/jpeg", 0.82);
  if (!blob) throw new Error("Couldn't read that image.");
  return { blob, width, height };
}

export async function uploadImage(file: File) {
  const { blob, width, height } = await compressImage(file);
  const res = await api<AssetUploadResponse>("/api/assets", { method: "POST", raw: blob });
  return { id: res.id, width, height };
}
