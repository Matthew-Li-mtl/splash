// Thin fetch wrapper. On the web the API is same-origin (/api/...). In the mobile app
// the bundle runs from the device, so VITE_API_URL points at the hosted server.
//
// Auth model (see the server's services/sessions.ts):
//   • The access token (15 minutes) lives only in this module's memory. Never in
//     localStorage, so an injected script can't read a long-lived credential.
//   • The refresh token is an httpOnly cookie the browser sends to /api/auth/*.
//     Reloading the page calls /api/auth/refresh to get a new access token.
//   • A 401 on any request triggers one silent refresh and a retry.

import type { AuthResponse } from "@splash/shared";

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
/** Not a secret: just "this browser had a session", so we know to try a refresh on load. */
const SESSION_HINT_KEY = "splash.hasSession";

export const apiUrl = (path: string) => `${BASE}${path}`;
export const assetUrl = (id: string) => apiUrl(`/api/assets/${encodeURIComponent(id)}`);

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong.");

/**
 * Auth events for the AuthProvider:
 *   "session"     detail = AuthResponse, after a successful refresh
 *   "signed-out"  the session ended (expired, revoked, or signed out in another tab)
 */
export const authEvents = new EventTarget();

// Remove the long-lived token older versions stored in localStorage.
safeStorage(() => localStorage.removeItem("splash.token"));

function safeStorage<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined; // storage unavailable (private mode, blocked)
  }
}

export const hasSessionHint = () => safeStorage(() => localStorage.getItem(SESSION_HINT_KEY) === "1") ?? false;

// ---------- Access token (memory only) ----------

let accessToken: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;

/** Store a fresh access token and schedule a refresh shortly before it expires. */
export function startSession(res: AuthResponse) {
  accessToken = res.accessToken;
  safeStorage(() => localStorage.setItem(SESSION_HINT_KEY, "1"));
  clearTimeout(refreshTimer);
  const refreshInMs = Math.max(30, res.expiresIn - 60) * 1000;
  refreshTimer = setTimeout(() => {
    refreshSession().catch(() => {
      // Offline or server asleep: the next request's 401 handling will retry.
    });
  }, refreshInMs);
}

/** Forget everything locally. `broadcast` tells other open tabs to sign out too. */
export function clearSession({ broadcast = true } = {}) {
  accessToken = null;
  clearTimeout(refreshTimer);
  safeStorage(() => localStorage.removeItem(SESSION_HINT_KEY));
  if (broadcast) channel?.postMessage("signed-out");
}

// Keep tabs in sync: signing out in one tab signs out the others right away.
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("splash-auth") : null;
channel?.addEventListener("message", (e) => {
  if (e.data === "signed-out") {
    clearSession({ broadcast: false });
    authEvents.dispatchEvent(new Event("signed-out"));
  }
});

// ---------- Refresh (single flight) ----------

let inFlight: Promise<AuthResponse | null> | null = null;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Get a new access token using the refresh cookie. Returns null if there's no
 * valid session (the user must sign in). Throws ApiError for network/server errors,
 * so callers can tell "signed out" apart from "server asleep".
 *
 * Concurrent callers share one request: ten requests failing with 401 at once
 * cause one refresh, not ten.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  inFlight ??= (async () => {
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await rawFetch("/api/auth/refresh", { method: "POST", body: {} });
        if (res.ok) {
          const data = (await res.json()) as AuthResponse;
          startSession(data);
          authEvents.dispatchEvent(new CustomEvent("session", { detail: data }));
          return data;
        }
        const err = await res.json().catch(() => null);
        // Another tab rotated the cookie a moment ago; the browser now has the new one.
        if (res.status === 401 && err?.code === "refresh_retry" && attempt === 0) {
          await wait(400);
          continue;
        }
        if (res.status === 401) {
          clearSession({ broadcast: false });
          return null;
        }
        throw new ApiError(res.status, err?.error ?? `Request failed (${res.status}).`, err?.code);
      }
      clearSession({ broadcast: false });
      return null;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

// ---------- Requests ----------

type Options = { method?: string; body?: unknown; raw?: Blob };

async function rawFetch(path: string, { method = "GET", body, raw }: Options): Promise<Response> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (raw) headers["Content-Type"] = raw.type;
  try {
    return await fetch(apiUrl(path), {
      method,
      headers,
      body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
      // Same-origin on the web, so the refresh cookie is sent automatically.
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "Can't reach the neighborhood right now. Check your connection and try again.");
  }
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  let res = await rawFetch(path, options);

  // Access token expired (or was revoked): refresh once and retry the request.
  const isAuthRoute = path.startsWith("/api/auth/");
  if (res.status === 401 && !isAuthRoute && hasSessionHint()) {
    const refreshed = await refreshSession();
    if (refreshed) res = await rawFetch(path, options);
    else authEvents.dispatchEvent(new Event("signed-out"));
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status}).`, data?.code);
  return data as T;
}
