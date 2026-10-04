import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true, maxlength: 40 },
    passwordHash: { type: String, required: true },
    avatar: {
      emoji: { type: String, default: "🦊" },
      color: { type: String, default: "#f4a261" },
    },
    bio: { type: String, default: "", maxlength: 280 },
    interests: { type: [String], default: [] },
    neighborhoodId: { type: Schema.Types.ObjectId, ref: "Neighborhood", default: null, index: true },
    lastMovedAt: { type: Date, default: null },
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
