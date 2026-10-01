import type { Types } from "mongoose";
import type { Me, PostDTO, PublicUser, ReactionSummary } from "@splash/shared";
import { User, type UserDoc } from "./models/User";
import { Post, type PostDoc } from "./models/Post";

type UserLike = Pick<UserDoc, "_id" | "username" | "displayName" | "avatar" | "bio" | "interests" | "createdAt">;

export function toPublicUser(u: UserLike): PublicUser {
  return {
    id: u._id.toString(),
    username: u.username,
    displayName: u.displayName,
    avatar: { emoji: u.avatar?.emoji ?? "🦊", color: u.avatar?.color ?? "#f4a261" },
    bio: u.bio ?? "",
    interests: u.interests ?? [],
    createdAt: u.createdAt.toISOString(),
  };
}

export function toMe(u: UserDoc): Me {
  return {
    ...toPublicUser(u),
    neighborhoodId: u.neighborhoodId?.toString() ?? null,
    lastMovedAt: u.lastMovedAt?.toISOString() ?? null,
  };
}

/** Load public profiles for a set of ids in one query. */
export async function loadUsers(ids: (Types.ObjectId | string)[]): Promise<Map<string, PublicUser>> {
  const unique = [...new Set(ids.map(String))];
  const users = unique.length ? await User.find({ _id: { $in: unique } }) : [];
  return new Map(users.map((u) => [u._id.toString(), toPublicUser(u)]));
}

const deletedUser = (id: string): PublicUser => ({
  id,
  username: "former-neighbor",
  displayName: "Former neighbor",
  avatar: { emoji: "🏚️", color: "#c9ada7" },
  bio: "",
  interests: [],
  createdAt: new Date(0).toISOString(),
});

export function userOrPlaceholder(users: Map<string, PublicUser>, id: Types.ObjectId | string): PublicUser {
  return users.get(String(id)) ?? deletedUser(String(id));
}

function summarizeReactions(reactions: PostDoc["reactions"]): ReactionSummary[] {
  const byEmoji = new Map<string, string[]>();
  for (const r of reactions) {
    const list = byEmoji.get(r.emoji) ?? [];
    list.push(r.userId.toString());
    byEmoji.set(r.emoji, list);
  }
  return [...byEmoji].map(([emoji, userIds]) => ({ emoji, userIds }));
}

/** Serialize posts with their authors (and remix sources) resolved. */
export async function toPostDTOs(posts: PostDoc[]): Promise<PostDTO[]> {
  const remixIds = posts.map((p) => p.remixOf).filter((id): id is Types.ObjectId => !!id);
  const remixSources = remixIds.length
    ? await Post.find({ _id: { $in: remixIds } }, { authorId: 1 })
    : [];
  const remixAuthor = new Map(remixSources.map((p) => [p._id.toString(), p.authorId.toString()]));
  const users = await loadUsers([...posts.map((p) => p.authorId), ...remixAuthor.values()]);

  return posts.map((p) => {
    const remixAuthorId = p.remixOf ? remixAuthor.get(p.remixOf.toString()) : undefined;
    return {
      id: p._id.toString(),
      kind: p.kind,
      title: p.title ?? "",
      content: p.content,
      visibility: p.visibility,
      author: userOrPlaceholder(users, p.authorId),
      reactions: summarizeReactions(p.reactions),
      commentCount: p.commentCount,
      remixOf: p.remixOf
        ? { id: p.remixOf.toString(), author: remixAuthorId ? (users.get(remixAuthorId) ?? null) : null }
        : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    } as PostDTO;
  });
}
