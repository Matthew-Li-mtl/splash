import { Link } from "react-router";
import { directChannel } from "@splash/shared";
import { Avatar } from "../components/Avatar";
import { ErrorState, Spinner } from "../components/States";
import { Logo } from "../components/Logo";
import { useMeStrict } from "../lib/auth";
import { useNeighbors, useThreads } from "../lib/queries";
import { timeAgo } from "../lib/util";

export function Talk() {
  const me = useMeStrict();
  const threads = useThreads();
  const neighbors = useNeighbors(me.id);
  const talkedTo = new Set(threads.data?.map((t) => t.other?.id).filter(Boolean));
  const notYet = neighbors.filter((n) => !talkedTo.has(n.id));

  return (
    <div className="container stack stack-lg">
      <div className="page-head">
        <div>
          <h1>Talk</h1>
          <p>The porch is for everyone on your street. Or message one neighbor.</p>
        </div>
      </div>

      {threads.isPending ? (
        <Spinner />
      ) : threads.isError ? (
        <ErrorState error={threads.error} retry={() => threads.refetch()} />
      ) : (
        <div className="card" style={{ padding: 6 }}>
          {threads.data.map((t) => (
            <Link key={t.channel} to={`/talk/${t.channel}`} className="thread-row">
              {t.other ? (
                <Avatar user={t.other} size={46} />
              ) : (
                <span className="avatar" style={{ width: 46, height: 46, background: "var(--bg-2)" }}>
                  <Logo className="" />
                </span>
              )}
              <div className="grow">
                <div className="row spread">
                  <span className="bold">{t.title}</span>
                  {t.lastMessage && <span className="tiny muted">{timeAgo(t.lastMessage.createdAt)}</span>}
                </div>
                <div className={`small preview ${t.unread ? "bold" : "muted"}`}>
                  {t.lastMessage
                    ? `${t.lastMessage.author.id === me.id ? "You" : t.lastMessage.author.displayName}: ${t.lastMessage.text}`
                    : "Nobody's said anything yet. Start the conversation!"}
                </div>
              </div>
              {t.unread && <span className="unread-dot" aria-label="Unread" />}
            </Link>
          ))}
        </div>
      )}

      {notYet.length > 0 && (
        <section className="stack">
          <h2 className="section-title">Say hi to someone new</h2>
          <div className="chips">
            {notYet.map((n) => (
              <Link key={n.id} to={`/talk/${directChannel(me.id, n.id)}`} className="chip" style={{ textDecoration: "none" }}>
                <Avatar user={n} size={24} /> {n.displayName}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
