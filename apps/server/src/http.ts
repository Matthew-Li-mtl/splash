import type { ErrorRequestHandler, Request } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";
import type { UserDoc } from "./models/User";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Optional machine-readable reason the client can branch on (e.g. "refresh_retry"). */
    public code?: string,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg);
export const forbidden = (msg = "You can't do that.") => new HttpError(403, msg);
export const notFound = (msg = "Not found.") => new HttpError(404, msg);

/** The signed-in user. Only call in routes behind `requireAuth`. */
export function currentUser(req: Request): UserDoc {
  if (!req.user) throw new HttpError(401, "Please sign in.");
  return req.user;
}

export function objectId(value: unknown, what = "id"): mongoose.Types.ObjectId {
  if (typeof value !== "string" || !mongoose.isValidObjectId(value)) throw notFound(`Unknown ${what}.`);
  return new mongoose.Types.ObjectId(value);
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) });
  } else if (err instanceof ZodError) {
    const issue = err.issues[0];
    const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    res.status(400).json({ error: `${where}${issue?.message ?? "Invalid request."}` });
  } else if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "That's too big to upload." });
  } else {
    console.error(err);
    res.status(500).json({ error: "Something went wrong on our end." });
  }
};
