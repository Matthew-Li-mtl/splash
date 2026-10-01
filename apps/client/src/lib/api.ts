// Thin fetch wrapper. On the web the API is same-origin (/api/...). In the mobile app
// the bundle runs from the device, so VITE_API_URL points at the hosted server.

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const TOKEN_KEY = "splash.token";

export const apiUrl = (path: string) => `${BASE}${path}`;
export const assetUrl = (id: string) => apiUrl(`/api/assets/${encodeURIComponent(id)}`);

let token: string | null = readToken();

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getToken() {
  return token;
}

export function setToken(next: string | null) {
  token = next;
  try {
    if (next) localStorage.setItem(TOKEN_KEY, next);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode); the session just won't persist.
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Fired when the server rejects our token, so the app can return to sign-in. */
export const authEvents = new EventTarget();

type Options = { method?: string; body?: unknown; raw?: Blob };

export async function api<T>(path: string, { method = "GET", body, raw }: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (raw) headers["Content-Type"] = raw.type;

  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method,
      headers,
      body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError(0, "Can't reach the neighborhood right now. Check your connection and try again.");
  }

  if (res.status === 401 && token) {
    setToken(null);
    authEvents.dispatchEvent(new Event("signed-out"));
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status}).`);
  return data as T;
}

export const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "Something went wrong.";
