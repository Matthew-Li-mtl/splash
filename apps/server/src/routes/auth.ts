import { Router, type RequestHandler, type Response } from "express";
import bcrypt from "bcryptjs";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { NEIGHBORHOOD_CAPACITY, USERNAME_PATTERN, type AuthResponse } from "@splash/shared";
import { ACCESS_TOKEN_TTL_SECONDS, requireAuth, signAccessToken } from "../auth";
import { config } from "../config";
import { HttpError, badRequest, currentUser } from "../http";
import { Neighborhood } from "../models/Neighborhood";
import { User, type UserDoc } from "../models/User";
import { toMe } from "../serialize";
import { assignNeighborhood } from "../services/neighborhoods";
import { clearRefreshCookie, createSession, endAllSessions, endSession, rotateSession } from "../services/sessions";
import { avatarSchema, interestsSchema } from "../validation";

export const authRouter = Router();

const limiterOptions = { windowMs: 15 * 60 * 1000, standardHeaders: "draft-8", legacyHeaders: false } as const;
// Guessing passwords is the attack to slow down, so credential routes get a tight limit.
// (Relaxed outside production so local testing and the smoke tests don't trip it.)
const credentialLimiter = rateLimit({ ...limiterOptions, limit: config.isProd ? 20 : 1000 });
// Refresh runs every ~15 minutes per open tab, so it needs more room.
const sessionLimiter = rateLimit({ ...limiterOptions, limit: config.isProd ? 120 : 5000 });

/**
 * The refresh/logout routes authenticate with a cookie, which makes them a CSRF
 * target. SameSite=Strict already stops cross-site requests from carrying it; as a
 * second layer, insist on a JSON body. A plain HTML form can't send one, and a
 * cross-origin script can't without passing a CORS preflight.
 */
const requireJson: RequestHandler = (req, _res, next) => {
  if (!req.is("application/json")) throw new HttpError(415, "Send a JSON body.");
  next();
};

export function respond(res: Response, user: UserDoc, sessionId: string, status = 200) {
  const body: AuthResponse = {
    accessToken: signAccessToken(user, sessionId),
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: toMe(user),
  };
  res.status(status).json(body);
}

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, "Usernames are 3–20 characters: lowercase letters, numbers or underscores.");

const registerSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1, "What should neighbors call you?").max(40),
  password: z.string().min(8, "Passwords need at least 8 characters.").max(200),
  avatar: avatarSchema,
  interests: interestsSchema.default([]),
  inviteCode: z.string().trim().max(32).optional(),
});

authRouter.post("/register", credentialLimiter, async (req, res) => {
  const body = registerSchema.parse(req.body);
  if (await User.exists({ username: body.username })) throw new HttpError(409, "That username is taken.");

  // Check the invite before creating the account so a bad code doesn't leave a half-made user.
  if (body.inviteCode) {
    const invited = await Neighborhood.findOne({ inviteCode: body.inviteCode });
    if (!invited) throw badRequest("That invite code doesn't match any neighborhood.");
    if (invited.memberCount >= NEIGHBORHOOD_CAPACITY) {
      throw badRequest("That neighborhood is full. Sign up without the code to be matched with another one.");
    }
  }

  const user = await User.create({
    username: body.username,
    displayName: body.displayName,
    passwordHash: await bcrypt.hash(body.password, 10),
    avatar: body.avatar,
    interests: body.interests,
  });
  try {
    await assignNeighborhood(user, { inviteCode: body.inviteCode || undefined });
  } catch (err) {
    await user.deleteOne();
    throw err;
  }

  const session = await createSession(user._id, req, res);
  respond(res, user, session.id, 201);
});

const loginSchema = z.object({ username: z.string().trim().toLowerCase(), password: z.string() });
// Compared against when the username doesn't exist, so a wrong username takes as
// long as a wrong password and response timing can't reveal which usernames exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

authRouter.post("/login", credentialLimiter, async (req, res) => {
  const { username, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ username });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, "Wrong username or password.", "bad_credentials");
  if (!user.neighborhoodId) await assignNeighborhood(user);
  const session = await createSession(user._id, req, res);
  respond(res, user, session.id);
});

/** Swap the refresh cookie for a new one plus a fresh access token. */
authRouter.post("/refresh", sessionLimiter, requireJson, async (req, res) => {
  const session = await rotateSession(req, res);
  const user = await User.findById(session.userId);
  if (!user) {
    await session.deleteOne();
    clearRefreshCookie(res);
    throw new HttpError(401, "Please sign in again.", "session_ended");
  }
  respond(res, user, session.id);
});

/** Sign out this device. Safe to call even if already signed out. */
authRouter.post("/logout", sessionLimiter, requireJson, async (req, res) => {
  await endSession(req, res);
  res.status(204).end();
});

/** Sign out every device, and invalidate every access token immediately. */
authRouter.post("/logout-all", sessionLimiter, requireJson, requireAuth, async (req, res) => {
  const user = currentUser(req);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
  await endAllSessions(user._id);
  clearRefreshCookie(res);
  res.status(204).end();
});
