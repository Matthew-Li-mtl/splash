import mongoose from "mongoose";
import { createApp } from "./app";
import { config } from "./config";

async function start() {
  try {
    await mongoose.connect(config.mongoUri, { dbName: config.mongoDb, serverSelectionTimeoutMS: 15000 });
    console.log(`Connected to MongoDB (db: ${config.mongoDb})`);
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    console.error("Check MONGO_URI, and that Atlas → Network Access allows this machine's IP.");
    process.exit(1);
  }

  if (!config.isProd && config.jwtSecret === "dev-only-secret-change-me") {
    console.warn("Using the dev JWT secret. Set JWT_SECRET in apps/server/.env for anything real.");
  }

  const server = createApp().listen(config.port, () => {
    console.log(`Splash API on http://localhost:${config.port}`);
  });

  const shutdown = () => {
    server.close();
    void mongoose.disconnect().then(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

void start();
