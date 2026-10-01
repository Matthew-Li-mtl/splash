import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { GAME_TYPES } from "@splash/shared";

const gameSchema = new Schema(
  {
    type: { type: String, enum: GAME_TYPES, required: true },
    /** Seat 0 is the challenger and moves first. */
    players: { type: [Schema.Types.ObjectId], ref: "User", required: true },
    state: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["active", "finished"], default: "active" },
    resignedBy: { type: Number, default: null },
    moveCount: { type: Number, default: 0 },
  },
  { timestamps: true, minimize: false },
);

gameSchema.index({ players: 1, updatedAt: -1 });

export type GameDoc = HydratedDocument<InferSchemaType<typeof gameSchema>>;
export const Game = model("Game", gameSchema);
