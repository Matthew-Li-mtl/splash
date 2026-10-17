import type { AssetUploadResponse } from "@splash/shared";
import { api } from "./api";

const MAX_SIDE = 1280;

interface CompressOptions {
  maxSide?: number;
  /** Center-crop to a square first. */
  square?: boolean;
}

/** Profile photos: a small square is all an avatar ever shows. */
export const PROFILE_PHOTO: CompressOptions = { maxSide: 320, square: true };

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Downscale and re-encode a photo before upload. Keeps each image around
 * 100–250 KB, which is what lets photo collages fit on the free database tier.
 */
export async function compressImage(
  file: File,
  { maxSide = MAX_SIDE, square = false }: CompressOptions = {},
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const sw = square ? Math.min(bitmap.width, bitmap.height) : bitmap.width;
  const sh = square ? sw : bitmap.height;
  const ratio = Math.min(1, maxSide / Math.max(sw, sh));
  const width = Math.round(sw * ratio);
  const height = Math.round(sh * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, width, height);
  bitmap.close();

  // Some browsers can't encode WebP and silently return PNG; fall back to JPEG then.
  let blob = await canvasToBlob(canvas, "image/webp", 0.8);
  if (!blob || blob.type !== "image/webp") blob = await canvasToBlob(canvas, "image/jpeg", 0.82);
  if (!blob) throw new Error("Couldn't read that image.");
  return { blob, width, height };
}

export async function uploadImage(file: File, options?: CompressOptions) {
  const { blob, width, height } = await compressImage(file, options);
  const res = await api<AssetUploadResponse>("/api/assets", { method: "POST", raw: blob });
  return { id: res.id, width, height };
}
