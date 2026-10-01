import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AuthResponse, LoginBody, Me, RegisterBody } from "@splash/shared";
import { api, authEvents, getToken, setToken } from "./api";
import { qk, useMe } from "./queries";

interface AuthContextValue {
  user: Me | undefined;
  /** True until we know whether a stored token is still valid. */
  loading: boolean;
  signedIn: boolean;
  login(body: LoginBody): Promise<Me>;
  register(body: RegisterBody): Promise<Me>;
  logout(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [signedIn, setSignedIn] = useState(() => !!getToken());
  const me = useMe();

  useEffect(() => {
    const onSignedOut = () => {
      setSignedIn(false);
      qc.clear();
    };
    authEvents.addEventListener("signed-out", onSignedOut);
    return () => authEvents.removeEventListener("signed-out", onSignedOut);
  }, [qc]);

  const accept = (res: AuthResponse) => {
    qc.clear();
    setToken(res.token);
    qc.setQueryData(qk.me, res.user);
    setSignedIn(true);
    return res.user;
  };

  const value: AuthContextValue = {
    user: signedIn ? me.data : undefined,
    loading: signedIn && me.isPending,
    signedIn,
    login: async (body) => accept(await api<AuthResponse>("/api/auth/login", { method: "POST", body })),
    register: async (body) => accept(await api<AuthResponse>("/api/auth/register", { method: "POST", body })),
    logout: () => {
      setToken(null);
      setSignedIn(false);
      qc.clear();
    },
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
