import type { Types } from "mongoose";
import { User, type UserDoc } from "../models/User";
import type { PostDoc } from "../models/Post";

/** Ids of everyone in the user's neighborhood, including the user. */
export async function memberIds(user: UserDoc): Promise<Types.ObjectId[]> {
  if (!user.neighborhoodId) return [user._id];
  const members = await User.find({ neighborhoodId: user.neighborhoodId }, { _id: 1 });
  return members.map((m) => m._id as Types.ObjectId);
}

export async function isNeighbor(user: UserDoc, otherId: Types.ObjectId | string): Promise<boolean> {
  if (!user.neighborhoodId) return false;
  const other = await User.findById(otherId, { neighborhoodId: 1 });
  return !!other?.neighborhoodId?.equals(user.neighborhoodId);
}

export async function canViewPost(user: UserDoc, post: PostDoc): Promise<boolean> {
  if (post.authorId.equals(user._id)) return true;
  if (post.visibility === "private") return false;
  return isNeighbor(user, post.authorId);
}
