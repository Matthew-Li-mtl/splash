import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, LogOut } from "lucide-react";
import type { SessionDTO } from "@splash/shared";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { timeAgo } from "../lib/util";
import { Spinner } from "./States";

const SESSIONS_KEY = ["sessions"] as const;

/** Signed-in devices, with per-device and "everywhere" sign-out. */
export function DevicesCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const { logoutEverywhere } = useAuth();
  const sessions = useQuery({ queryKey: SESSIONS_KEY, queryFn: () => api<SessionDTO[]>("/api/me/sessions") });

  const signOutDevice = useMutation({
    mutationFn: (id: string) => api(`/api/me/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SESSIONS_KEY });
      toast("That device will be signed out within 15 minutes.");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const everywhere = () => {
    if (!window.confirm("Sign out of Splash on every device, including this one?")) return;
    logoutEverywhere().catch((e) => toast(errorMessage(e), "error"));
  };

  return (
    <div className="card stack">
      <h2>Signed-in devices</h2>
      <p className="muted small">Don't recognize one? Sign it out, then change your password.</p>
      {sessions.isPending ? (
        <Spinner />
      ) : (
        <div className="stack stack-sm">
          {sessions.data?.map((s) => (
            <div key={s.id} className="row" style={{ gap: 12 }}>
              <Laptop size={20} className="muted" />
              <div className="grow">
                <div className="bold small">
                  {s.device} {s.current && <span className="chip chip-static">This device</span>}
                </div>
                <div className="tiny muted">Active {timeAgo(s.lastUsedAt)}</div>
              </div>
              {!s.current && (
                <button className="btn btn-ghost btn-sm" onClick={() => signOutDevice.mutate(s.id)} disabled={signOutDevice.isPending}>
                  Sign out
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <button className="btn btn-danger" style={{ alignSelf: "flex-start" }} onClick={everywhere}>
        <LogOut size={16} /> Sign out everywhere
      </button>
    </div>
  );
}
