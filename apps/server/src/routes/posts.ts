import { Router } from "express";
import { z } from "zod";
import { REACTIONS, type CommentDTO, type PostPage } from "@splash/shared";
import { badRequest, currentUser, forbidden, notFound, objectId } from "../http";
import { Comment } from "../models/Comment";
import { Post } from "../models/Post";
import type { UserDoc } from "../models/User";
import { loadUsers, toPostDTOs, userOrPlaceholder } from "../serialize";
import { canViewPost, isNeighbor, memberIds } from "../services/access";
import { hiddenUserIds } from "../services/blocks";
import { contentSchemas, postKindSchema, visibilitySchema } from "../validation";

export const postsRouter = Router();

const PAGE_SIZE = 20;

function beforeFilter(before: unknown) {
  if (typeof before !== "string" || !before) return {};
  const date = new Date(before);
  if (Number.isNaN(date.getTime())) throw badRequest("Bad `before` date.");
  return { createdAt: { $lt: date } };
}

async function page(user: UserDoc, filter: object, before: unknown): Promise<PostPage> {
  const posts = await Post.find({ ...filter, ...beforeFilter(before) })
    .sort({ createdAt: -1 })
    .limit(PAGE_SIZE);
  return {
    posts: await toPostDTOs(posts, await hiddenUserIds(user)),
    nextBefore: posts.length === PAGE_SIZE ? posts[posts.length - 1].createdAt.toISOString() : null,
  };
}

async function findViewablePost(user: UserDoc, id: unknown) {
  const post = await Post.findById(objectId(id, "post"));
  if (!post || !(await canViewPost(user, post))) throw notFound("That post isn't available.");
  return post;
}

/** Everything your neighbors (and you) have shared, newest first. Ends — no infinite feed. */
postsRouter.get("/feed", async (req, res) => {
  const user = currentUser(req);
  const ids = await memberIds(user);
  res.json(await page(user, { authorId: { $in: ids }, visibility: "neighbors" }, req.query.before));
});

/** One person's posts, as visible to the requester (private ones only for yourself). */
postsRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const authorId = objectId(req.query.author, "author");
  const isSelf = authorId.equals(user._id);
  if (!isSelf && !(await isNeighbor(user, authorId))) throw notFound("That person isn't in your neighborhood.");
  res.json(await page(user, { authorId, ...(isSelf ? {} : { visibility: "neighbors" }) }, req.query.before));
});

const createSchema = z.object({
  kind: postKindSchema,
  title: z.string().trim().max(120).default(""),
  content: z.unknown(),
  visibility: visibilitySchema.default("neighbors"),
  remixOf: z.string().optional(),
});

postsRouter.post("/", async (req, res) => {
  const user = currentUser(req);
  const body = createSchema.parse(req.body);
  const content = contentSchemas[body.kind].parse(body.content);
  let remixOf = null;
  if (body.remixOf) remixOf = (await findViewablePost(user, body.remixOf))._id;
  const post = await Post.create({ authorId: user._id, kind: body.kind, title: body.title, content, visibility: body.visibility, remixOf });
  res.status(201).json((await toPostDTOs([post], await hiddenUserIds(user)))[0]);
});

postsRouter.get("/:id", async (req, res) => {
  const user = currentUser(req);
  const post = await findViewablePost(user, req.params.id);
  res.json((await toPostDTOs([post], await hiddenUserIds(user)))[0]);
});

const updateSchema = z.object({
  title: z.string().trim().max(120).optional(),
  content: z.unknown().optional(),
  visibility: visibilitySchema.optional(),
});

postsRouter.patch("/:id", async (req, res) => {
  const user = currentUser(req);
  const post = await findViewablePost(user, req.params.id);
  if (!post.authorId.equals(user._id)) throw forbidden("Only the author can edit this.");
  const body = updateSchema.parse(req.body);
  if (body.title !== undefined) post.title = body.title;
  if (body.visibility) post.visibility = body.visibility;
  if (body.content !== undefined) {
    post.content = contentSchemas[post.kind].parse(body.content);
    post.markModified("content");
  }
  await post.save();
  res.json((await toPostDTOs([post], await hiddenUserIds(user)))[0]);
});

postsRouter.delete("/:id", async (req, res) => {
  const user = currentUser(req);
  const post = await findViewablePost(user, req.params.id);
  if (!post.authorId.equals(user._id)) throw forbidden("Only the author can delete this.");
  await Promise.all([post.deleteOne(), Comment.deleteMany({ postId: post._id })]);
  res.status(204).end();
});

const reactionSchema = z.object({ emoji: z.enum(REACTIONS) });

/** Toggle one of the fixed reactions. */
postsRouter.put("/:id/reactions", async (req, res) => {
  const user = currentUser(req);
  const { emoji } = reactionSchema.parse(req.body);
  const post = await findViewablePost(user, req.params.id);
  const existing = post.reactions.findIndex((r) => r.userId.equals(user._id) && r.emoji === emoji);
  if (existing >= 0) post.reactions.splice(existing, 1);
  else post.reactions.push({ userId: user._id, emoji });
  await post.save();
  res.json((await toPostDTOs([post], await hiddenUserIds(user)))[0]);
});

postsRouter.get("/:id/comments", async (req, res) => {
  const user = currentUser(req);
  const post = await findViewablePost(user, req.params.id);
  const hidden = await hiddenUserIds(user);
  const comments = (await Comment.find({ postId: post._id }).sort({ createdAt: 1 }).limit(500)).filter((c) => !hidden.has(c.authorId.toString()));
  const users = await loadUsers(comments.map((c) => c.authorId));
  const dtos: CommentDTO[] = comments.map((c) => ({
    id: c.id,
    postId: post.id,
    author: userOrPlaceholder(users, c.authorId),
    text: c.text,
    createdAt: c.createdAt.toISOString(),
  }));
  res.json(dtos);
});

const commentSchema = z.object({ text: z.string().trim().min(1, "Say something!").max(1000) });

postsRouter.post("/:id/comments", async (req, res) => {
  const user = currentUser(req);
  const { text } = commentSchema.parse(req.body);
  const post = await findViewablePost(user, req.params.id);
  const comment = await Comment.create({ postId: post._id, authorId: user._id, text });
  await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });
  const users = await loadUsers([user._id]);
  const dto: CommentDTO = {
    id: comment.id,
    postId: post.id,
    author: userOrPlaceholder(users, user._id),
    text,
    createdAt: comment.createdAt.toISOString(),
  };
  res.status(201).json(dto);
});

postsRouter.delete("/:id/comments/:commentId", async (req, res) => {
  const user = currentUser(req);
  const post = await findViewablePost(user, req.params.id);
  const comment = await Comment.findOne({ _id: objectId(req.params.commentId, "comment"), postId: post._id });
  if (!comment) throw notFound("Comment not found.");
  if (!comment.authorId.equals(user._id) && !post.authorId.equals(user._id)) throw forbidden();
  await comment.deleteOne();
  await Post.updateOne({ _id: post._id }, { $inc: { commentCount: -1 } });
  res.status(204).end();
});
