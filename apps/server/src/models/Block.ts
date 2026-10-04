import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

// "blockerId blocked blockedId". Blocking hides the two people from each other
// everywhere (see services/blocks.ts), so lookups go both ways: by blockerId
// (people I blocked) and by blockedId (people who blocked me).
const blockSchema = new Schema(
  {
    blockerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    blockedId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true },
);

// One block per pair and direction; also serves "people I blocked" queries.
blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

export type BlockDoc = HydratedDocument<InferSchemaType<typeof blockSchema>>;
export const Block = model("Block", blockSchema);
