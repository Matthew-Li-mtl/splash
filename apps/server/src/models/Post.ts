import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { POST_KINDS } from "@splash/shared";

const postSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: POST_KINDS, required: true },
    title: { type: String, default: "", maxlength: 120 },
    content: { type: Schema.Types.Mixed, required: true },
    visibility: { type: String, enum: ["neighbors", "private"], default: "neighbors" },
    reactions: {
      type: [{ _id: false, userId: { type: Schema.Types.ObjectId, required: true }, emoji: { type: String, required: true } }],
      default: [],
    },
    commentCount: { type: Number, default: 0 },
    remixOf: { type: Schema.Types.ObjectId, ref: "Post", default: null },
  },
  { timestamps: true, minimize: false },
);

// Feed = posts by the current members of your neighborhood, newest first.
postSchema.index({ authorId: 1, createdAt: -1 });

export type PostDoc = HydratedDocument<InferSchemaType<typeof postSchema>>;
export const Post = model("Post", postSchema);
