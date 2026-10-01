import { useState } from "react";
import { Link, useParams } from "react-router";
import { Gamepad2, MessageCircle, Settings } from "lucide-react";
import { directChannel } from "@splash/shared";
import { Avatar } from "../components/Avatar";
import { InterestChips } from "../components/Pickers";
import { PostCard } from "../components/PostCard";
import { StartGameSheet } from "../components/StartGameSheet";
import { EmptyState, ErrorState, Spinner } from "../components/States";
import { useMeStrict } from "../lib/auth";
import { useUser, useUserPosts } from "../lib/queries";

export function Profile() {
  const { username = "" } = useParams();
  const me = useMeStrict();
  const user = useUser(username);
  const posts = useUserPosts(user.data?.id);
  const [playing, setPlaying] = useState(false);

  if (user.isPending) return <Spinner />;
  if (user.isError) return <ErrorState error={user.error} />;

  const u = user.data;
  const isMe = u.id === me.id;
  const list = posts.data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <div className="container stack stack-lg">
      <div className="card stack center" style={{ alignItems: "center" }}>
        <Avatar user={u} size={88} />
        <div>
          <h1>{u.displayName}</h1>
          <p className="muted small">@{u.username}</p>
        </div>
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
      </div>

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

      {!isMe && <StartGameSheet open={playing} onClose={() => setPlaying(false)} opponent={u} />}
    </div>
  );
}
