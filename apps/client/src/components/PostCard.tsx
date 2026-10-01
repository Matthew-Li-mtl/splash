import { Suspense, type CSSProperties } from "react";
import { Link } from "react-router";
import { Lock, MessageCircle } from "lucide-react";
import type { PostDTO } from "@splash/shared";
import { timeAgo } from "../lib/util";
import { TOOLS, VIEWERS } from "../tools/registry";
import { Avatar } from "./Avatar";
import { Reactions } from "./Reactions";
import { Spinner } from "./States";

export function PostCard({ post, compact = true }: { post: PostDTO; compact?: boolean }) {
  const tool = TOOLS[post.kind];
  const Viewer = VIEWERS[post.kind];
  const Icon = tool.icon;

  return (
    <article className="card post-card">
      <header className="post-head">
        <Avatar user={post.author} link />
        <div className="grow">
          <Link to={`/u/${post.author.username}`} className="bold">
            {post.author.displayName}
          </Link>
          <div className="row row-wrap tiny muted" style={{ gap: 6 }}>
            <span className="post-kind" style={{ "--kind-color": tool.color } as CSSProperties}>
              <Icon size={13} strokeWidth={2.5} /> {tool.label}
            </span>
            <span>·</span>
            <Link to={`/p/${post.id}`} style={{ color: "inherit", textDecoration: "none" }}>
              {timeAgo(post.createdAt)}
            </Link>
            {post.visibility === "private" && (
              <span className="private-pill">
                <Lock size={11} /> Only you
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="post-body">
        {post.title && (
          <h3 className="post-title">
            {compact ? (
              <Link to={`/p/${post.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                {post.title}
              </Link>
            ) : (
              post.title
            )}
          </h3>
        )}
        <Suspense fallback={<Spinner />}>
          <Viewer post={post} compact={compact} />
        </Suspense>
        {post.remixOf && (
          <p className="tiny muted" style={{ marginTop: 10 }}>
            🔁 Remixed from {post.remixOf.author ? `${post.remixOf.author.displayName}'s` : "a"}{" "}
            <Link to={`/p/${post.remixOf.id}`}>original</Link>
          </p>
        )}
      </div>

      <footer className="post-foot">
        <Reactions post={post} />
        <span className="grow" />
        {compact && (
          <Link className="btn btn-ghost btn-sm" to={`/p/${post.id}`} aria-label={`${post.commentCount} comments`}>
            <MessageCircle size={17} />
            {post.commentCount > 0 ? post.commentCount : "Reply"}
          </Link>
        )}
      </footer>
    </article>
  );
}
