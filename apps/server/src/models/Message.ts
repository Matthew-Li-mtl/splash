import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

// One collection for both the neighborhood porch and direct messages; `channel`
// is "nb_<neighborhoodId>" or "dm_<userA>_<userB>" (see @splash/shared).
const messageSchema = new Schema(
  {
    channel: { type: String, required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true },
);

messageSchema.index({ channel: 1, createdAt: -1 });

export type MessageDoc = HydratedDocument<InferSchemaType<typeof messageSchema>>;
export const Message = model("Message", messageSchema);
