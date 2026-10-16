import { Types } from "mongoose";
import { Block } from "../models/Block";
import { Game } from "../models/Game";
import type { UserDoc } from "../models/User";

// Blocking is mutual invisibility: if either person blocked the other, neither
// sees the other's posts, replies, reactions, porch messages or profile, and
// they can't message, challenge or reply to each other. Every read path asks
// this module, so there's one definition of "hidden".

/** Ids of everyone hidden from this user: people they blocked + people who blocked them. */
export async function hiddenUserIds(user: UserDoc): Promise<Set<string>> {
  const blocks = await Block.find({ $or: [{ blockerId: user._id }, { blockedId: user._id }] }, { blockerId: 1, blockedId: 1 });
  const ids = new Set<string>();
  for (const b of blocks) ids.add(b.blockerId.equals(user._id) ? b.blockedId.toString() : b.blockerId.toString());
  return ids;
}

/** Same as hiddenUserIds, as ObjectIds for use in queries ($nin). */
export async function hiddenObjectIds(user: UserDoc): Promise<Types.ObjectId[]> {
  return [...(await hiddenUserIds(user))].map((id) => new Types.ObjectId(id));
}

export async function isBlockedBetween(a: Types.ObjectId | string, b: Types.ObjectId | string): Promise<boolean> {
  const exists = await Block.exists({
    $or: [
      { blockerId: a, blockedId: b },
      { blockerId: b, blockedId: a },
    ],
  });
  return !!exists;
}

export async function blockUser(blocker: UserDoc, targetId: Types.ObjectId) {
  // Upsert so blocking twice is harmless (idempotent).
  await Block.updateOne({ blockerId: blocker._id, blockedId: targetId }, { $setOnInsert: { blockerId: blocker._id, blockedId: targetId } }, { upsert: true });
  // Any game between the two can no longer be played, so end it without a winner.
  await Game.updateMany(
    { status: "active", players: { $all: [blocker._id, targetId] } },
    { $set: { status: "finished", cancelled: true, "state.winner": -1 } },
  );
}

export async function unblockUser(blocker: UserDoc, targetId: Types.ObjectId) {
  await Block.deleteOne({ blockerId: blocker._id, blockedId: targetId });
}
