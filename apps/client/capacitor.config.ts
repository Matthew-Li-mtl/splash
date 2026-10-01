import type { CapacitorConfig } from "@capacitor/cli";

// The mobile app is the same React build, wrapped by Capacitor. Two ways to run it
// (see docs/MOBILE.md):
//   • Bundled (default): the web build ships inside the app and calls the API at
//     VITE_API_URL (set in .env.mobile). Opens instantly, even if the server is asleep.
//   • Live: CAP_SERVER_URL=https://your-app.onrender.com npm run mobile:sync
//     The app loads your deployed site directly, so web deploys update it with no rebuild.
const liveUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  // Change this to your own reverse-domain id before publishing to an app store.
  appId: "com.splash.app",
  appName: "Splash",
  webDir: "dist-mobile",
  ...(liveUrl ? { server: { url: liveUrl, cleartext: liveUrl.startsWith("http://") } } : {}),
  plugins: {
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
    },
  },
};

export default config;
