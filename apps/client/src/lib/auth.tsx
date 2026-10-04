import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AuthResponse, LoginBody, Me, RegisterBody } from "@splash/shared";
import { api, authEvents, clearSession, hasSessionHint, refreshSession, startSession } from "./api";
import { qk, useMe } from "./queries";

/**
 * checking  = on page load, asking the server whether our refresh cookie is still good
 * signedIn  = we hold an access token and the user is loaded
 * signedOut = no session
 */
type Status = "checking" | "signedIn" | "signedOut";

interface AuthContextValue {
  user: Me | undefined;
  status: Status;
  /** True until we know whether there's a valid session. */
  loading: boolean;
  signedIn: boolean;
  /** Set when the startup check failed for a reason other than "not signed in" (e.g. server asleep). */
  bootError: unknown;
  retryBoot(): void;
  login(body: LoginBody): Promise<Me>;
  register(body: RegisterBody): Promise<Me>;
  logout(): Promise<void>;
  logoutEverywhere(): Promise<void>;
  /** Adopt a new session handed back by the server (e.g. after changing password). */
  adoptSession(res: AuthResponse): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  // Only browsers that had a session need the startup refresh; everyone else is
  // signed out immediately (no request, so visiting the welcome page doesn't wake the server).
  const [status, setStatus] = useState<Status>(() => (hasSessionHint() ? "checking" : "signedOut"));
  const [bootError, setBootError] = useState<unknown>(null);
  const me = useMe(status === "signedIn");

  const adoptSession = useCallback(
    (res: AuthResponse) => {
      startSession(res);
      qc.setQueryData(qk.me, res.user);
      setStatus("signedIn");
    },
    [qc],
  );

  const boot = useCallback(async () => {
    setBootError(null);
    try {
      const res = await refreshSession();
      if (res) adoptSession(res);
      else setStatus("signedOut");
    } catch (err) {
      setBootError(err); // stay in "checking"; the WakingUp screen offers a retry
    }
  }, [adoptSession]);

  useEffect(() => {
    if (status === "checking") void boot();
    // Run once on mount; retries go through retryBoot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onSignedOut = () => {
      setStatus("signedOut");
      qc.clear();
    };
    const onSession = (e: Event) => qc.setQueryData(qk.me, (e as CustomEvent<AuthResponse>).detail.user);
    authEvents.addEventListener("signed-out", onSignedOut);
    authEvents.addEventListener("session", onSession);
    return () => {
      authEvents.removeEventListener("signed-out", onSignedOut);
      authEvents.removeEventListener("session", onSession);
    };
  }, [qc]);

  const accept = (res: AuthResponse) => {
    qc.clear();
    adoptSession(res);
    return res.user;
  };

  const signOutLocally = () => {
    clearSession();
    setStatus("signedOut");
    qc.clear();
  };

  const value: AuthContextValue = {
    user: status === "signedIn" ? me.data : undefined,
    status,
    loading: status === "checking" || (status === "signedIn" && me.isPending),
    signedIn: status === "signedIn",
    bootError,
    retryBoot: () => void boot(),
    login: async (body) => accept(await api<AuthResponse>("/api/auth/login", { method: "POST", body })),
    register: async (body) => accept(await api<AuthResponse>("/api/auth/register", { method: "POST", body })),
    logout: async () => {
      // Tell the server to forget this device; sign out locally even if that fails.
      await api("/api/auth/logout", { method: "POST", body: {} }).catch(() => {});
      signOutLocally();
    },
    logoutEverywhere: async () => {
      await api("/api/auth/logout-all", { method: "POST", body: {} });
      signOutLocally();
    },
    adoptSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** For screens behind <RequireAuth>, where the user is always loaded. */
export function useMeStrict(): Me {
  const { user } = useAuth();
  if (!user) throw new Error("useMeStrict used outside an authenticated screen");
  return user;
}
