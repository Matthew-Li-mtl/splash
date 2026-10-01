import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config";
import { HttpError } from "./http";
import { User, type UserDoc } from "./models/User";

declare global {
  namespace Express {
    interface Request {
      user?: UserDoc;
    }
  }
}

// Bearer tokens (not cookies) so the same API works from the web app and from
// the Capacitor mobile app, which runs on a different origin.
export function signToken(userId: string): string {
  return jwt.sign({}, config.jwtSecret, { subject: userId, expiresIn: "90d" });
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new HttpError(401, "Please sign in.");

  let userId: string | undefined;
  try {
    userId = jwt.verify(token, config.jwtSecret).sub as string | undefined;
  } catch {
    throw new HttpError(401, "Your session expired. Please sign in again.");
  }
  const user = userId ? await User.findById(userId) : null;
  if (!user) throw new HttpError(401, "Please sign in.");
  req.user = user;
  next();
};
