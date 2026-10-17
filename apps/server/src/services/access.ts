import type { Types } from "mongoose";
import { User, type UserDoc } from "../models/User";
import { hiddenUserIds, isBlockedBetween } from "./blocks";
import type { PostDoc } from "../models/Post";

/** Ids of everyone in the user's neighborhood, including the user, minus anyone blocked either way. */
export async function memberIds(user: UserDoc): Promise<Types.ObjectId[]> {
  if (!user.neighborhoodId) return [user._id];
  const [members, hidden] = await Promise.all([
    User.find({ neighborhoodId: user.neighborhoodId }, { _id: 1 }),
    hiddenUserIds(user),
  ]);
  return members.map((m) => m._id as Types.ObjectId).filter((id) => !hidden.has(id.toString()));
}

/**
 * Same neighborhood AND not blocked either way. Every "can these two interact?" check
 * (profiles, posts, messages, games) goes through here, so a block applies everywhere.
 */
export async function isNeighbor(user: UserDoc, otherId: Types.ObjectId | string): Promise<boolean> {
  if (!user.neighborhoodId) return false;
  const other = await User.findById(otherId, { neighborhoodId: 1 });
  if (!other?.neighborhoodId?.equals(user.neighborhoodId)) return false;
  return !(await isBlockedBetween(user._id, other._id));
}

export async function canViewPost(user: UserDoc, post: PostDoc): Promise<boolean> {
  if (post.authorId.equals(user._id)) return true;
  if (post.visibility === "private") return false;
  return isNeighbor(user, post.authorId);
}
