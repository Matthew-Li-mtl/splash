import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

// Membership lives on User.neighborhoodId (single source of truth). memberCount,
// interestCounts and privateCount are denormalized so matching can pick a street in one query.
const neighborhoodSchema = new Schema(
  {
    name: { type: String, required: true },
    inviteCode: { type: String, required: true, unique: true },
    memberCount: { type: Number, default: 0, index: true },
    interestCounts: { type: Map, of: Number, default: () => new Map() },
    /**
     * How many members asked for invite only. The street is invite only while this is above 0.
     * Older streets don't have the field; queries use `$not: { $gt: 0 }` so missing counts as open.
     */
    privateCount: { type: Number, default: 0 },
    /** Who started the street. Older streets have none. */
    founderId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    /** Set once the default name has been replaced, by the founder or by a vote. */
    named: { type: Boolean, default: false },
    /** At most one open rename vote. `votes` holds the ids of members who said yes. */
    nameProposal: {
      type: new Schema(
        {
          name: { type: String, required: true },
          proposerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
          votes: { type: [Schema.Types.ObjectId], default: [] },
          createdAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);

export type NeighborhoodDoc = HydratedDocument<InferSchemaType<typeof neighborhoodSchema>>;
export const Neighborhood = model("Neighborhood", neighborhoodSchema);
