import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

const commentSchema = new Schema(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, maxlength: 1000 },
  },
  { timestamps: true },
);

export type CommentDoc = HydratedDocument<InferSchemaType<typeof commentSchema>>;
export const Comment = model("Comment", commentSchema);
