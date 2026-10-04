import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

// One document per signed-in device ("session family"). It holds hashes of the
// device's current refresh token and the one before it. Rotating replaces
// currentHash; seeing previousHash again outside a short grace window means the
// token was stolen and replayed, so the whole session is revoked.
const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    currentHash: { type: String, required: true, unique: true },
    previousHash: { type: String, default: null, index: true },
    rotatedAt: { type: Date, default: null },
    /** Short description of the browser/device, for the "signed-in devices" list. */
    userAgent: { type: String, default: "" },
    lastUsedAt: { type: Date, default: () => new Date() },
    // MongoDB deletes the document by itself once this time passes (TTL index), so
    // expired sessions clean themselves up without a cron job.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);

export type SessionDoc = HydratedDocument<InferSchemaType<typeof sessionSchema>>;
export const Session = model("Session", sessionSchema);
