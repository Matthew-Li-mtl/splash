import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // The mobile build (vite --mode mobile) goes to its own folder so it never
  // replaces the web build the server hosts.
  build: { outDir: mode === "mobile" ? "dist-mobile" : "dist" },
  server: {
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
}));
