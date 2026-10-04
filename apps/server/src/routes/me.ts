import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Badges, SessionDTO } from "@splash/shared";
import { HttpError, currentUser, objectId } from "../http";
import { Session } from "../models/Session";
import { Game } from "../models/Game";
import { toMe } from "../serialize";
import { updateInterestCounts } from "../services/neighborhoods";
import { createSession, endAllSessions } from "../services/sessions";
import { respond } from "./auth";
import { listThreads } from "./messages";
import { avatarSchema, interestsSchema } from "../validation";

export const meRouter = Router();

meRouter.get("/", (req, res) => {
  res.json(toMe(currentUser(req)));
});

const updateSchema = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  bio: z.string().trim().max(280).optional(),
  avatar: avatarSchema.optional(),
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
  if (body.avatar) user.avatar = body.avatar;
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
  // A new password should lock out anyone who had the old one: invalidate every
  // access token and sign out every device, then start a fresh session here.
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
  await endAllSessions(user._id);
  const session = await createSession(user._id, req, res);
  respond(res, user, session.id);
});

/** Signed-in devices, most recently used first. */
meRouter.get("/sessions", async (req, res) => {
  const user = currentUser(req);
  const sessions = await Session.find({ userId: user._id }).sort({ lastUsedAt: -1 });
  const dtos: SessionDTO[] = sessions.map((s) => ({
    id: s.id,
    device: s.userAgent || "Unknown device",
    lastUsedAt: s.lastUsedAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
    current: s.id === req.sessionId,
  }));
  res.json(dtos);
});

/**
 * Sign out one device. Its refresh token stops working right away; an access token
 * it already holds keeps working until it expires (at most 15 minutes).
 */
meRouter.delete("/sessions/:id", async (req, res) => {
  const user = currentUser(req);
  await Session.deleteOne({ _id: objectId(req.params.id, "session"), userId: user._id });
  res.status(204).end();
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
