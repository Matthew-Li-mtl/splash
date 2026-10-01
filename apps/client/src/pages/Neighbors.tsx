import { Link } from "react-router";
import { MessageCircle } from "lucide-react";
import { directChannel } from "@splash/shared";
import { Avatar } from "../components/Avatar";
import { InviteBox } from "../components/InviteBox";
import { InterestChips } from "../components/Pickers";
import { ErrorState, Spinner } from "../components/States";
import { useMeStrict } from "../lib/auth";
import { useNeighborhood } from "../lib/queries";

export function Neighbors() {
  const me = useMeStrict();
  const hood = useNeighborhood();

  if (hood.isPending) return <Spinner />;
  if (hood.isError) return <ErrorState error={hood.error} retry={() => hood.refetch()} />;

  const { name, members, capacity, inviteCode } = hood.data;
  const emptyLots = Math.max(0, capacity - members.length);

  return (
    <div className="container-wide stack stack-lg">
      <div className="page-head">
        <div>
          <h1>{name}</h1>
          <p>
            {members.length} of {capacity} homes filled. Same people, every day. That's the point.
          </p>
        </div>
      </div>

      <div className="neighbor-grid">
        {members.map((m) => (
          <div key={m.id} className="card neighbor">
            <Avatar user={m} size={64} link />
            <Link to={`/u/${m.username}`} className="bold" style={{ color: "inherit", textDecoration: "none", fontSize: "1.05rem" }}>
              {m.displayName}
              {m.id === me.id && <span className="muted"> (you)</span>}
            </Link>
            <span className="tiny muted">@{m.username}</span>
            {m.bio && (
              <p className="small" style={{ color: "var(--ink-2)" }}>
                {m.bio}
              </p>
            )}
            <div style={{ justifyContent: "center", display: "flex" }}>
              <InterestChips ids={m.interests.slice(0, 3)} />
            </div>
            {m.id !== me.id && (
              <Link to={`/talk/${directChannel(me.id, m.id)}`} className="btn btn-sm" style={{ marginTop: 6 }}>
                <MessageCircle size={15} /> Say hi
              </Link>
            )}
          </div>
        ))}
        {Array.from({ length: Math.min(emptyLots, 3) }, (_, i) => (
          <div key={i} className="card neighbor empty-lot">
            <span style={{ fontSize: "2rem" }}>🪧</span>
            <span className="small bold">Empty lot</span>
            <span className="tiny">Someone new may move in soon</span>
          </div>
        ))}
      </div>
      {emptyLots > 3 && <p className="muted small center">…and {emptyLots - 3} more empty lots waiting for neighbors.</p>}

      {emptyLots > 0 && (
        <div className="card stack">
          <h3>Invite someone to your street</h3>
          <p className="muted small">Anyone who signs up with this code moves in here, while there's room.</p>
          <InviteBox code={inviteCode} />
        </div>
      )}
    </div>
  );
}
