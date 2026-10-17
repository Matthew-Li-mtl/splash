import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true, maxlength: 40 },
    passwordHash: { type: String, required: true },
    /** Asset id of an uploaded profile photo. */
    photoId: { type: String, default: null },
    bio: { type: String, default: "", maxlength: 280 },
    interests: { type: [String], default: [] },
    neighborhoodId: { type: Schema.Types.ObjectId, ref: "Neighborhood", default: null, index: true },
    lastMovedAt: { type: Date, default: null },
    /**
     * Asked for their street to be invite only. Registration sets it explicitly (true unless they
     * chose to be matched); accounts from before this setting existed have no value and count as open.
     */
    wantsPrivate: { type: Boolean },
    /** Bumped to instantly invalidate every access token (password change, "sign out everywhere"). */
    tokenVersion: { type: Number, default: 0 },
    /** channel id → when this user last read it. */
    readMarkers: { type: Map, of: Date, default: () => new Map() },
  },
  { timestamps: true },
);

export type UserFields = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserFields>;
export const User = model("User", userSchema);
