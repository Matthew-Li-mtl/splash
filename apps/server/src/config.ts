import { fileURLToPath } from "node:url";

// apps/server/.env — resolves the same from src/config.ts (dev) and dist/index.js (prod).
try {
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch {
  // No .env file: rely on real environment variables (e.g. on Render).
}

const isProd = process.env.NODE_ENV === "production";

function required(name: string, devDefault: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProd) throw new Error(`Missing required environment variable ${name}`);
  return devDefault;
}

export const config = {
  isProd,
  port: Number(process.env.PORT) || 4000,
  mongoUri: required("MONGO_URI", "mongodb://127.0.0.1:27017"),
  mongoDb: process.env.MONGO_DB || "splash",
  jwtSecret: required("JWT_SECRET", "dev-only-secret-change-me"),
  /** Extra browser origins allowed to call the API (comma-separated). */
  clientOrigins: (process.env.CLIENT_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  /** Access-token lifetime. Short on purpose; only lower it for testing. */
  accessTokenTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS) || 15 * 60,
  /** Per-user image storage cap. Keeps the free 512 MB Atlas tier comfortable. */
  assetQuotaBytes: (Number(process.env.ASSET_QUOTA_MB) || 15) * 1024 * 1024,
};
