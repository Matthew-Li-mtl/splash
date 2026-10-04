import { Router } from "express";
import { z } from "zod";
import type { BlockedUserDTO } from "@splash/shared";
import { badRequest, currentUser, notFound, objectId } from "../http";
import { Block } from "../models/Block";
import { User } from "../models/User";
import { loadUsers, userOrPlaceholder } from "../serialize";
import { blockUser, unblockUser } from "../services/blocks";

export const blocksRouter = Router();

/** People I've blocked, newest first. */
blocksRouter.get("/", async (req, res) => {
  const me = currentUser(req);
  const blocks = await Block.find({ blockerId: me._id }).sort({ createdAt: -1 });
  const users = await loadUsers(blocks.map((b) => b.blockedId));
  const dtos: BlockedUserDTO[] = blocks.map((b) => ({
    user: userOrPlaceholder(users, b.blockedId),
    blockedAt: b.createdAt.toISOString(),
  }));
  res.json(dtos);
});

const blockSchema = z.object({ userId: z.string() });

/** Block someone. Idempotent. The other person isn't notified. */
blocksRouter.post("/", async (req, res) => {
  const me = currentUser(req);
  const targetId = objectId(blockSchema.parse(req.body).userId, "user");
  if (targetId.equals(me._id)) throw badRequest("You can't block yourself.");
  if (!(await User.exists({ _id: targetId }))) throw notFound("That person doesn't exist.");
  await blockUser(me, targetId);
  res.status(204).end();
});

blocksRouter.delete("/:userId", async (req, res) => {
  const me = currentUser(req);
  await unblockUser(me, objectId(req.params.userId, "user"));
  res.status(204).end();
});
