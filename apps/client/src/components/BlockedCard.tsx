import { errorMessage } from "../lib/api";
import { useBlockedUsers, useUnblock } from "../lib/blocks";
import { useToast } from "../lib/toast";
import { timeAgo } from "../lib/util";
import { Avatar } from "./Avatar";
import { Spinner } from "./States";

/** People you've blocked, with Unblock. Lives in Settings. */
export function BlockedCard() {
  const blocked = useBlockedUsers();
  const unblock = useUnblock();
  const toast = useToast();

  return (
    <div className="card stack">
      <h2>Blocked people</h2>
      <p className="muted small">
        You and a blocked person can't see each other's posts, replies or porch messages, or message and challenge
        each other. They aren't told.
      </p>
      {blocked.isPending ? (
        <Spinner />
      ) : !blocked.data?.length ? (
        <p className="small muted">You haven't blocked anyone.</p>
      ) : (
        <div className="stack stack-sm">
          {blocked.data.map(({ user, blockedAt }) => (
            <div key={user.id} className="row" style={{ gap: 12 }}>
              <Avatar user={user} size={36} />
              <div className="grow">
                <div className="bold small">{user.displayName}</div>
                <div className="tiny muted">Blocked {timeAgo(blockedAt)}</div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                disabled={unblock.isPending}
                onClick={() =>
                  unblock.mutate(user.id, {
                    onSuccess: () => toast(`${user.displayName} is unblocked.`),
                    onError: (e) => toast(errorMessage(e), "error"),
                  })
                }
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
