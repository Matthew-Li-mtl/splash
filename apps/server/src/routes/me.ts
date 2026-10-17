import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Badges } from "@splash/shared";
import { HttpError, badRequest, currentUser } from "../http";
import { Asset } from "../models/Asset";
import { Game } from "../models/Game";
import { toMe } from "../serialize";
import { updateInterestCounts } from "../services/neighborhoods";
import { listThreads } from "./messages";
import { interestsSchema } from "../validation";

export const meRouter = Router();

meRouter.get("/", (req, res) => {
  res.json(toMe(currentUser(req)));
});

const updateSchema = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  bio: z.string().trim().max(280).optional(),
  /** An asset id from POST /api/assets, or null to go back to initials. */
  photoId: z.string().max(64).nullable().optional(),
  interests: interestsSchema.optional(),
});

meRouter.patch("/", async (req, res) => {
  const user = currentUser(req);
  const body = updateSchema.parse(req.body);
  if (body.interests) {
    await updateInterestCounts(user, user.interests, body.interests);
    user.interests = body.interests;
  }
  if (body.displayName !== undefined) user.displayName = body.displayName;
  if (body.bio !== undefined) user.bio = body.bio;
  if (body.photoId !== undefined && body.photoId !== user.photoId) {
    if (body.photoId && !(await Asset.exists({ _id: body.photoId, ownerId: user._id }))) throw badRequest("Upload the photo first.");
    // The old photo only ever served as this avatar, so free its space.
    if (user.photoId) await Asset.deleteOne({ _id: user.photoId, ownerId: user._id });
    user.photoId = body.photoId;
  }
  await user.save();
  res.json(toMe(user));
});

const passwordSchema = z.object({
  current: z.string(),
  next: z.string().min(8, "Passwords need at least 8 characters.").max(200),
});

meRouter.post("/password", async (req, res) => {
  const user = currentUser(req);
  const { current, next } = passwordSchema.parse(req.body);
  if (!(await bcrypt.compare(current, user.passwordHash))) throw new HttpError(400, "Your current password doesn't match.");
  user.passwordHash = await bcrypt.hash(next, 10);
  await user.save();
  res.json({ ok: true });
});

/** Small counts for nav dots. Polled about once a minute. */
meRouter.get("/badges", async (req, res) => {
  const user = currentUser(req);
  const [yourTurn, threads] = await Promise.all([
    Game.countDocuments({
      status: "active",
      $or: [
        { "players.0": user._id, "state.turn": 0 },
        { "players.1": user._id, "state.turn": 1 },
      ],
    }),
    listThreads(user),
  ]);
  const badges: Badges = { yourTurn, unreadThreads: threads.filter((t) => t.unread).length };
  res.json(badges);
});
