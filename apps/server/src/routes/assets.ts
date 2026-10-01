import { randomBytes } from "node:crypto";
import express, { Router } from "express";
import type { AssetUploadResponse } from "@splash/shared";
import { requireAuth } from "../auth";
import { config } from "../config";
import { HttpError, badRequest, currentUser, notFound } from "../http";
import { Asset } from "../models/Asset";

export const assetsRouter = Router();

const MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Trust the bytes, not the Content-Type header. */
function sniffImage(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.toString("ascii", 0, 4) === "GIF8") return "image/gif";
  return null;
}

assetsRouter.post("/", requireAuth, express.raw({ type: MIME_TYPES, limit: "2mb" }), async (req, res) => {
  const user = currentUser(req);
  const data = req.body;
  if (!Buffer.isBuffer(data) || data.length === 0) throw badRequest("Send an image (JPEG, PNG, WebP or GIF).");
  const mime = sniffImage(data);
  if (!mime) throw badRequest("That doesn't look like an image.");

  const [usage] = await Asset.aggregate<{ total: number }>([
    { $match: { ownerId: user._id } },
    { $group: { _id: null, total: { $sum: "$size" } } },
  ]);
  if ((usage?.total ?? 0) + data.length > config.assetQuotaBytes) {
    throw new HttpError(413, "You've used all your photo space. Delete some old collages to free it up.");
  }

  const asset = await Asset.create({ _id: randomBytes(16).toString("base64url"), ownerId: user._id, mime, size: data.length, data });
  const response: AssetUploadResponse = { id: asset._id, size: asset.size };
  res.status(201).json(response);
});

/** Public by unguessable id so plain <img> tags work (they can't send auth headers). */
assetsRouter.get("/:id", async (req, res) => {
  const asset = await Asset.findById(String(req.params.id));
  if (!asset) throw notFound();
  res.set({ "Content-Type": asset.mime, "Cache-Control": "public, max-age=31536000, immutable" });
  res.send(asset.data);
});
