import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useMe } from "../lib/queries";
import { Logo } from "./Logo";

export const Spinner = () => <div className="spinner" role="status" aria-label="Loading" />;

export function EmptyState({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-emoji">{emoji}</div>
      <h3>{title}</h3>
      {children && <div className="stack stack-sm" style={{ marginTop: 8, alignItems: "center" }}>{children}</div>}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <EmptyState emoji="🌧️" title="Hmm, that didn't load">
      <p className="muted">{errorMessage(error)}</p>
      {retry && (
        <button className="btn btn-sm" onClick={retry}>
          Try again
        </button>
      )}
    </EmptyState>
  );
}

/**
 * Shown while we load the signed-in user. Free hosting tiers put the server to
 * sleep when idle, so the first request can take a while — say so kindly.
 */
export function WakingUp() {
  const me = useMe(false);
  const qc = useQueryClient();
  const { logout, bootError, retryBoot } = useAuth();
  const error = bootError ?? (me.isError ? me.error : null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 2500);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="splash">
      <div className="stack" style={{ maxWidth: 360, alignItems: "center" }}>
        <Logo />
        {error ? (
          <>
            <h2>Can't reach the neighborhood</h2>
            <p className="muted">{errorMessage(error)}</p>
            <div className="row">
              <button className="btn btn-primary" onClick={() => (bootError ? retryBoot() : qc.invalidateQueries({ queryKey: ["me"] }))}>
                Try again
              </button>
              <button className="btn btn-ghost" onClick={() => void logout()}>
                Sign out
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>{slow ? "Waking up the neighborhood…" : "Splash"}</h2>
            <p className="muted" style={{ minHeight: 48 }}>
              {slow && "Our free server naps when it's quiet. It can take up to a minute to get its slippers on."}
            </p>
            <Spinner />
          </>
        )}
      </div>
    </div>
  );
}
