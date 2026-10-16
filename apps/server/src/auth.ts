import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config";
import { HttpError } from "./http";
import { User, type UserDoc } from "./models/User";

declare global {
  namespace Express {
    interface Request {
      user?: UserDoc;
      /** The session (signed-in device) the access token belongs to. */
      sessionId?: string;
    }
  }
}

/**
 * Access tokens are short-lived JWTs sent as `Authorization: Bearer …`. The web
 * client keeps them in memory only (never localStorage) and gets a new one from
 * /api/auth/refresh, which uses an httpOnly cookie. See services/sessions.ts.
 */
export const ACCESS_TOKEN_TTL_SECONDS = config.accessTokenTtlSeconds;

const ISSUER = "splash";
const AUDIENCE = "splash-api";

interface AccessClaims {
  /** Session id: which signed-in device this token was issued to. */
  sid: string;
  /** Must match User.tokenVersion; bumping that revokes every access token at once. */
  ver: number;
}

export function signAccessToken(user: UserDoc, sessionId: string): string {
  const claims: AccessClaims = { sid: sessionId, ver: user.tokenVersion ?? 0 };
  return jwt.sign(claims, config.jwtSecret, {
    subject: user.id,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithm: "HS256",
  });
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new HttpError(401, "Please sign in.", "no_token");

  let payload: jwt.JwtPayload & Partial<AccessClaims>;
  try {
    // Pin the algorithm, issuer and audience so no other kind of token is accepted.
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE }) as typeof payload;
  } catch {
    throw new HttpError(401, "Your session expired.", "token_expired");
  }

  const user = payload.sub ? await User.findById(payload.sub) : null;
  if (!user || payload.ver !== (user.tokenVersion ?? 0)) throw new HttpError(401, "Please sign in again.", "token_revoked");
  req.user = user;
  req.sessionId = payload.sid;
  next();
};
