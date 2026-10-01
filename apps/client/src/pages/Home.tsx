import type { CSSProperties } from "react";
import { Link } from "react-router";
import { GAMES } from "@splash/shared";
import { Avatar } from "../components/Avatar";
import { InviteBox } from "../components/InviteBox";
import { PostCard } from "../components/PostCard";
import { EmptyState, ErrorState, Spinner } from "../components/States";
import { useMeStrict } from "../lib/auth";
import { useFeed, useGames, useNeighborhood } from "../lib/queries";
import { greeting } from "../lib/util";
import { dailyPuzzle } from "../tools/sudoku/daily";
import { dailyPrompt } from "../tools/writing/prompts";

export function Home() {
  const me = useMeStrict();
  const { data: hood } = useNeighborhood();
  const feed = useFeed();
  const { data: games } = useGames();

  const yourTurn = games?.filter((g) => g.status === "active" && g.state.turn === g.you) ?? [];
  const prompt = dailyPrompt();
  const puzzle = dailyPuzzle();
  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? [];
  const alone = hood && hood.members.length === 1;

  return (
    <div className="container stack stack-lg">
      <div className="page-head">
        <div>
          <h1>
            {greeting()}, {me.displayName}
          </h1>
          <p>{hood ? `Here's what's happening on ${hood.name}.` : " "}</p>
        </div>
      </div>

      <section className="today" aria-label="Today">
        <div className="today-card" style={{ "--tile": "var(--c-write)" } as CSSProperties}>
          <span className="eyebrow">Today's prompt</span>
          <blockquote>{prompt.text}</blockquote>
          <div className="grow" />
          <Link to="/make/write?daily=1" className="btn btn-sm" style={{ alignSelf: "flex-start" }}>
            Write a little
          </Link>
        </div>
        <div className="today-card" style={{ "--tile": "var(--c-puzzle)" } as CSSProperties}>
          <span className="eyebrow">Daily sudoku</span>
          <p>
            Everyone on the street gets the same puzzle today. It's{" "}
            <span className="bold">{puzzle.difficulty}</span>.
          </p>
          <div className="grow" />
          <Link to="/play/sudoku?daily=1" className="btn btn-sm" style={{ alignSelf: "flex-start" }}>
            Play today's puzzle
          </Link>
        </div>
        {yourTurn.length > 0 && (
          <div className="today-card" style={{ "--tile": "var(--c-game)" } as CSSProperties}>
            <span className="eyebrow">Your move</span>
            <div className="stack stack-sm">
              {yourTurn.slice(0, 3).map((g) => {
                const them = g.players[g.you === 0 ? 1 : 0];
                return (
                  <Link key={g.id} to={`/play/game/${g.id}`} className="row" style={{ color: "inherit", textDecoration: "none" }}>
                    <Avatar user={them} size={30} />
                    <span className="grow">
                      <span className="bold">{them.displayName}</span>{" "}
                      <span className="muted small">
                        · {GAMES[g.type].emoji} {GAMES[g.type].title}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {alone && (
        <div className="card stack">
          <h3>You're the first one on the street 🏡</h3>
          <p className="muted">
            New neighbors move in as people join. Want a friend next door? Send them your invite code.
          </p>
          <InviteBox code={hood.inviteCode} />
        </div>
      )}

      <section className="stack" aria-label="From your neighbors">
        <h2 className="section-title">From the neighborhood</h2>
        {feed.isPending ? (
          <Spinner />
        ) : feed.isError ? (
          <ErrorState error={feed.error} retry={() => feed.refetch()} />
        ) : posts.length === 0 ? (
          <EmptyState emoji="🌱" title="Nothing here yet">
            <p className="muted">Be the first to share something. It doesn't have to be good, just yours.</p>
            <Link to="/make" className="btn btn-accent btn-sm">
              Make something
            </Link>
          </EmptyState>
        ) : (
          <>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            {feed.hasNextPage ? (
              <button className="btn" onClick={() => feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
                {feed.isFetchingNextPage ? "Loading…" : "Show older posts"}
              </button>
            ) : (
              <div className="caught-up">
                <div className="moon">🌙</div>
                <h3>You're all caught up</h3>
                <p className="muted small" style={{ margin: "6px 0 14px" }}>
                  That's everything from {hood?.name ?? "your neighbors"}. Why not make something?
                </p>
                <Link to="/make" className="btn btn-sm">
                  Make something
                </Link>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
