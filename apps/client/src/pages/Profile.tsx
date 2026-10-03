import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Ban, Gamepad2, MessageCircle, Settings } from "lucide-react";
import { directChannel } from "@splash/shared";
import { Avatar } from "../components/Avatar";
import { InterestChips } from "../components/Pickers";
import { PostCard } from "../components/PostCard";
import { StartGameSheet } from "../components/StartGameSheet";
import { EmptyState, ErrorState, Spinner } from "../components/States";
import { errorMessage } from "../lib/api";
import { useMeStrict } from "../lib/auth";
import { useBlock, useProfile, useUnblock } from "../lib/blocks";
import { useUserPosts } from "../lib/queries";
import { useToast } from "../lib/toast";

export function Profile() {
  const { username = "" } = useParams();
  const me = useMeStrict();
  const profile = useProfile(username);
  const blocked = !!profile.data?.blockedByMe;
  // No point asking for posts we won't show.
  const posts = useUserPosts(blocked ? undefined : profile.data?.id);
  const block = useBlock();
  const unblock = useUnblock();
  const toast = useToast();
  const navigate = useNavigate();
  const [playing, setPlaying] = useState(false);

  if (profile.isPending) return <Spinner />;
  if (profile.isError) return <ErrorState error={profile.error} />;

  const u = profile.data;
  const isMe = u.id === me.id;
  const list = posts.data?.pages.flatMap((p) => p.posts) ?? [];

  const confirmBlock = () => {
    const ok = window.confirm(
      `Block ${u.displayName}?\n\nYou won't see each other's posts, replies or porch messages, and neither of you can message, challenge or reply to the other. Any game between you ends. They won't be told.\n\nYou can unblock any time in Settings.`,
    );
    if (!ok) return;
    block.mutate(u.id, {
      onSuccess: () => {
        toast(`${u.displayName} is blocked.`);
        navigate("/neighbors");
      },
      onError: (e) => toast(errorMessage(e), "error"),
    });
  };

  const doUnblock = () =>
    unblock.mutate(u.id, {
      onSuccess: () => toast(`${u.displayName} is unblocked.`),
      onError: (e) => toast(errorMessage(e), "error"),
    });

  return (
    <div className="container stack stack-lg">
      <div className="card stack center" style={{ alignItems: "center" }}>
        <Avatar user={u} size={88} />
        <div>
          <h1>{u.displayName}</h1>
          <p className="muted small">@{u.username}</p>
        </div>
        {blocked ? (
          <>
            <p className="muted">You blocked {u.displayName}. You won't see each other's posts or messages.</p>
            <button className="btn btn-sm" onClick={doUnblock} disabled={unblock.isPending}>
              Unblock
            </button>
          </>
        ) : (
          <>
            {u.bio && <p style={{ maxWidth: 440 }}>{u.bio}</p>}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <InterestChips ids={u.interests} />
            </div>
            <div className="row row-wrap" style={{ justifyContent: "center" }}>
              {isMe ? (
                <Link to="/me" className="btn btn-sm">
                  <Settings size={16} /> Edit profile
                </Link>
              ) : (
                <>
                  <Link to={`/talk/${directChannel(me.id, u.id)}`} className="btn btn-sm btn-primary">
                    <MessageCircle size={16} /> Message
                  </Link>
                  <button className="btn btn-sm" onClick={() => setPlaying(true)}>
                    <Gamepad2 size={16} /> Play a game
                  </button>
                </>
              )}
            </div>
            {!isMe && (
              <button className="btn btn-ghost btn-sm btn-danger" onClick={confirmBlock} disabled={block.isPending}>
                <Ban size={15} /> Block
              </button>
            )}
          </>
        )}
      </div>

      {!blocked && (
        <section className="stack">
          <h2 className="section-title">{isMe ? "Your shelf" : `${u.displayName}'s shelf`}</h2>
          {posts.isPending ? (
            <Spinner />
          ) : list.length === 0 ? (
            <EmptyState emoji="🪴" title={isMe ? "Nothing on your shelf yet" : "Nothing shared yet"}>
              {isMe && (
                <Link to="/make" className="btn btn-sm">
                  Make something
                </Link>
              )}
            </EmptyState>
          ) : (
            <>
              {list.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
              {posts.hasNextPage && (
                <button className="btn" onClick={() => posts.fetchNextPage()} disabled={posts.isFetchingNextPage}>
                  Show older
                </button>
              )}
            </>
          )}
        </section>
      )}

      {!isMe && !blocked && <StartGameSheet open={playing} onClose={() => setPlaying(false)} opponent={u} />}
    </div>
  );
}
