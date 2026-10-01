import { Schema, model } from "mongoose";

// Uploaded images (collage photos), compressed client-side to ~100–250 KB each.
// Stored in Mongo to stay on one free service; swap for R2/Cloudinary later by
// changing only routes/assets.ts. Ids are random so URLs aren't guessable.
const assetSchema = new Schema(
  {
    _id: { type: String, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true },
);

export const Asset = model("Asset", assetSchema);
