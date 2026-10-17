import { Link } from "react-router";
import { NEIGHBORS_PER_USER } from "@splash/shared";
import { Avatar } from "../components/Avatar";
import { InviteBox } from "../components/InviteBox";
import { Logo } from "../components/Logo";
import { Spinner } from "../components/States";
import { useMeStrict } from "../lib/auth";
import { useNeighborhood } from "../lib/queries";

/** The "keys to your new place" moment right after sign-up. */
export function MovedIn() {
  const me = useMeStrict();
  const { data: hood } = useNeighborhood();

  return (
    <div className="welcome">
      <div className="welcome-card card stack center" style={{ alignItems: "center" }}>
        <Logo />
        {!hood ? (
          <Spinner />
        ) : (
          <>
            <p className="section-title">Welcome to</p>
            <h1 className="hero-title" style={{ fontSize: "2.4rem" }}>
              {hood.name}
            </h1>
            <div className="avatar-stack" style={{ justifyContent: "center", flexWrap: "wrap" }}>
              {hood.members.slice(0, 12).map((m) => (
                <Avatar key={m.id} user={m} size={44} />
              ))}
            </div>
            <p style={{ color: "var(--ink-2)" }}>
              {hood.members.length === 1 ? (
                hood.inviteOnly ? (
                  <>
                    This street is all yours, {me.displayName}. Make things just for you, or bring people you know:
                    anyone with your invite link moves in next door.
                  </>
                ) : (
                  <>
                    You're the first one on the street, {me.displayName}! New neighbors may move in as people join, and
                    anyone with your invite link can move in too.
                  </>
                )
              ) : (
                <>
                  You and {hood.members.length - 1} {hood.members.length === 2 ? "neighbor" : "neighbors"} live here
                  now, with room for {NEIGHBORS_PER_USER + 1 - hood.members.length} more. These are your people, so say
                  hi!
                </>
              )}
            </p>
            {hood.members.length === 1 && (
              <div style={{ width: "100%" }}>
                <InviteBox code={hood.inviteCode} />
              </div>
            )}
            <Link to="/" className="btn btn-accent btn-block">
              Look around
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
