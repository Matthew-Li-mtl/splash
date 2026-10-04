import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import type { Types } from "mongoose";
import { config } from "../config";
import { HttpError } from "../http";
import { Session, type SessionDoc } from "../models/Session";

// Refresh tokens: long-lived, random, opaque strings. The browser keeps them in
// an httpOnly cookie (page scripts can't read it, so an XSS bug can't steal it).
// The database only stores their SHA-256 hash, so a database leak doesn't hand
// out working tokens either.

export const REFRESH_COOKIE = "splash_rt";
/** A device stays signed in this long after it was last used (each refresh slides it). */
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * Two tabs can refresh at the same moment: one rotates the token, the other then
 * presents the now-previous one. Within this window that's treated as a harmless
 * race (the client retries with the new cookie) instead of as token theft.
 */
const ROTATION_GRACE_MS = 30 * 1000;

const newToken = () => randomBytes(32).toString("base64url");
// A fast hash is fine here: the token is 256 random bits, so there's nothing to
// brute-force. (Passwords are different: low entropy, so they use slow bcrypt.)
const hash = (token: string) => createHash("sha256").update(token).digest("base64url");

function describeDevice(req: Request): string {
  const ua = req.headers["user-agent"] ?? "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.isProd, // HTTPS-only in production; plain http://localhost works in dev
    sameSite: "strict", // never sent on requests started by another site (CSRF defense)
    path: "/api/auth", // only sent to the auth endpoints, not with every API call
    maxAge: REFRESH_TTL_MS,
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: config.isProd, sameSite: "strict", path: "/api/auth" });
}

/** Read the refresh token from the Cookie header (no cookie-parser dependency needed). */
export function readRefreshToken(req: Request): string | null {
  const header = req.headers.cookie ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === REFRESH_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** Start a new signed-in session (login/register) and set its cookie. */
export async function createSession(userId: Types.ObjectId, req: Request, res: Response): Promise<SessionDoc> {
  const token = newToken();
  const session = await Session.create({
    userId,
    currentHash: hash(token),
    userAgent: describeDevice(req),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  setRefreshCookie(res, token);
  return session;
}

/**
 * Exchange the cookie's refresh token for a new one (rotation). Returns the session.
 * Throws 401 if the token is missing/unknown, and revokes the session if it detects
 * an old token being replayed.
 */
export async function rotateSession(req: Request, res: Response): Promise<SessionDoc> {
  const presented = readRefreshToken(req);
  if (!presented) throw new HttpError(401, "Please sign in.", "no_session");
  const presentedHash = hash(presented);
  const next = newToken();
  const now = new Date();

  // Atomic: only one request can rotate a given token. A second concurrent request
  // with the same token won't match `currentHash` anymore and falls through below.
  const rotated = await Session.findOneAndUpdate(
    { currentHash: presentedHash, expiresAt: { $gt: now } },
    {
      $set: {
        previousHash: presentedHash,
        currentHash: hash(next),
        rotatedAt: now,
        lastUsedAt: now,
        expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
      },
    },
    { returnDocument: "after" },
  );
  if (rotated) {
    setRefreshCookie(res, next);
    return rotated;
  }

  const previous = await Session.findOne({ previousHash: presentedHash });
  if (previous) {
    const sinceRotation = now.getTime() - (previous.rotatedAt?.getTime() ?? 0);
    if (sinceRotation < ROTATION_GRACE_MS) {
      // Another tab just rotated; the browser already holds the new cookie.
      throw new HttpError(401, "Session is refreshing, try again.", "refresh_retry");
    }
    // An old token came back long after it was replaced: someone copied it. Revoke.
    await previous.deleteOne();
  }
  clearRefreshCookie(res);
  throw new HttpError(401, "Please sign in again.", "session_ended");
}

/** Sign out the device whose cookie this is. */
export async function endSession(req: Request, res: Response) {
  const presented = readRefreshToken(req);
  if (presented) {
    const h = hash(presented);
    await Session.deleteOne({ $or: [{ currentHash: h }, { previousHash: h }] });
  }
  clearRefreshCookie(res);
}

export async function endAllSessions(userId: Types.ObjectId) {
  await Session.deleteMany({ userId });
}
