import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { requireAuth } from "./auth";
import { config } from "./config";
import { errorHandler, notFound } from "./http";
import { assetsRouter } from "./routes/assets";
import { authRouter } from "./routes/auth";
import { blocksRouter } from "./routes/blocks";
import { gamesRouter } from "./routes/games";
import { meRouter } from "./routes/me";
import { messagesRouter } from "./routes/messages";
import { neighborhoodRouter } from "./routes/neighborhood";
import { postsRouter } from "./routes/posts";
import { usersRouter } from "./routes/users";

// Origins of the Capacitor mobile shells, plus the Vite dev server.
const allowedOrigins = new Set([
  "capacitor://localhost",
  "ionic://localhost",
  "https://localhost",
  "http://localhost",
  "http://localhost:5173",
  ...config.clientOrigins,
]);

export function createApp() {
  const app = express();
  app.set("trust proxy", 1); // Render (and most hosts) sit behind one proxy.

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "img-src": ["'self'", "data:", "blob:"],
          "media-src": ["'self'", "blob:"],
          "upgrade-insecure-requests": config.isProd ? [] : null,
        },
      },
      // Let the mobile app (a different origin) load collage images.
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use("/api", cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.has(origin)), maxAge: 86400 }));
  app.use(express.json({ limit: "400kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", db: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/assets", assetsRouter); // GET is public; upload checks auth itself.
  app.use("/api/me", requireAuth, meRouter);
  app.use("/api/neighborhood", requireAuth, neighborhoodRouter);
  app.use("/api/users", requireAuth, usersRouter);
  app.use("/api/posts", requireAuth, postsRouter);
  app.use("/api/messages", requireAuth, messagesRouter);
  app.use("/api/games", requireAuth, gamesRouter);
  app.use("/api/blocks", requireAuth, blocksRouter);
  app.use("/api", () => {
    throw notFound("No such API route.");
  });

  // In production the server also hosts the built web app (one free service, no CORS).
  const clientDist = fileURLToPath(new URL("../../client/dist/", import.meta.url));
  if (existsSync(join(clientDist, "index.html"))) {
    app.use(
      express.static(clientDist, {
        index: false,
        setHeaders(res, path) {
          // Vite fingerprints files in /assets, so they can be cached forever.
          if (/[\\/]assets[\\/]/.test(path)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        },
      }),
    );
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(join(clientDist, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
