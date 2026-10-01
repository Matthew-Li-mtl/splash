import { Router } from "express";
import bcrypt from "bcryptjs";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { NEIGHBORHOOD_CAPACITY, USERNAME_PATTERN, type AuthResponse } from "@splash/shared";
import { signToken } from "../auth";
import { HttpError, badRequest } from "../http";
import { Neighborhood } from "../models/Neighborhood";
import { User } from "../models/User";
import { toMe } from "../serialize";
import { assignNeighborhood } from "../services/neighborhoods";
import { avatarSchema, interestsSchema } from "../validation";

export const authRouter = Router();

authRouter.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false }));

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

authRouter.post("/register", async (req, res) => {
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

  const response: AuthResponse = { token: signToken(user.id), user: toMe(user) };
  res.status(201).json(response);
});

const loginSchema = z.object({ username: z.string().trim().toLowerCase(), password: z.string() });

authRouter.post("/login", async (req, res) => {
  const { username, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, "Wrong username or password.");
  }
  if (!user.neighborhoodId) await assignNeighborhood(user);
  const response: AuthResponse = { token: signToken(user.id), user: toMe(user) };
  res.json(response);
});
