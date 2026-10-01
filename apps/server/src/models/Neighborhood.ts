import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

// Membership lives on User.neighborhoodId (single source of truth). memberCount and
// interestCounts are denormalized so assignment can pick a neighborhood in one query.
const neighborhoodSchema = new Schema(
  {
    name: { type: String, required: true },
    inviteCode: { type: String, required: true, unique: true },
    memberCount: { type: Number, default: 0, index: true },
    interestCounts: { type: Map, of: Number, default: () => new Map() },
  },
  { timestamps: true },
);

export type NeighborhoodDoc = HydratedDocument<InferSchemaType<typeof neighborhoodSchema>>;
export const Neighborhood = model("Neighborhood", neighborhoodSchema);
